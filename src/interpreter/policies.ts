/**
 * Interpreter Policy — deterministic rules for Compiler decisions.
 *
 * These policies determine HOW resolved intents become DashboardSpec structures.
 * They encode the Golden Case conventions so the Compiler doesn't need if/else chains.
 *
 * Policies are deterministic and stateless. No LLM, no randomness.
 */

import type { Mark } from '../schema/dashboard-spec';
import { getMetric } from '../registries/metrics';

// ── View Grouping Policy ──────────────────────────────────────────────────

export interface MetricGroup {
  unit: string;
  metricIds: string[];
}

/**
 * Group metrics by unit for view creation.
 * Same-unit metrics go into the same view (e.g. open + close are both CNY).
 * Different-unit metrics get separate views (e.g. close vs volume).
 *
 * Order is preserved: first-seen unit defines group order.
 */
export function groupMetricsByUnit(metricIds: string[]): MetricGroup[] {
  const groups: MetricGroup[] = [];
  const unitIndex = new Map<string, number>();

  for (const id of metricIds) {
    const def = getMetric(id);
    if (!def) continue;

    const existing = unitIndex.get(def.unit);
    if (existing !== undefined) {
      groups[existing].metricIds.push(id);
    } else {
      unitIndex.set(def.unit, groups.length);
      groups.push({ unit: def.unit, metricIds: [id] });
    }
  }

  return groups;
}

// ── Default Mark Policy ───────────────────────────────────────────────────

/**
 * Determine default mark for a metric when user hasn't specified one.
 *
 * Rules (derived from Golden Cases):
 * - volume → bar (G1, G4)
 * - change_pct → bar (G3)
 * - price metrics (open/high/low/close) → line (G1, G2, G5)
 * - fallback → line
 */
export function getDefaultMark(metricId: string): Mark {
  if (metricId === 'volume') return 'bar';
  if (metricId === 'change_pct') return 'bar';
  return 'line';
}

/**
 * Determine default mark for a group of metrics.
 * If any metric in the group prefers bar, use bar.
 * Otherwise use line.
 *
 * Exception: single price metric group → line.
 */
export function getDefaultMarkForGroup(metricIds: string[]): Mark {
  // If all metrics prefer the same mark, use that
  const marks = metricIds.map(getDefaultMark);
  const hasBar = marks.some((m) => m === 'bar');
  const hasLine = marks.some((m) => m === 'line');

  // Mixed: prefer the dominant type based on Golden Case patterns
  // If group contains volume or change_pct → bar for that series, line for others
  // But since we're picking ONE mark for the group default, use line for mixed price groups
  if (hasBar && hasLine) {
    // Mixed group: this shouldn't happen with proper unit grouping,
    // but if it does, default to line (price-like metrics dominate)
    return 'line';
  }

  return hasBar ? 'bar' : 'line';
}

// ── Ranking Annotation Label Policy ───────────────────────────────────────

/**
 * Generate annotation label for a ranking transform.
 * Based on metric + order, produces a Chinese label.
 *
 * Examples:
 * - change_pct + asc → '跌幅最大'
 * - change_pct + desc → '涨幅最大'
 * - volume + desc → '成交量最高'
 * - volume + asc → '成交量最低'
 */
export function getRankingAnnotationLabel(
  metricId: string,
  order: 'asc' | 'desc',
): string {
  const def = getMetric(metricId);
  const label = def?.label ?? metricId;

  if (metricId === 'change_pct') {
    return order === 'asc' ? '跌幅最大' : '涨幅最大';
  }

  if (metricId === 'volume') {
    return order === 'desc' ? '成交量最高' : '成交量最低';
  }

  // Generic: "{label}{方向}"
  const direction = order === 'desc' ? '最高' : '最低';
  return `${label}${direction}`;
}

// ── View ID Generation Policy ─────────────────────────────────────────────

/**
 * Generate a deterministic view ID from the metrics in the view.
 * Format: "{metric1}_{metric2}_view"
 */
export function generateViewId(metricIds: string[]): string {
  return `${metricIds.join('_')}_view`;
}

/**
 * Generate a deterministic series ID from a metric.
 * Format: "{metric}_series"
 */
export function generateSeriesId(metricId: string): string {
  return `${metricId}_series`;
}

/**
 * Generate a deterministic annotation ID from a transform.
 * Format: "{transform_id}_ann"
 */
export function generateAnnotationId(transformId: string): string {
  return `${transformId}_ann`;
}

/**
 * Generate a deterministic transform ID from ranking intent.
 * Format: "{order}_{limit}_{metric}" or user-provided label
 */
export function generateTransformId(
  metricId: string,
  order: 'asc' | 'desc',
  limit: number,
): string {
  // Use semantic names matching Golden Cases
  if (metricId === 'change_pct' && order === 'asc' && limit === 3) return 'worst_3_days';
  if (metricId === 'change_pct' && order === 'desc' && limit === 3) return 'best_3_days';
  if (metricId === 'volume' && order === 'desc' && limit === 5) return 'top_5_volume';

  // Generic fallback
  const orderStr = order === 'asc' ? 'bottom' : 'top';
  return `${orderStr}_${limit}_${metricId}`;
}

// ── View Title Generation Policy ──────────────────────────────────────────

/**
 * Generate a view title from instrument, time range, and metric labels.
 * Format: "{instrument}最近{count}个交易日{metric1}和{metric2}"
 */
export function generateViewTitle(
  instrumentDisplayName: string,
  count: number,
  metricLabels: string[],
): string {
  const metricStr = metricLabels.join('和');
  return `${instrumentDisplayName}最近${count}个交易日${metricStr}`;
}

/**
 * Generate intent summary from instrument, time range, and metric labels.
 */
export function generateIntentSummary(
  instrumentDisplayName: string,
  count: number,
  metricLabels: string[],
): string {
  const metricStr = metricLabels.join('和');
  return `分析${instrumentDisplayName}最近${count}个交易日的${metricStr}变化`;
}
