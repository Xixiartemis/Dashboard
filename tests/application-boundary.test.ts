/**
 * Application Boundary Tests — AP1-AP10.
 *
 * Prove the Application Layer correctly bridges Domain → UI
 * without leaking internal types or requiring UI to re-implement business logic.
 */

import { describe, it, expect } from 'vitest';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { executeSpec, executeDownstreamPipeline, type DataAvailabilityChecker } from '../src/application/materializer';
import { createDashboardService } from '../src/application/dashboard-service';
import { getDemoFixtures, getFailureFixtures } from '../src/application/demo-fixtures';
import type { DashboardSpec } from '../src/schema/dashboard-spec';
import type {
  DashboardRunSuccess,
  PipelineEvent,
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

  it('AP10b: downstream pipeline does not mutate input spec', () => {
    const gc = GOLDEN_CASES[0];
    const specBefore = JSON.parse(JSON.stringify(gc.expectedSpec));
    executeDownstreamPipeline(gc.expectedSpec, {
      trace: [
        { id: 'validate_schema', status: 'pending' },
        { id: 'load_data', status: 'pending' },
        { id: 'analyze', status: 'pending' },
        { id: 'render', status: 'pending' },
      ],
      input: gc.input,
    });
    const specAfter = JSON.parse(JSON.stringify(gc.expectedSpec));
    expect(specAfter).toEqual(specBefore);
  });
});

// ── AP11: Real Empty Data ─────────────────────────────────────────────────

describe('AP11: Real Empty Data', () => {
  it('AP11: empty data passes validation, fails at load_data with EMPTY_DATA', () => {
    const failures = getFailureFixtures();
    const emptyData = failures.find((f) => f.id === 'empty_data')!;
    expect(emptyData).toBeDefined();
    expect(emptyData.result.status).toBe('error');

    const result = emptyData.result;
    // Must NOT be a validation error
    expect(result.stage).toBe('load_data');
    expect(result.error.code).toBe('EMPTY_DATA');

    // validate_schema must have succeeded
    const validateStep = result.trace.find((s) => s.id === 'validate_schema');
    expect(validateStep!.status).toBe('success');

    // load_data must be error
    const loadDataStep = result.trace.find((s) => s.id === 'load_data');
    expect(loadDataStep!.status).toBe('error');

    // Later steps skipped
    const analyzeStep = result.trace.find((s) => s.id === 'analyze');
    expect(analyzeStep!.status).toBe('skipped');
  });
});

// ── AP12: Interpreter Error Mapping ──────────────────────────────────────

describe('AP12: Interpreter Error Mapping', () => {
  it('AP12: interpreter throw → DashboardRunFailure (not rejected Promise)', async () => {
    const throwingInterpreter = {
      async interpretInitial(): Promise<DashboardSpec> {
        throw new Error('LLM provider timeout');
      },
      async interpretFollowUp(): Promise<never> {
        throw new Error('network error');
      },
    };

    const service = createDashboardService(throwingInterpreter);
    const result = await service.runQuery('test input');

    // Must resolve, not reject
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.stage).toBe('understand_request');
      expect(result.error.recoverable).toBe(true);
      expect(result.error.message.length).toBeGreaterThan(0);
      // No raw Error / stack leaked
      expect(result.error.message).not.toContain('at ');
      expect(result.error.message).not.toContain('Error:');
    }
  });

  it('AP12b: follow-up interpreter throw → DashboardRunFailure', async () => {
    const throwingInterpreter = {
      async interpretInitial(): Promise<DashboardSpec> {
        throw new Error('fail');
      },
      async interpretFollowUp(): Promise<never> {
        throw new Error('model returned invalid JSON');
      },
    };

    const service = createDashboardService(throwingInterpreter);
    const result = await service.runFollowUp(GOLDEN_CASES[0].expectedSpec, 'test');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.recoverable).toBe(true);
    }
  });
});

// ── AP13: Initial Event Ordering ─────────────────────────────────────────

describe('AP13: Initial Event Ordering', () => {
  it('AP13: events fire in correct order for initial query', () => {
    const events: PipelineEvent[] = [];
    const emptyChecker: DataAvailabilityChecker = { check: () => 1 };

    // Use a test interpreter that returns a valid spec synchronously
    const testInterpreter = {
      async interpretInitial(_input: string): Promise<DashboardSpec> {
        // Simulate async work
        await new Promise((r) => setTimeout(r, 1));
        return GOLDEN_CASES[0].expectedSpec;
      },
      async interpretFollowUp(): Promise<never> {
        throw new Error('not used');
      },
    };

    const service = createDashboardService(testInterpreter, emptyChecker);
    service.runQuery('test', {
      onEvent: (e) => {
        events.push(e);
        // Verify: when understand_request:start fires, interpreter should be running
        if (e.step === 'understand_request' && e.phase === 'start') {
          // The event fires BEFORE interpreter starts, so interpretStarted may be false
          // This is correct — the event signals the start of the phase
        }
      },
    });

    // Check events synchronously after the call (events fire during execution)
    // Since it's async, we need to wait
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const stepPhases = events.map((e) => `${e.step}:${e.phase}`);

        // Must contain all 6 steps × 2 phases (start + success)
        expect(stepPhases).toContain('understand_request:start');
        expect(stepPhases).toContain('understand_request:success');
        expect(stepPhases).toContain('build_schema:start');
        expect(stepPhases).toContain('build_schema:success');
        expect(stepPhases).toContain('validate_schema:start');
        expect(stepPhases).toContain('validate_schema:success');
        expect(stepPhases).toContain('load_data:start');
        expect(stepPhases).toContain('load_data:success');
        expect(stepPhases).toContain('analyze:start');
        expect(stepPhases).toContain('analyze:success');
        expect(stepPhases).toContain('render:start');
        expect(stepPhases).toContain('render:success');

        // understand_request:start must come before build_schema:start
        const uStart = stepPhases.indexOf('understand_request:start');
        const bStart = stepPhases.indexOf('build_schema:start');
        expect(uStart).toBeLessThan(bStart);

        resolve();
      }, 100);
    });
  });
});

// ── AP14: Follow-up Event No Duplication ─────────────────────────────────

describe('AP14: Follow-up Event No Duplication', () => {
  it('AP14: follow-up emits each step phase exactly once', () => {
    const events: PipelineEvent[] = [];
    const emptyChecker: DataAvailabilityChecker = { check: () => 1 };

    const testInterpreter = {
      async interpretInitial(): Promise<DashboardSpec> {
        return GOLDEN_CASES[0].expectedSpec;
      },
      async interpretFollowUp(): Promise<import('../src/schema/dashboard-patch').DashboardPatch> {
        return GOLDEN_CASES[0].patch!;
      },
    };

    const service = createDashboardService(testInterpreter, emptyChecker);
    service.runFollowUp(GOLDEN_CASES[0].expectedSpec, 'replace metric', {
      onEvent: (e) => events.push(e),
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Count occurrences of each step+phase
        const counts = new Map<string, number>();
        for (const e of events) {
          const key = `${e.step}:${e.phase}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        // Each step:phase should appear exactly once
        for (const [, count] of counts) {
          expect(count).toBe(1);
        }

        // Should NOT have duplicate understand_request:start
        expect(counts.get('understand_request:start')).toBe(1);
        expect(counts.get('build_schema:start')).toBe(1);

        resolve();
      }, 100);
    });
  });
});

// ── AP15: Stage Semantic Ownership ───────────────────────────────────────

describe('AP15: Stage Semantic Ownership', () => {
  it('AP15: load_data checks data availability, analyze runs analytics', () => {
    const checkLog: string[] = [];
    const spyChecker: DataAvailabilityChecker = {
      check(spec): number {
        checkLog.push(`check:${spec.instrument.symbol}`);
        return 30; // pretend 30 records
      },
    };

    const spec = GOLDEN_CASES[0].expectedSpec;
    const result = executeSpec(spec, 'test', undefined, spyChecker);

    // Data checker was called during load_data stage
    expect(checkLog.length).toBe(1);
    expect(checkLog[0]).toContain('MOCK.A');

    // Result is success (analytics ran during analyze stage)
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      // Insight items exist (from computeInsight in analyze stage)
      expect(result.insight.items.length).toBeGreaterThan(0);
      // Charts exist (from render stage)
      expect(result.charts.length).toBeGreaterThan(0);
    }
  });

  it('AP15b: load_data fails with EMPTY_DATA when checker returns 0', () => {
    const zeroChecker: DataAvailabilityChecker = { check: () => 0 };
    const spec = GOLDEN_CASES[0].expectedSpec;
    const result = executeSpec(spec, 'test', undefined, zeroChecker);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.stage).toBe('load_data');
      expect(result.error.code).toBe('EMPTY_DATA');
    }
  });
});

// ── AP16: Public API Surface ─────────────────────────────────────────────

describe('AP16: Public API Surface', () => {
  it('AP16: index.ts does not export executeSpec or executeFollowUp', async () => {
    const mod = await import('../src/application/index');
    // These should NOT be exported
    expect((mod as Record<string, unknown>).executeSpec).toBeUndefined();
    expect((mod as Record<string, unknown>).executeFollowUp).toBeUndefined();
    expect((mod as Record<string, unknown>).executeDownstreamPipeline).toBeUndefined();

    // These SHOULD be exported
    expect(mod.createDashboardService).toBeDefined();
    expect(mod.getDemoFixtures).toBeDefined();
    expect(mod.getFailureFixtures).toBeDefined();
    expect(mod.getAllFixtures).toBeDefined();
  });
});
