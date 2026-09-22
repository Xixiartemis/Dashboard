/**
 * Initial Resolver — DraftInitialIntent → ResolvedInitialIntent.
 *
 * Maps raw Chinese metric/instrument mentions to canonical IDs using frozen Registries.
 * Determines displayMetrics vs analysis metrics.
 * Resolves ranking metric direction (涨幅→desc, 跌幅→asc).
 */

import type { ResolvedInitialIntent, RankingIntent } from '../intent';
import type { DraftInitialIntent } from '../extract/initial-extractor';
import type { InterpreterError } from '../errors';
import { makeInterpreterError } from '../errors';
import { resolveInstrumentId } from './instrument-resolver';
import { resolveMetricId } from './metric-resolver';

export interface InitialResolutionResult {
  ok: true;
  intent: ResolvedInitialIntent;
}

export interface InitialResolutionFailure {
  ok: false;
  error: InterpreterError;
}

export type InitialResolutionOutput = InitialResolutionResult | InitialResolutionFailure;

// ── Ranking Metric + Direction Mapping ────────────────────────────────────

/**
 * Map a raw ranking mention (e.g. '跌幅', '涨幅', '成交量') to:
 * - canonical metric ID
 * - order direction
 *
 * Key insight: '涨幅' and '跌幅' both map to change_pct, but with different order.
 */
function resolveRankingMetric(raw: string, rawOrder: 'asc' | 'desc'): {
  ok: true;
  metricId: string;
  order: 'asc' | 'desc';
} | {
  ok: false;
  error: InterpreterError;
} {
  // '涨' without '跌' → change_pct + desc (e.g. 涨幅, 涨得最厉害)
  // '跌' without '涨' → change_pct + asc (e.g. 跌幅, 跌得最厉害)
  // '涨跌幅' is ambiguous — use rawOrder from extractor
  if (/涨/.test(raw) && !/跌/.test(raw)) {
    return { ok: true, metricId: 'change_pct', order: 'desc' };
  }
  if (/跌/.test(raw) && !/涨/.test(raw)) {
    return { ok: true, metricId: 'change_pct', order: 'asc' };
  }

  // General: resolve metric ID and use provided order
  const resolved = resolveMetricId(raw);
  if (!resolved.ok) return resolved;
  return { ok: true, metricId: resolved.metricId, order: rawOrder };
}

// ── Dependency Closure ────────────────────────────────────────────────────

/**
 * Compute the full metrics list (display + analysis dependencies from rankings).
 * Ensures: no duplicates, all IDs are canonical.
 */
function computeMetricsClosure(
  displayMetricIds: string[],
  rankingMetricIds: string[],
): string[] {
  const all = new Set(displayMetricIds);
  for (const id of rankingMetricIds) {
    all.add(id);
  }
  return [...all];
}

// ── Main Resolver ────────────────────────────────────────────────────────

/**
 * Resolve a DraftInitialIntent into a ResolvedInitialIntent.
 *
 * - Maps raw Chinese to canonical IDs via frozen Registries
 * - Determines displayMetrics + full metrics closure
 * - Resolves ranking directions
 * - Fails closed on unknown/missing/ambiguous
 */
export function resolveInitialIntent(draft: DraftInitialIntent): InitialResolutionOutput {
  // ── Instrument ──
  if (!draft.instrument) {
    return { ok: false, error: makeInterpreterError('MISSING_INSTRUMENT') };
  }
  const instResult = resolveInstrumentId(draft.instrument);
  if (!instResult.ok) return { ok: false, error: instResult.error };

  // ── Display Metrics ──
  if (draft.displayMetrics.length === 0) {
    return { ok: false, error: makeInterpreterError('MISSING_METRICS') };
  }
  const displayMetricIds: string[] = [];
  for (const raw of draft.displayMetrics) {
    const resolved = resolveMetricId(raw);
    if (!resolved.ok) return { ok: false, error: resolved.error };
    displayMetricIds.push(resolved.metricId);
  }

  // ── Rankings (resolve metric + direction) ──
  const resolvedRankings: RankingIntent[] = [];
  const rankingMetricIds: string[] = [];

  if (draft.rankings) {
    for (const ranking of draft.rankings) {
      const resolved = resolveRankingMetric(ranking.metric, ranking.order);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      resolvedRankings.push({
        metric: resolved.metricId,
        order: resolved.order,
        limit: ranking.limit,
      });
      rankingMetricIds.push(resolved.metricId);
    }
  }

  // ── Full metrics closure ──
  const allMetrics = computeMetricsClosure(displayMetricIds, rankingMetricIds);

  // ── Assemble ──
  const intent: ResolvedInitialIntent = {
    instrument: instResult.symbol,
    metrics: allMetrics,
    displayMetrics: displayMetricIds,
    timeRange: { count: draft.timeRange?.count ?? 30 },
  };

  if (draft.preferredMark) intent.preferredMark = draft.preferredMark;
  if (resolvedRankings.length > 0) intent.rankings = resolvedRankings;

  return { ok: true, intent };
}
