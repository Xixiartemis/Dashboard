/**
 * Interpreter Core — public API.
 *
 * Architecture:
 *   Resolved Intent → Compiler → DashboardSpec / DashboardPatch
 *
 * The Interpreter does NOT parse natural language (Block 2).
 * This module proves the deterministic compiler core works correctly.
 */

// ── Intent IR ─────────────────────────────────────────────────────────────

export type {
  ResolvedInitialIntent,
  ResolvedFollowUpIntent,
  RankingIntent,
  ReplaceMetricIntent,
  AddMetricIntent,
  SetTimeRangeIntent,
  SetMarkIntent,
} from './intent';

// ── Errors ────────────────────────────────────────────────────────────────

export type { InterpreterErrorCode, InterpreterError } from './errors';
export { makeInterpreterError } from './errors';

// ── Resolvers ─────────────────────────────────────────────────────────────

export { resolveInstrumentId } from './resolver/instrument-resolver';
export { resolveMetricId, resolveMetricIds } from './resolver/metric-resolver';

// ── Policies ──────────────────────────────────────────────────────────────

export {
  groupMetricsByUnit,
  getDefaultMark,
  getDefaultMarkForGroup,
  getRankingAnnotationLabel,
  generateViewId,
  generateSeriesId,
  generateAnnotationId,
  generateTransformId,
  generateViewTitle,
  generateIntentSummary,
} from './policies';

// ── Compilers ─────────────────────────────────────────────────────────────

export { compileInitialIntent } from './compiler/spec-compiler';
export { compileFollowUpIntent } from './compiler/patch-compiler';

// ── Comparison (for tests) ────────────────────────────────────────────────

export { compareSpecSemantics, comparePatchSemantics } from './comparison';
