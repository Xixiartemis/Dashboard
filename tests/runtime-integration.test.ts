/**
 * Block 4: Runtime Integration Tests — RT1-RT9.
 *
 * Tests the full NL → Interpreter → Service → Controller pipeline.
 * No fixture short-circuiting. Real DeterministicInterpreter execution.
 */

import { describe, it, expect } from 'vitest';
import { createRuntime } from '../src/runtime/dashboard-runtime';
import { createDashboardService } from '../src/application/dashboard-service';
import { compareSpecSemantics } from '../src/interpreter/comparison';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import type { DashboardRunSuccess, PipelineEvent } from '../src/application/contracts';
import type { DashboardSpec } from '../src/schema/dashboard-spec';

// ── RT1: Initial Runtime ─────────────────────────────────────────────────

describe('RT1: Initial Runtime — real NL → DashboardRunSuccess', () => {
  const runtime = createRuntime();

  for (let i = 0; i < 5; i++) {
    it(`RT1-${i + 1}: G${i + 1} NL → success`, async () => {
      runtime.controller.reset();
      const result = await runtime.controller.submitCommand(GOLDEN_CASES[i].input);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        const comparison = compareSpecSemantics(result.spec, GOLDEN_CASES[i].expectedSpec);
        expect(comparison.equal).toBe(true);
      }
    });
  }
});

// ── RT2: Follow-up Runtime ───────────────────────────────────────────────

describe('RT2: Follow-up Runtime — initial + follow-up', () => {
  const runtime = createRuntime();

  for (let i = 0; i < 5; i++) {
    if (!GOLDEN_CASES[i].patch || !GOLDEN_CASES[i].patchInput) continue;
    it(`RT2-${i + 1}: G${i + 1} initial + follow-up`, async () => {
      runtime.controller.reset();

      // Initial
      const initResult = await runtime.controller.submitCommand(GOLDEN_CASES[i].input);
      expect(initResult.status).toBe('success');

      // Follow-up
      const followResult = await runtime.controller.submitCommand(GOLDEN_CASES[i].patchInput!);
      expect(followResult.status).toBe('success');
      if (followResult.status === 'success') {
        // Verify the patched spec is valid
        const s = validateStructure(followResult.spec);
        expect(s.ok).toBe(true);
        if (s.ok) expect(validateSemantics(s.spec).ok).toBe(true);
      }
    });
  }
});

// ── RT3: Pipeline Events ─────────────────────────────────────────────────

describe('RT3: Pipeline Events — correct order', () => {
  it('RT3: successful initial has all events in order', async () => {
    const runtime = createRuntime();
    runtime.controller.reset();
    const events: PipelineEvent[] = [];

    await runtime.controller.submitCommand(GOLDEN_CASES[0].input);
    // Re-run with event capture (controller already ran, re-create)
    const runtime2 = createRuntime();
    await runtime2.service.runQuery(GOLDEN_CASES[0].input, {
      onEvent: (e) => events.push(e),
    });

    const stepPhases = events.map((e) => `${e.step}:${e.phase}`);

    // Must have all 6 steps × start + success
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

    // Order: understand_request before build_schema
    const uStart = stepPhases.indexOf('understand_request:start');
    const bStart = stepPhases.indexOf('build_schema:start');
    expect(uStart).toBeLessThan(bStart);
  });
});

// ── RT4: Interpreter Failure Event ───────────────────────────────────────

describe('RT4: Interpreter Failure Event', () => {
  it('RT4: unsupported input emits understand_request:error', async () => {
    const runtime = createRuntime();
    runtime.controller.reset();
    const events: PipelineEvent[] = [];

    const result = await runtime.service.runQuery('预测A公司明天收盘价', {
      onEvent: (e) => events.push(e),
    });

    expect(result.status).toBe('error');
    const stepPhases = events.map((e) => `${e.step}:${e.phase}`);
    expect(stepPhases).toContain('understand_request:start');
    expect(stepPhases).toContain('understand_request:error');
    // No build_schema or later events
    expect(stepPhases.some((p) => p.startsWith('build_schema'))).toBe(false);
    expect(stepPhases.some((p) => p.startsWith('validate_schema'))).toBe(false);
  });

  it('RT4b: error trace has skipped downstream steps', async () => {
    const runtime = createRuntime();
    const result = await runtime.service.runQuery('分析最近30天的收盘价');

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.stage).toBe('understand_request');
      const renderStep = result.trace.find((s) => s.id === 'render');
      expect(renderStep?.status).toBe('skipped');
    }
  });
});

// ── RT5: Typed Error Preservation ────────────────────────────────────────

describe('RT5: Typed Error Preservation', () => {
  const runtime = createRuntime();

  it('RT5-1: MISSING_INSTRUMENT preserved', async () => {
    const result = await runtime.service.runQuery('分析最近30天的收盘价');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toContain('MISSING_INSTRUMENT');
      expect(result.error.message).toBeTruthy();
      expect(result.error.message).not.toBe('解读请求时发生错误');
    }
  });

  it('RT5-2: MISSING_METRICS preserved', async () => {
    const result = await runtime.service.runQuery('分析A公司最近30天');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toContain('MISSING_METRICS');
    }
  });

  it('RT5-3: UNSUPPORTED_CAPABILITY preserved', async () => {
    const result = await runtime.service.runQuery('预测A公司明天收盘价');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toContain('UNSUPPORTED_CAPABILITY');
    }
  });

  it('RT5-4: AMBIGUOUS_INPUT preserved (follow-up)', async () => {
    const runtime2 = createRuntime();
    // First get a success
    await runtime2.controller.submitCommand(GOLDEN_CASES[0].input);
    // Then ambiguous follow-up
    const result = await runtime2.service.runFollowUp(
      (runtime2.controller.getState().lastSuccess as DashboardRunSuccess).spec,
      '随便看看',
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toContain('AMBIGUOUS_INPUT');
    }
  });
});

// ── RT6: Follow-up Failure Preserves Dashboard ───────────────────────────

describe('RT6: Follow-up Failure Preserves Dashboard', () => {
  it('RT6: unsupported follow-up preserves lastSuccess', async () => {
    const runtime = createRuntime();
    runtime.controller.reset();

    // G1 success
    const initResult = await runtime.controller.submitCommand(GOLDEN_CASES[0].input);
    expect(initResult.status).toBe('success');
    const state1 = runtime.controller.getState();
    expect(state1.lastSuccess).not.toBeNull();

    // Unsupported follow-up
    const followResult = await runtime.controller.submitCommand('预测明天走势');
    expect(followResult.status).toBe('error');

    // Dashboard preserved
    const state2 = runtime.controller.getState();
    expect(state2.lastSuccess).not.toBeNull();
    expect(state2.lastSuccess?.spec.instrument.symbol).toBe('MOCK.A');
    expect(state2.latestError).not.toBeNull();
    expect(state2.latestError?.error.code).toContain('UNSUPPORTED');
  });
});

// ── RT7: Reset / New Analysis ────────────────────────────────────────────

describe('RT7: Reset / New Analysis', () => {
  it('RT7: reset clears state, next command is initial', async () => {
    const runtime = createRuntime();
    runtime.controller.reset();

    // G1 success
    await runtime.controller.submitCommand(GOLDEN_CASES[0].input);
    const state1 = runtime.controller.getState();
    expect(state1.lastSuccess).not.toBeNull();
    expect(state1.commandContext).toBe('refine');

    // Reset
    runtime.controller.reset();
    const state2 = runtime.controller.getState();
    expect(state2.lastSuccess).toBeNull();
    expect(state2.latestError).toBeNull();
    expect(state2.commandContext).toBe('initial');
    expect(state2.running).toBe(false);

    // G2 as new initial (not follow-up)
    const result = await runtime.controller.submitCommand(GOLDEN_CASES[1].input);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.spec.instrument.symbol).toBe('MOCK.B');
    }
  });
});

// ── RT8: Example Prompt Uses Runtime ─────────────────────────────────────

describe('RT8: Example Prompt Uses Runtime', () => {
  it('RT8: controller.submitCommand goes through real interpreter', async () => {
    const runtime = createRuntime();
    runtime.controller.reset();

    // Simulate clicking an example prompt
    const result = await runtime.controller.submitCommand(GOLDEN_CASES[2].input);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      // Must be a real G3 spec, not a fixture shortcut
      expect(result.spec.instrument.symbol).toBe('MOCK.A');
      expect(result.spec.timeRange.count).toBe(15);
      expect(result.spec.views.some((v) => v.series.some((s) => s.mark === 'bar'))).toBe(true);
    }
  });
});

// ── RT9: Determinism Regression ──────────────────────────────────────────

describe('RT9: Determinism Regression', () => {
  it('RT9: same input produces identical spec 5x', async () => {
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const runtime = createRuntime();
      const result = await runtime.service.runQuery(GOLDEN_CASES[0].input);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        results.push(JSON.stringify({
          spec: result.spec,
          insight: result.insight,
          charts: result.charts.map((c) => ({ viewId: c.viewId, title: c.title })),
        }));
      }
    }
    expect(new Set(results).size).toBe(1);
  });
});

// ── Error Boundary: Duck Typing ──────────────────────────────────────────

describe('Error Boundary: Duck Typing', () => {
  it('structured error object (not instanceof Error) preserves code/message', async () => {
    const throwingInterpreter = {
      async interpretInitial(): Promise<DashboardSpec> {
        throw { code: 'MISSING_INSTRUMENT', message: '请指定要分析的股票', details: 'test' };
      },
      async interpretFollowUp(): Promise<never> {
        throw { code: 'AMBIGUOUS_INPUT', message: '输入信息不完整' };
      },
    };

    const service = createDashboardService(throwingInterpreter);
    const result = await service.runQuery('test');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('INTERPRETER_MISSING_INSTRUMENT');
      expect(result.error.message).toBe('请指定要分析的股票');
      expect(result.error.details).toBe('test');
    }
  });

  it('standard Error still falls back to INTERPRETER_ERROR', async () => {
    const throwingInterpreter = {
      async interpretInitial(): Promise<DashboardSpec> {
        throw new Error('something unexpected happened');
      },
      async interpretFollowUp(): Promise<never> {
        throw new Error('fail');
      },
    };

    const service = createDashboardService(throwingInterpreter);
    const result = await service.runQuery('test');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toBe('INTERPRETER_ERROR');
      expect(result.error.message).toBe('解读请求时发生错误');
      expect(result.error.details).toContain('something unexpected');
    }
  });
});

// ── Controller State Machine ─────────────────────────────────────────────

describe('Controller State Machine', () => {
  it('concurrent submission returns RUNTIME_BUSY', async () => {
    const runtime = createRuntime();
    runtime.controller.reset();

    // Start first command (don't await)
    const promise1 = runtime.controller.submitCommand(GOLDEN_CASES[0].input);

    // Immediately try second (should fail)
    const result2 = await runtime.controller.submitCommand(GOLDEN_CASES[1].input);
    expect(result2.status).toBe('error');
    if (result2.status === 'error') {
      expect(result2.error.code).toBe('RUNTIME_BUSY');
    }

    // Wait for first to complete
    await promise1;
  });
});
