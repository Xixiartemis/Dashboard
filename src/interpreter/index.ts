/**
 * Interpreter — public API.
 *
 * Architecture:
 *   NL → Normalizer → Extractor → Resolver → Compiler → DashboardSpec/Patch
 *
 * Block 1: Compiler (frozen)
 * Block 2: NL Understanding (this module)
 */

// ── Intent IR (frozen) ────────────────────────────────────────────────────

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

// ── Resolvers (frozen) ────────────────────────────────────────────────────

export { resolveInstrumentId } from './resolver/instrument-resolver';
export { resolveMetricId, resolveMetricIds } from './resolver/metric-resolver';

// ── Policies (frozen) ─────────────────────────────────────────────────────

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

// ── Compilers (frozen) ────────────────────────────────────────────────────

export { compileInitialIntent } from './compiler/spec-compiler';
export { compileFollowUpIntent } from './compiler/patch-compiler';

// ── Comparison (frozen) ───────────────────────────────────────────────────

export { compareSpecSemantics, comparePatchSemantics } from './comparison';

// ── NL Pipeline (Block 2) ─────────────────────────────────────────────────

export { normalizeInput } from './normalize/normalize-input';
export { extractInitialIntent, detectUnsupported, detectNaturalDayConflict } from './extract/initial-extractor';
export { extractFollowUpIntent } from './extract/followup-extractor';
export { parseNumber, parseChineseNumber, extractNumbers } from './extract/number-parser';
export { resolveInitialIntent } from './resolver/initial-resolver';
export { resolveFollowUpIntent } from './resolver/followup-context-resolver';

// ── Full Interpreter ──────────────────────────────────────────────────────

export { DeterministicInterpreter } from './deterministic-interpreter';
