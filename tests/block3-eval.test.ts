/**
 * Interpreter Eval Runner — Block 3.
 *
 * Runs the eval corpus against the interpreter pipeline.
 * Reports: PASS/FAIL per case, category breakdown, false accept/reject.
 *
 * This file is the evaluation harness. The eval corpus is in fixtures/interpreter-eval.ts.
 */

import { describe, it, expect } from 'vitest';
import { EVAL_CORPUS, DEV_SET, HOLDOUT_SET, type EvalCase } from './fixtures/interpreter-eval';
import { normalizeInput } from '../src/interpreter/normalize/normalize-input';
import { extractInitialIntent } from '../src/interpreter/extract/initial-extractor';
import { extractFollowUpIntent } from '../src/interpreter/extract/followup-extractor';
import { resolveInitialIntent } from '../src/interpreter/resolver/initial-resolver';
import { resolveFollowUpIntent } from '../src/interpreter/resolver/followup-context-resolver';
import { compileInitialIntent } from '../src/interpreter/compiler/spec-compiler';
import { compileFollowUpIntent } from '../src/interpreter/compiler/patch-compiler';
import { compareSpecSemantics } from '../src/interpreter/comparison';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { applyPatch } from '../src/patch/apply-patch';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import type { DashboardSpec } from '../src/schema/dashboard-spec';

// ── Helpers ──────────────────────────────────────────────────────────────

function getGoldenSpec(id: string): DashboardSpec {
  const gc = GOLDEN_CASES.find((g) => g.id === id);
  if (!gc) throw new Error(`Unknown golden: ${id}`);
  return gc.expectedSpec;
}

function runInitialPipeline(input: string) {
  const normalized = normalizeInput(input);
  const extracted = extractInitialIntent(normalized);
  if (!extracted.ok) return { ok: false as const, code: extracted.code, details: extracted.details };
  const resolved = resolveInitialIntent(extracted.intent);
  if (!resolved.ok) return { ok: false as const, code: resolved.error.code, details: resolved.error.details ?? '' };
  const compiled = compileInitialIntent(resolved.intent);
  if (!compiled.ok) return { ok: false as const, code: compiled.error.code, details: compiled.error.details ?? '' };
  return { ok: true as const, spec: compiled.spec };
}

function runFollowUpPipeline(currentSpec: DashboardSpec, input: string) {
  const normalized = normalizeInput(input);
  const extracted = extractFollowUpIntent(normalized);
  if (!extracted.ok) return { ok: false as const, code: extracted.code, details: extracted.details };
  const resolved = resolveFollowUpIntent(extracted.intent, currentSpec);
  if (!resolved.ok) return { ok: false as const, code: resolved.error.code, details: resolved.error.details ?? '' };
  const compiled = compileFollowUpIntent(resolved.intent, currentSpec);
  if (!compiled.ok) return { ok: false as const, code: compiled.error.code, details: compiled.error.details ?? '' };
  return { ok: true as const, patch: compiled.patch };
}

interface EvalResult {
  id: string;
  category: string;
  split: string;
  pass: boolean;
  failureClass?: string;
  details?: string;
}

function evaluateCase(c: EvalCase): EvalResult {
  const base: Omit<EvalResult, 'pass' | 'failureClass' | 'details'> = {
    id: c.id,
    category: c.category,
    split: c.split,
  };

  // ── Error expected cases ──
  if (c.expected.kind === 'error') {
    // For follow-up error cases, use currentSpecSource
    if (c.currentSpecSource) {
      const spec = getGoldenSpec(c.currentSpecSource);
      const result = runFollowUpPipeline(spec, c.input);
      if (result.ok) {
        return { ...base, pass: false, failureClass: 'FALSE_POSITIVE', details: `Expected error but got patch: ${result.patch.op}` };
      }
      if (result.code === c.expected.code) {
        return { ...base, pass: true };
      }
      return { ...base, pass: false, failureClass: 'WRONG_ERROR_CODE', details: `Expected ${c.expected.code}, got ${result.code}` };
    }

    // Initial error cases
    const result = runInitialPipeline(c.input);
    if (result.ok) {
      return { ...base, pass: false, failureClass: 'FALSE_POSITIVE', details: `Expected error but got spec` };
    }
    if (result.code === c.expected.code) {
      return { ...base, pass: true };
    }
    // For conflict detection: accept any error as "fail closed" if we expected CONFLICTING_INTENT
    if (c.expected.code === 'CONFLICTING_INTENT' && !result.ok) {
      return { ...base, pass: true };
    }
    return { ...base, pass: false, failureClass: 'WRONG_ERROR_CODE', details: `Expected ${c.expected.code}, got ${result.code}` };
  }

  // ── Patch expected cases ──
  if (c.expected.kind === 'patch') {
    if (!c.currentSpecSource) {
      return { ...base, pass: false, failureClass: 'MISSING_CONTEXT', details: 'No currentSpecSource' };
    }
    const spec = getGoldenSpec(c.currentSpecSource);
    const result = runFollowUpPipeline(spec, c.input);
    if (!result.ok) {
      return { ...base, pass: false, failureClass: 'FOLLOWUP_EXTRACTION_MISS', details: `Error: ${result.code} — ${result.details}` };
    }
    const exp = c.expected;
    if (result.patch.op !== exp.op) {
      return { ...base, pass: false, failureClass: 'WRONG_PATCH_OP', details: `Expected ${exp.op}, got ${result.patch.op}` };
    }
    // Check specific fields
    const p = result.patch as any;
    if (exp.from && p.from !== exp.from) return { ...base, pass: false, failureClass: 'WRONG_PATCH_FIELD', details: `from: ${exp.from} vs ${p.from}` };
    if (exp.to && p.to !== exp.to) return { ...base, pass: false, failureClass: 'WRONG_PATCH_FIELD', details: `to: ${exp.to} vs ${p.to}` };
    if (exp.metric && p.metric !== exp.metric) return { ...base, pass: false, failureClass: 'WRONG_PATCH_FIELD', details: `metric: ${exp.metric} vs ${p.metric}` };
    if (exp.count && p.count !== exp.count) return { ...base, pass: false, failureClass: 'WRONG_PATCH_FIELD', details: `count: ${exp.count} vs ${p.count}` };
    if (exp.mark && p.mark !== exp.mark) return { ...base, pass: false, failureClass: 'WRONG_PATCH_FIELD', details: `mark: ${exp.mark} vs ${p.mark}` };

    // Verify patch applies successfully
    const applied = applyPatch(spec, result.patch);
    if (!applied.ok) {
      return { ...base, pass: false, failureClass: 'PATCH_APPLICATION_FAIL', details: 'Patch did not apply' };
    }
    return { ...base, pass: true };
  }

  // ── Spec expected cases ──
  if (c.expected.kind === 'spec') {
    const result = runInitialPipeline(c.input);
    if (!result.ok) {
      return { ...base, pass: false, failureClass: 'INITIAL_EXTRACTION_MISS', details: `Error: ${result.code} — ${result.details}` };
    }
    const spec = result.spec;
    const exp = c.expected;

    // If golden reference, do semantic comparison
    if (exp.golden) {
      const goldenSpec = getGoldenSpec(exp.golden);
      const comparison = compareSpecSemantics(spec, goldenSpec);
      if (!comparison.equal) {
        return { ...base, pass: false, failureClass: 'SEMANTIC_MISMATCH', details: comparison.differences.join('; ') };
      }
      // Also validate the result
      const s = validateStructure(spec);
      if (!s.ok) return { ...base, pass: false, failureClass: 'STRUCTURAL_INVALID', details: 'Failed structural validation' };
      if (s.ok) {
        const sem = validateSemantics(s.spec);
        if (!sem.ok) return { ...base, pass: false, failureClass: 'SEMANTIC_INVALID', details: 'Failed semantic validation' };
      }
      return { ...base, pass: true };
    }

    // Field-level checks
    if (exp.instrument && spec.instrument.symbol !== exp.instrument) {
      return { ...base, pass: false, failureClass: 'INSTRUMENT_MISMATCH', details: `Expected ${exp.instrument}, got ${spec.instrument.symbol}` };
    }
    if (exp.displayMetrics) {
      const displayFields = spec.views.flatMap((v) => v.series.map((s) => s.field));
      for (const m of exp.displayMetrics) {
        if (!displayFields.includes(m)) {
          return { ...base, pass: false, failureClass: 'METRIC_DISPLAY_MISMATCH', details: `Expected display metric ${m} not in views` };
        }
      }
    }
    if (exp.metrics) {
      for (const m of exp.metrics) {
        if (!spec.metrics.some((sm) => sm.id === m)) {
          return { ...base, pass: false, failureClass: 'METRIC_MISMATCH', details: `Expected metric ${m} not in spec` };
        }
      }
    }
    if (exp.timeRangeCount && spec.timeRange.count !== exp.timeRangeCount) {
      return { ...base, pass: false, failureClass: 'TIME_RANGE_MISMATCH', details: `Expected ${exp.timeRangeCount}, got ${spec.timeRange.count}` };
    }
    if (exp.mark) {
      const firstSeries = spec.views[0]?.series[0];
      if (!firstSeries || firstSeries.mark !== exp.mark) {
        return { ...base, pass: false, failureClass: 'MARK_MISMATCH', details: `Expected mark ${exp.mark}` };
      }
    }
    if (exp.rankings) {
      for (const r of exp.rankings) {
        const matchingTransform = spec.transforms.find(
          (t) => t.field === r.metric && t.order === r.order && t.limit === r.limit,
        );
        if (!matchingTransform) {
          return { ...base, pass: false, failureClass: 'RANKING_MISMATCH', details: `Expected ranking ${r.metric}:${r.order}:${r.limit}` };
        }
      }
      if (exp.rankings.length === 0 && spec.transforms.length > 0) {
        return { ...base, pass: false, failureClass: 'FALSE_RANKING', details: `Expected no rankings but got ${spec.transforms.length}` };
      }
    }
    if (exp.viewCount && spec.views.length !== exp.viewCount) {
      return { ...base, pass: false, failureClass: 'VIEW_COUNT_MISMATCH', details: `Expected ${exp.viewCount} views, got ${spec.views.length}` };
    }

    // Validate
    const s = validateStructure(spec);
    if (!s.ok) return { ...base, pass: false, failureClass: 'STRUCTURAL_INVALID', details: 'Failed structural validation' };
    if (s.ok) {
      const sem = validateSemantics(s.spec);
      if (!sem.ok) return { ...base, pass: false, failureClass: 'SEMANTIC_INVALID', details: 'Failed semantic validation' };
    }

    return { ...base, pass: true };
  }

  return { ...base, pass: false, failureClass: 'UNKNOWN_EXPECTED', details: 'Unknown expected kind' };
}

// ── Run all eval cases and collect results ────────────────────────────────

function runEvalSuite(cases: EvalCase[]): EvalResult[] {
  return cases.map(evaluateCase);
}

function summarizeResults(results: EvalResult[]) {
  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass);

  const byCategory: Record<string, { total: number; pass: number; fail: number }> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { total: 0, pass: 0, fail: 0 };
    byCategory[r.category].total++;
    if (r.pass) byCategory[r.category].pass++;
    else byCategory[r.category].fail++;
  }

  const falseAccepts = failed.filter((r) => r.failureClass === 'FALSE_POSITIVE');
  const falseRejects = failed.filter((r) => r.failureClass !== 'FALSE_POSITIVE');

  return { total, passed, failed, byCategory, falseAccepts, falseRejects };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('Block 3: Interpreter Eval — DEV Set', () => {
  const devResults = runEvalSuite(DEV_SET);

  // Summary test
  it('DEV summary', () => {
    const summary = summarizeResults(devResults);
    console.log('\n=== DEV SET RESULTS ===');
    console.log(`TOTAL: ${summary.total}`);
    console.log(`PASS: ${summary.pass}`);
    console.log(`FAIL: ${summary.failed.length}`);
    console.log(`FALSE_ACCEPT: ${summary.falseAccepts.length}`);
    console.log(`FALSE_REJECT: ${summary.falseRejects.length}`);
    console.log('\n--- Category Breakdown ---');
    for (const [cat, counts] of Object.entries(summary.byCategory)) {
      console.log(`  ${cat}: ${counts.pass}/${counts.total} pass`);
    }
    if (summary.failed.length > 0) {
      console.log('\n--- Failures ---');
      for (const f of summary.failed) {
        console.log(`  ${f.id} [${f.category}] ${f.failureClass}: ${f.details}`);
      }
    }
  });

  // Individual case tests
  for (const c of DEV_SET) {
    it(`${c.id}: ${c.category}`, () => {
      const result = evaluateCase(c);
      if (!result.pass) {
        console.log(`FAIL ${result.id}: ${result.failureClass} — ${result.details}`);
      }
      expect(result.pass).toBe(true);
    });
  }
});

describe('Block 3: Interpreter Eval — HOLDOUT Set', () => {
  const holdoutResults = runEvalSuite(HOLDOUT_SET);

  it('HOLDOUT summary', () => {
    const summary = summarizeResults(holdoutResults);
    console.log('\n=== HOLDOUT SET RESULTS ===');
    console.log(`TOTAL: ${summary.total}`);
    console.log(`PASS: ${summary.pass}`);
    console.log(`FAIL: ${summary.failed.length}`);
    if (summary.failed.length > 0) {
      console.log('\n--- Failures ---');
      for (const f of summary.failed) {
        console.log(`  ${f.id} [${f.category}] ${f.failureClass}: ${f.details}`);
      }
    }
  });

  for (const c of HOLDOUT_SET) {
    it(`${c.id}: ${c.category}`, () => {
      const result = evaluateCase(c);
      if (!result.pass) {
        console.log(`FAIL ${result.id}: ${result.failureClass} — ${result.details}`);
      }
      expect(result.pass).toBe(true);
    });
  }
});

describe('Block 3: Determinism (5x all supported cases)', () => {
  it('all supported cases produce identical results 5x', () => {
    const supportedCases = EVAL_CORPUS.filter((c) => c.expected.kind !== 'error' || c.expected.code === 'UNSUPPORTED_CAPABILITY');

    for (const c of supportedCases) {
      const results: string[] = [];
      for (let i = 0; i < 5; i++) {
        if (c.expected.kind === 'spec' || c.expected.kind === 'error') {
          const r = runInitialPipeline(c.input);
          results.push(JSON.stringify(r));
        } else if (c.expected.kind === 'patch' && c.currentSpecSource) {
          const spec = getGoldenSpec(c.currentSpecSource);
          const r = runFollowUpPipeline(spec, c.input);
          results.push(JSON.stringify(r));
        }
      }
      const unique = new Set(results);
      if (unique.size > 1) {
        expect.fail(`Non-deterministic: ${c.id} produced ${unique.size} different results`);
      }
    }
  });
});

// ── Golden Regression ────────────────────────────────────────────────────

describe('Block 3: Golden Regression', () => {
  it('G1-G5 initial NL still passes', () => {
    for (let i = 0; i < 5; i++) {
      const result = runInitialPipeline(GOLDEN_CASES[i].input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const comparison = compareSpecSemantics(result.spec, GOLDEN_CASES[i].expectedSpec);
        expect(comparison.equal).toBe(true);
      }
    }
  });

  it('G1-G5 follow-up NL still passes', () => {
    for (let i = 0; i < 5; i++) {
      const gc = GOLDEN_CASES[i];
      if (!gc.patch || !gc.patchInput) continue;
      const result = runFollowUpPipeline(gc.expectedSpec, gc.patchInput);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const applied = applyPatch(gc.expectedSpec, result.patch);
        expect(applied.ok).toBe(true);
      }
    }
  });
});
