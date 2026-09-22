/**
 * Analytics Engine — computes derived metrics and applies transforms.
 *
 * Critical invariant: derived metrics (e.g. change_pct) MUST be computed
 * on the FULL series BEFORE applying time range filter. Otherwise the
 * first day of the requested range would miss its lookback.
 *
 * Pipeline:
 *   raw series → compute derived → apply time range → transforms → final data
 */

import type { RawStockRecord } from '../data/mock-dataset';
import type { DashboardSpec, Transform } from '../schema/dashboard-spec';
import { getDataset } from '../data/mock-dataset';

// ── Enriched record ────────────────────────────────────────────────────────

export interface EnrichedRecord extends RawStockRecord {
  change_pct: number;  // 5.2 means 5.2%, NOT 0.052
}

/** Safely read a field from an EnrichedRecord by name. */
function getField(r: EnrichedRecord, field: string): number | undefined {
  return (r as unknown as Record<string, number>)[field];
}

// ── Compute change_pct on full series ──────────────────────────────────────

export function computeChangePct(
  records: readonly RawStockRecord[],
): EnrichedRecord[] {
  const enriched: EnrichedRecord[] = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    let change_pct: number;

    if (i === 0) {
      // First day: no previous close, set to 0
      change_pct = 0;
    } else {
      const prevClose = records[i - 1].close;
      change_pct = ((r.close - prevClose) / prevClose) * 100;
      change_pct = Math.round(change_pct * 100) / 100; // 2 decimal places
    }

    enriched.push({ ...r, change_pct });
  }

  return enriched;
}

// ── Apply time range (last N trading days) ─────────────────────────────────

export function applyTimeRange(
  records: EnrichedRecord[],
  count: number,
): EnrichedRecord[] {
  return records.slice(-count);
}

// ── Transform: rank ────────────────────────────────────────────────────────

export interface RankedResult {
  records: EnrichedRecord[];
  rankedIndices: number[]; // indices into the input records array
}

export function applyRankTransform(
  records: EnrichedRecord[],
  transform: Transform,
): RankedResult {
  const indexed = records.map((r, i) => ({ record: r, index: i }));

  // Sort by the transform field
  indexed.sort((a, b) => {
    const va = getField(a.record, transform.field) ?? 0;
    const vb = getField(b.record, transform.field) ?? 0;
    const cmp = va - vb;
    return transform.order === 'asc' ? cmp : -cmp;
  });

  // Take top N
  const topN = indexed.slice(0, transform.limit);

  return {
    records: topN.map((x) => x.record),
    rankedIndices: topN.map((x) => x.index),
  };
}

// ── Full analytics pipeline ────────────────────────────────────────────────

export interface AnalyticsResult {
  /** Full enriched series (after time range filter) */
  series: EnrichedRecord[];
  /** Transform results keyed by transform id */
  transforms: Map<string, RankedResult>;
  /** Empty if no data */
  isEmpty: boolean;
}

export function runAnalytics(spec: DashboardSpec): AnalyticsResult {
  // 1. Get raw data
  const raw = getDataset(spec.instrument.symbol);
  if (!raw || raw.length === 0) {
    return { series: [], transforms: new Map(), isEmpty: true };
  }

  // 2. Compute derived metrics on FULL series (before time range filter!)
  const enriched = computeChangePct(raw);

  // 3. Apply time range
  const filtered = applyTimeRange(enriched, spec.timeRange.count);

  // 4. Apply transforms
  const transforms = new Map<string, RankedResult>();
  for (const t of spec.transforms) {
    // Transforms operate on the time-filtered data
    const result = applyRankTransform(filtered, t);
    transforms.set(t.id, result);
  }

  return {
    series: filtered,
    transforms,
    isEmpty: filtered.length === 0,
  };
}

// ── Insight computation ────────────────────────────────────────────────────

export interface InsightData {
  period_change?: { metric: string; startValue: number; endValue: number; changePct: number };
  worst_days?: { metric: string; days: { date: string; value: number }[] };
  best_days?: { metric: string; days: { date: string; value: number }[] };
  max_volume_days?: { metric: string; days: { date: string; value: number }[] };
}

export function computeInsight(spec: DashboardSpec, analytics: AnalyticsResult): InsightData {
  const result: InsightData = {};

  for (const fact of spec.insight.facts) {
    switch (fact.kind) {
      case 'period_change': {
        if (analytics.series.length >= 2) {
          const first = analytics.series[0];
          const last = analytics.series[analytics.series.length - 1];
          const startVal = getField(first, fact.metric) ?? 0;
          const endVal = getField(last, fact.metric) ?? 0;
          const changePct = startVal !== 0
            ? Math.round(((endVal - startVal) / startVal) * 10000) / 100
            : 0;
          result.period_change = { metric: fact.metric, startValue: startVal, endValue: endVal, changePct };
        }
        break;
      }
      case 'worst_days': {
        const sorted = [...analytics.series].sort((a, b) => {
          return (getField(a, fact.metric) ?? 0) - (getField(b, fact.metric) ?? 0);
        });
        result.worst_days = {
          metric: fact.metric,
          days: sorted.slice(0, 3).map((r) => ({
            date: r.date,
            value: getField(r, fact.metric) ?? 0,
          })),
        };
        break;
      }
      case 'best_days': {
        const sorted = [...analytics.series].sort((a, b) => {
          return (getField(b, fact.metric) ?? 0) - (getField(a, fact.metric) ?? 0);
        });
        result.best_days = {
          metric: fact.metric,
          days: sorted.slice(0, 3).map((r) => ({
            date: r.date,
            value: getField(r, fact.metric) ?? 0,
          })),
        };
        break;
      }
      case 'max_volume_days': {
        const sorted = [...analytics.series].sort((a, b) => b.volume - a.volume);
        result.max_volume_days = {
          metric: fact.metric,
          days: sorted.slice(0, 5).map((r) => ({
            date: r.date,
            value: r.volume,
          })),
        };
        break;
      }
    }
  }

  return result;
}
