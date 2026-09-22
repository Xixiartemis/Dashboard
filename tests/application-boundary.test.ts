/**
 * Application Boundary Tests — AP1-AP10.
 *
 * Prove the Application Layer correctly bridges Domain → UI
 * without leaking internal types or requiring UI to re-implement business logic.
 */

import { describe, it, expect } from 'vitest';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { executeSpec, executeFollowUp } from '../src/application/materializer';
import { getDemoFixtures, getFailureFixtures } from '../src/application/demo-fixtures';
import type {
  DashboardRunSuccess,
} from '../src/application/contracts';

// ── AP1: Golden Materialization ───────────────────────────────────────────

describe('AP1: Golden Materialization', () => {
  const fixtures = getDemoFixtures();

  it('AP1: G1-G5 all produce success results', () => {
    expect(fixtures.length).toBe(5);
    for (const f of fixtures) {
      expect(f.initialResult.status).toBe('success');
    }
  });

  it('AP1b: each fixture has correct id and prompt', () => {
    for (let i = 0; i < 5; i++) {
      expect(fixtures[i].id).toBe(GOLDEN_CASES[i].id);
      expect(fixtures[i].prompt).toBe(GOLDEN_CASES[i].input);
    }
  });
});

// ── AP2: Serializable Result ──────────────────────────────────────────────

describe('AP2: Serializable Result', () => {
  const fixtures = getDemoFixtures();

  for (const f of fixtures) {
    it(`AP2: ${f.id} initialResult is JSON-serializable`, () => {
      const serialized = JSON.stringify(f.initialResult);
      expect(serialized).toBeTruthy();
      const restored = JSON.parse(serialized);
      expect(restored.status).toBe('success');
      expect(restored.spec).toBeDefined();
      expect(restored.charts).toBeDefined();
      expect(restored.insight).toBeDefined();
    });
  }

  it('AP2b: failure fixtures are JSON-serializable', () => {
    const failures = getFailureFixtures();
    for (const f of failures) {
      const serialized = JSON.stringify(f.result);
      expect(serialized).toBeTruthy();
      const restored = JSON.parse(serialized);
      expect(restored.status).toBe('error');
    }
  });
});

// ── AP3: Chart/View Closure ──────────────────────────────────────────────

describe('AP3: Chart/View Closure', () => {
  const fixtures = getDemoFixtures();

  for (const f of fixtures) {
    it(`AP3: ${f.id} charts.length === spec.views.length`, () => {
      const result = f.initialResult;
      expect(result.charts.length).toBe(result.spec.views.length);
    });

    it(`AP3b: ${f.id} every chart.viewId has a corresponding spec view`, () => {
      const result = f.initialResult;
      const viewIds = new Set(result.spec.views.map((v) => v.id));
      for (const chart of result.charts) {
        expect(viewIds.has(chart.viewId)).toBe(true);
      }
    });
  }
});

// ── AP4: Title Consistency ────────────────────────────────────────────────

describe('AP4: Title Consistency', () => {
  const fixtures = getDemoFixtures();

  for (const f of fixtures) {
    it(`AP4: ${f.id} chart.title === spec view.title`, () => {
      const result = f.initialResult;
      for (const chart of result.charts) {
        const view = result.spec.views.find((v) => v.id === chart.viewId);
        expect(view).toBeDefined();
        expect(chart.title).toBe(view!.title);
      }
    });
  }
});

// ── AP5: Provenance ──────────────────────────────────────────────────────

describe('AP5: Provenance', () => {
  const fixtures = getDemoFixtures();

  for (const f of fixtures) {
    it(`AP5: ${f.id} provenance comes from validated spec + manifest`, () => {
      const result = f.initialResult;
      expect(result.provenance.datasetId).toBe(result.spec.dataSource.datasetId);
      expect(result.provenance.asOf).toBe(result.spec.dataSource.asOf);
      expect(result.provenance.timezone).toBe(result.spec.dataSource.timezone);
      expect(result.provenance.instrument.symbol).toBe(result.spec.instrument.symbol);
      expect(result.provenance.instrument.displayName).toBe(result.spec.instrument.displayName);
      expect(result.provenance.timeRange.count).toBe(result.spec.timeRange.count);
    });
  }
});

// ── AP6: Insight Numeric Source ───────────────────────────────────────────

describe('AP6: Insight Numeric Source', () => {
  const fixtures = getDemoFixtures();

  for (const f of fixtures) {
    it(`AP6: ${f.id} insight items have numeric values (not NaN/undefined)`, () => {
      const result = f.initialResult;
      for (const item of result.insight.items) {
        if (item.type === 'rank') {
          for (const pt of item.points) {
            expect(typeof pt.value).toBe('number');
            expect(Number.isFinite(pt.value)).toBe(true);
            expect(typeof pt.date).toBe('string');
            expect(typeof pt.unit).toBe('string');
          }
          expect(item.limit).toBeGreaterThan(0);
          expect(item.points.length).toBe(item.limit);
        }
        if (item.type === 'period_change') {
          expect(typeof item.startValue).toBe('number');
          expect(typeof item.endValue).toBe('number');
          expect(typeof item.changePct).toBe('number');
          expect(Number.isFinite(item.changePct)).toBe(true);
        }
      }
    });
  }
});

// ── AP7: Trace Ordering ──────────────────────────────────────────────────

describe('AP7: Trace Ordering', () => {
  const EXPECTED_ORDER = [
    'understand_request',
    'build_schema',
    'validate_schema',
    'load_data',
    'analyze',
    'render',
  ];

  const fixtures = getDemoFixtures();

  for (const f of fixtures) {
    it(`AP7: ${f.id} trace has all steps in correct order`, () => {
      const result = f.initialResult;
      expect(result.trace.length).toBe(EXPECTED_ORDER.length);
      for (let i = 0; i < EXPECTED_ORDER.length; i++) {
        expect(result.trace[i].id).toBe(EXPECTED_ORDER[i]);
      }
    });

    it(`AP7b: ${f.id} all success path steps are 'success'`, () => {
      const result = f.initialResult;
      for (const step of result.trace) {
        expect(step.status).toBe('success');
      }
    });
  }
});

// ── AP8: Error Mapping ────────────────────────────────────────────────────

describe('AP8: Error Mapping', () => {
  const failures = getFailureFixtures();

  it('AP8: failure fixtures produce DashboardRunFailure (not throw)', () => {
    expect(failures.length).toBeGreaterThanOrEqual(1);
    for (const f of failures) {
      expect(f.result.status).toBe('error');
      expect(typeof f.result.error.code).toBe('string');
      expect(typeof f.result.error.message).toBe('string');
      expect(typeof f.result.error.recoverable).toBe('boolean');
      expect(f.result.error.message.length).toBeGreaterThan(0);
    }
  });

  it('AP8b: validation_error fixture has correct stage', () => {
    const ve = failures.find((f) => f.id === 'validation_error');
    expect(ve).toBeDefined();
    expect(ve!.result.stage).toBe('validate_schema');
    expect(ve!.result.error.recoverable).toBe(true);
  });

  it('AP8c: error trace shows where failure occurred', () => {
    const ve = failures.find((f) => f.id === 'validation_error');
    expect(ve).toBeDefined();
    const validateStep = ve!.result.trace.find((s) => s.id === 'validate_schema');
    expect(validateStep).toBeDefined();
    expect(validateStep!.status).toBe('error');
    // Later steps should be skipped
    const renderStep = ve!.result.trace.find((s) => s.id === 'render');
    expect(renderStep!.status).toBe('skipped');
  });
});

// ── AP9: Follow-up Shape ─────────────────────────────────────────────────

describe('AP9: Follow-up Shape', () => {
  const fixtures = getDemoFixtures();

  for (const f of fixtures.filter((fx) => fx.followUpResult)) {
    it(`AP9: ${f.id} follow-up result is DashboardRunResult`, () => {
      const result = f.followUpResult!;
      expect(result.status === 'success' || result.status === 'error').toBe(true);
      expect(typeof result.input).toBe('string');
      expect(Array.isArray(result.trace)).toBe(true);
    });

    it(`AP9b: ${f.id} follow-up success has same shape as initial`, () => {
      if (f.followUpResult!.status === 'success' && f.initialResult.status === 'success') {
        const init = f.initialResult;
        const follow = f.followUpResult as DashboardRunSuccess;
        // Same keys
        expect(Object.keys(follow).sort()).toEqual(Object.keys(init).sort());
        expect(follow.charts.length).toBeGreaterThan(0);
        expect(follow.insight).toBeDefined();
        expect(follow.provenance).toBeDefined();
      }
    });

    it(`AP9c: ${f.id} follow-up is JSON-serializable`, () => {
      const serialized = JSON.stringify(f.followUpResult);
      expect(serialized).toBeTruthy();
    });
  }
});

// ── AP10: Immutability ───────────────────────────────────────────────────

describe('AP10: Immutability', () => {
  it('AP10: executeSpec does not mutate input spec', () => {
    const gc = GOLDEN_CASES[0];
    const specBefore = JSON.parse(JSON.stringify(gc.expectedSpec));
    executeSpec(gc.expectedSpec, gc.input);
    const specAfter = JSON.parse(JSON.stringify(gc.expectedSpec));
    expect(specAfter).toEqual(specBefore);
  });

  it('AP10b: executeFollowUp does not mutate input spec', () => {
    const gc = GOLDEN_CASES[0];
    if (!gc.patch) return;
    const specBefore = JSON.parse(JSON.stringify(gc.expectedSpec));
    executeFollowUp(gc.expectedSpec, gc.patch, gc.patchInput ?? '');
    const specAfter = JSON.parse(JSON.stringify(gc.expectedSpec));
    expect(specAfter).toEqual(specBefore);
  });
});
