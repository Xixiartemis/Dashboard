/**
 * Intent IR — Canonical Intermediate Representation for Interpreter.
 *
 * Intent expresses "what the user wants" without duplicating Registry metadata.
 * Metric IDs, instrument symbols are canonical — label/unit/kind come from Registry.
 *
 * This is NOT DashboardSpec. It's the contract between NL understanding and Compiler.
 */

import type { Mark } from '../schema/dashboard-spec';

// ── Ranking Intent ────────────────────────────────────────────────────────
// annotationLabel is NOT stored here — it's derived deterministically by Policy
// from metric + order. No second truth source for ranking semantics.

export interface RankingIntent {
  metric: string;       // canonical metric ID (e.g. 'change_pct')
  order: 'asc' | 'desc';
  limit: number;
}

// ── Initial Intent ────────────────────────────────────────────────────────

export interface ResolvedInitialIntent {
  instrument: string;       // canonical symbol (e.g. 'MOCK.A')
  metrics: string[];        // all metrics (analysis dependency closure)
  displayMetrics?: string[]; // metrics to render as views (subset of metrics). If omitted, = metrics.
  timeRange: {
    count: number;          // trading days
  };
  preferredMark?: Mark;     // user-specified chart type, undefined = use policy
  rankings?: RankingIntent[];
}

// ── Follow-up Intent (discriminated union) ────────────────────────────────

export interface ReplaceMetricIntent {
  op: 'replace_metric';
  from: string;   // canonical metric ID currently in spec
  to: string;     // canonical metric ID to replace with
}

export interface AddMetricIntent {
  op: 'add_metric';
  metric: string;  // canonical metric ID to add
  viewId: string;  // target view ID (determined by resolver/policy)
}

export interface SetTimeRangeIntent {
  op: 'set_time_range';
  count: number;
}

export interface SetMarkIntent {
  op: 'set_mark';
  viewId: string;
  seriesId: string;
  mark: Mark;
}

export type ResolvedFollowUpIntent =
  | ReplaceMetricIntent
  | AddMetricIntent
  | SetTimeRangeIntent
  | SetMarkIntent;
