/**
 * Analytics Engine — computes derived metrics and applies transforms.
 *
 * Critical invariant: derived metrics (e.g. change_pct) MUST be computed
 * on the FULL series BEFORE applying time range filter. Otherwise the
 * first day of the requested range would miss its lookback.
 *
 * Pipeline:
 *   raw series → compute derived → apply time range → transforms → final data
 *
 * Insight invariant: ranking facts consume the SAME transform results as
 * annotations. No independent re-sorting.
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
      change_pct = 0;
    } else {
      const prevClose = records[i - 1].close;
      change_pct = ((r.close - prevClose) / prevClose) * 100;
      change_pct = Math.round(change_pct * 100) / 100;
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
  rankedIndices: number[];
}

export function applyRankTransform(
  records: EnrichedRecord[],
  transform: Transform,
): RankedResult {
  const indexed = records.map((r, i) => ({ record: r, index: i }));

  indexed.sort((a, b) => {
    const va = getField(a.record, transform.field) ?? 0;
    const vb = getField(b.record, transform.field) ?? 0;
    const cmp = va - vb;
    return transform.order === 'asc' ? cmp : -cmp;
  });

  const topN = indexed.slice(0, transform.limit);

  return {
    records: topN.map((x) => x.record),
    rankedIndices: topN.map((x) => x.index),
  };
}

// ── Full analytics pipeline ────────────────────────────────────────────────

export interface AnalyticsResult {
  series: EnrichedRecord[];
  transforms: Map<string, RankedResult>;
  isEmpty: boolean;
}

export function runAnalytics(spec: DashboardSpec): AnalyticsResult {
  const raw = getDataset(spec.instrument.symbol);
  if (!raw || raw.length === 0) {
    return { series: [], transforms: new Map(), isEmpty: true };
  }

  const enriched = computeChangePct(raw);
  const filtered = applyTimeRange(enriched, spec.timeRange.count);

  const transforms = new Map<string, RankedResult>();
  for (const t of spec.transforms) {
    const result = applyRankTransform(filtered, t);
    transforms.set(t.id, result);
  }

  return {
    series: filtered,
    transforms,
    isEmpty: filtered.length === 0,
  };
}

// ── Insight computation (Issue #7: ranking facts consume transform results) ──

export interface InsightData {
  period_change?: { metric: string; startValue: number; endValue: number; changePct: number };
  rank_results?: Map<string, { transformRef: string; metric: string; label: string; records: { date: string; value: number }[] }>;
}

export function computeInsight(spec: DashboardSpec, analytics: AnalyticsResult): InsightData {
  const result: InsightData = {};
  const rankResults = new Map<string, { transformRef: string; metric: string; label: string; records: { date: string; value: number }[] }>();

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
      case 'rank_summary': {
        // MUST consume the same transform result as annotations — no independent re-sorting
        // metric is derived from the referenced transform (single source of truth)
        const transformResult = analytics.transforms.get(fact.transformRef);
        if (transformResult) {
          const transform = spec.transforms.find((t) => t.id === fact.transformRef);
          const metricFromTransform = transform?.field ?? 'unknown';
          rankResults.set(fact.transformRef, {
            transformRef: fact.transformRef,
            metric: metricFromTransform,
            label: fact.labelKey ?? '',
            records: transformResult.records.map((r) => ({
              date: r.date,
              value: getField(r, metricFromTransform) ?? 0,
            })),
          });
        }
        break;
      }
    }
  }

  result.rank_results = rankResults;
  return result;
}
