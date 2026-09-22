/**
 * Block 4 + UI Handoff Hardening Tests — RT1-RT9 + RH1-RH8.
 *
 * RT1-RT9: Full NL → Interpreter → Service → Controller pipeline.
 * RH1-RH8: Observable state, race guard, public surface.
 */

import { describe, it, expect } from 'vitest';
import { createDashboardRuntime, createRuntimeWithInterpreter } from '../src/runtime/dashboard-runtime';
import { DeterministicInterpreter } from '../src/interpreter/deterministic-interpreter';
import { createDashboardService } from '../src/application/dashboard-service';
import { compareSpecSemantics } from '../src/interpreter/comparison';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import type { DashboardRunSuccess, PipelineEvent, DashboardControllerState } from '../src/application/contracts';
import type { DashboardSpec } from '../src/schema/dashboard-spec';

// ── Helper ───────────────────────────────────────────────────────────────

function createTestRuntime() {
  return createRuntimeWithInterpreter(new DeterministicInterpreter());
}

// ── RT1: Initial Runtime ─────────────────────────────────────────────────

describe('RT1: Initial Runtime — real NL → DashboardRunSuccess', () => {
  for (let i = 0; i < 5; i++) {
    it(`RT1-${i + 1}: G${i + 1} NL → success`, async () => {
      const rt = createTestRuntime();
      rt.controller.reset();
      const result = await rt.controller.submitCommand(GOLDEN_CASES[i].input);
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
  for (let i = 0; i < 5; i++) {
    if (!GOLDEN_CASES[i].patch || !GOLDEN_CASES[i].patchInput) continue;
    it(`RT2-${i + 1}: G${i + 1} initial + follow-up`, async () => {
      const rt = createTestRuntime();
      rt.controller.reset();

      const initResult = await rt.controller.submitCommand(GOLDEN_CASES[i].input);
      expect(initResult.status).toBe('success');

      const followResult = await rt.controller.submitCommand(GOLDEN_CASES[i].patchInput!);
      expect(followResult.status).toBe('success');
      if (followResult.status === 'success') {
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
    const rt = createTestRuntime();
    const events: PipelineEvent[] = [];

    await rt.service.runQuery(GOLDEN_CASES[0].input, {
      onEvent: (e) => events.push(e),
    });

    const stepPhases = events.map((e) => `${e.step}:${e.phase}`);
    expect(stepPhases).toContain('understand_request:start');
    expect(stepPhases).toContain('understand_request:success');
    expect(stepPhases).toContain('build_schema:start');
    expect(stepPhases).toContain('build_schema:success');
    expect(stepPhases).toContain('validate_schema:start');
    expect(stepPhases).toContain('render:success');

    const uStart = stepPhases.indexOf('understand_request:start');
    const bStart = stepPhases.indexOf('build_schema:start');
    expect(uStart).toBeLessThan(bStart);
  });
});

// ── RT4: Interpreter Failure Event ───────────────────────────────────────

describe('RT4: Interpreter Failure Event', () => {
  it('RT4: unsupported emits understand_request:error', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();
    const events: PipelineEvent[] = [];

    const result = await rt.service.runQuery('预测A公司明天收盘价', {
      onEvent: (e) => events.push(e),
    });

    expect(result.status).toBe('error');
    const stepPhases = events.map((e) => `${e.step}:${e.phase}`);
    expect(stepPhases).toContain('understand_request:start');
    expect(stepPhases).toContain('understand_request:error');
    expect(stepPhases.some((p) => p.startsWith('build_schema'))).toBe(false);
  });

  it('RT4b: error trace has skipped downstream steps', async () => {
    const rt = createTestRuntime();
    const result = await rt.service.runQuery('分析最近30天的收盘价');
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
  const rt = createTestRuntime();

  it('RT5-1: MISSING_INSTRUMENT preserved', async () => {
    const result = await rt.service.runQuery('分析最近30天的收盘价');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toContain('MISSING_INSTRUMENT');
      expect(result.error.message).not.toBe('解读请求时发生错误');
    }
  });

  it('RT5-2: UNSUPPORTED_CAPABILITY preserved', async () => {
    const result = await rt.service.runQuery('预测A公司明天收盘价');
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.code).toContain('UNSUPPORTED_CAPABILITY');
    }
  });
});

// ── RT6: Follow-up Failure Preserves Dashboard ───────────────────────────

describe('RT6: Follow-up Failure Preserves Dashboard', () => {
  it('RT6: unsupported follow-up preserves lastSuccess', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    const state1 = rt.controller.getState();
    expect(state1.lastSuccess).not.toBeNull();

    await rt.controller.submitCommand('预测明天走势');
    const state2 = rt.controller.getState();
    expect(state2.lastSuccess).not.toBeNull();
    expect(state2.lastSuccess?.spec.instrument.symbol).toBe('MOCK.A');
    expect(state2.latestError).not.toBeNull();
  });
});

// ── RT7: Reset / New Analysis ────────────────────────────────────────────

describe('RT7: Reset / New Analysis', () => {
  it('RT7: reset clears state, next command is initial', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    expect(rt.controller.getState().commandContext).toBe('refine');

    rt.controller.reset();
    const state2 = rt.controller.getState();
    expect(state2.lastSuccess).toBeNull();
    expect(state2.latestError).toBeNull();
    expect(state2.commandContext).toBe('initial');
    expect(state2.running).toBe(false);

    const result = await rt.controller.submitCommand(GOLDEN_CASES[1].input);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.spec.instrument.symbol).toBe('MOCK.B');
    }
  });
});

// ── RT8: Example Prompt Uses Runtime ─────────────────────────────────────

describe('RT8: Example Prompt Uses Runtime', () => {
  it('RT8: submitCommand goes through real interpreter', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    const result = await rt.controller.submitCommand(GOLDEN_CASES[2].input);
    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.spec.instrument.symbol).toBe('MOCK.A');
      expect(result.spec.timeRange.count).toBe(15);
    }
  });
});

// ── RT9: Determinism Regression ──────────────────────────────────────────

describe('RT9: Determinism Regression', () => {
  it('RT9: same input produces identical spec 5x', async () => {
    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const rt = createTestRuntime();
      const result = await rt.service.runQuery(GOLDEN_CASES[0].input);
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        results.push(JSON.stringify({ spec: result.spec, insight: result.insight }));
      }
    }
    expect(new Set(results).size).toBe(1);
  });
});

// ── Error Boundary: Duck Typing ──────────────────────────────────────────

describe('Error Boundary: Duck Typing', () => {
  it('structured error preserves code/message', async () => {
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
    }
  });

  it('standard Error falls back to INTERPRETER_ERROR', async () => {
    const throwingInterpreter = {
      async interpretInitial(): Promise<DashboardSpec> {
        throw new Error('unexpected');
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
    }
  });
});

// ── RH1: Subscribe receives running state ────────────────────────────────

describe('RH1: Subscribe receives state updates during run', () => {
  it('RH1: subscriber sees running=true then running=false', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    const states: boolean[] = [];
    const unsub = rt.controller.subscribe((s) => {
      states.push(s.running);
    });

    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    unsub();

    // Should have seen running=true at some point, then running=false
    expect(states).toContain(true);
    expect(states).toContain(false);
    // Last state should be false (not running)
    expect(states[states.length - 1]).toBe(false);
  });
});

// ── RH2: Pipeline events visible to subscriber ───────────────────────────

describe('RH2: Pipeline events visible to subscriber', () => {
  it('RH2: subscriber sees intermediate pipeline steps', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    const pipelineSnapshots: string[][] = [];
    const unsub = rt.controller.subscribe((s) => {
      pipelineSnapshots.push(s.pipeline.map((p) => `${p.id}:${p.status}`));
    });

    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    unsub();

    // At some point, at least one step should be 'running'
    const hasRunning = pipelineSnapshots.some((ps) =>
      ps.some((p) => p.endsWith(':running')),
    );
    expect(hasRunning).toBe(true);

    // Final snapshot should have all steps as 'success'
    const lastSnapshot = pipelineSnapshots[pipelineSnapshots.length - 1];
    expect(lastSnapshot.every((p) => p.endsWith(':success'))).toBe(true);
  });
});

// ── RH3: Success → subscriber sees lastSuccess ───────────────────────────

describe('RH3: Success → subscriber sees lastSuccess', () => {
  it('RH3: subscriber receives non-null lastSuccess on success', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    let lastSeenSuccess: DashboardRunSuccess | null = null;
    const unsub = rt.controller.subscribe((s) => {
      if (s.lastSuccess) lastSeenSuccess = s.lastSuccess;
    });

    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    unsub();

    expect(lastSeenSuccess).not.toBeNull();
    expect(lastSeenSuccess?.spec.instrument.symbol).toBe('MOCK.A');
  });
});

// ── RH4: Failure → subscriber sees latestError, lastSuccess preserved ────

describe('RH4: Failure preserves lastSuccess for subscriber', () => {
  it('RH4: follow-up failure keeps lastSuccess, sets latestError', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    // Initial success
    await rt.controller.submitCommand(GOLDEN_CASES[0].input);

    const states: DashboardControllerState[] = [];
    const unsub = rt.controller.subscribe((s) => {
      states.push({ ...s });
    });

    // Follow-up failure
    await rt.controller.submitCommand('预测明天走势');
    unsub();

    // latestError should be set
    const errorState = states.find((s) => s.latestError !== null);
    expect(errorState).toBeDefined();
    expect(errorState?.latestError?.error.code).toContain('UNSUPPORTED');

    // lastSuccess should still be G1
    expect(errorState?.lastSuccess?.spec.instrument.symbol).toBe('MOCK.A');
  });
});

// ── RH5: Unsubscribe stops notifications ─────────────────────────────────

describe('RH5: Unsubscribe stops notifications', () => {
  it('RH5: no more updates after unsubscribe', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    let count = 0;
    const unsub = rt.controller.subscribe(() => { count++; });

    // Unsubscribe immediately
    unsub();

    const countAfterUnsub = count;

    // Do a run — should not increase count
    await rt.controller.submitCommand(GOLDEN_CASES[0].input);

    expect(count).toBe(countAfterUnsub);
  });
});

// ── RH6: Reset during in-flight run ─────────────────────────────────────

describe('RH6: Reset during in-flight run', () => {
  it('RH6: stale completion does not overwrite fresh state', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    // Start a run (don't await yet)
    const promise = rt.controller.submitCommand(GOLDEN_CASES[0].input);

    // Immediately reset
    rt.controller.reset();
    const stateAfterReset = rt.controller.getState();
    expect(stateAfterReset.lastSuccess).toBeNull();
    expect(stateAfterReset.commandContext).toBe('initial');

    // Wait for the old run to complete
    const oldResult = await promise;

    // The old result should have succeeded (it ran to completion)
    expect(oldResult.status).toBe('success');

    // But the controller state should still be reset (no stale write)
    const stateAfterOldComplete = rt.controller.getState();
    expect(stateAfterOldComplete.lastSuccess).toBeNull();
    expect(stateAfterOldComplete.commandContext).toBe('initial');
  });
});

// ── RH7: Concurrent submit ───────────────────────────────────────────────

describe('RH7: Concurrent submit', () => {
  it('RH7: second submit returns RUNTIME_BUSY, first completes normally', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();

    // Start first run (don't await)
    const promise1 = rt.controller.submitCommand(GOLDEN_CASES[0].input);

    // Immediately try second (should fail)
    const result2 = await rt.controller.submitCommand(GOLDEN_CASES[1].input);
    expect(result2.status).toBe('error');
    if (result2.status === 'error') {
      expect(result2.error.code).toBe('RUNTIME_BUSY');
    }

    // First should complete normally
    const result1 = await promise1;
    expect(result1.status).toBe('success');
    if (result1.status === 'success') {
      expect(result1.spec.instrument.symbol).toBe('MOCK.A');
    }
  });
});

// ── RH8: Product runtime does not expose service ─────────────────────────

describe('RH8: Product runtime public surface', () => {
  it('RH8: createDashboardRuntime does not expose service', async () => {
    const rt = createDashboardRuntime();
    // Should only have 'controller' key
    expect(Object.keys(rt)).toEqual(['controller']);
    expect((rt as any).service).toBeUndefined();
  });

  it('RH8b: createRuntimeWithInterpreter exposes service (for tests)', async () => {
    const throwingInterpreter = {
      async interpretInitial(): Promise<DashboardSpec> {
        throw new Error('test');
      },
      async interpretFollowUp(): Promise<never> {
        throw new Error('test');
      },
    };
    const rt = createRuntimeWithInterpreter(throwingInterpreter);
    expect(rt.service).toBeDefined();
    expect(rt.controller).toBeDefined();
  });
});

// ── RS1-RS4: Snapshot Stability (P0 React integration fix) ───────────────

describe('RS: Snapshot Stability', () => {
  it('RS1: getState returns referentially stable snapshot when no mutation', () => {
    const rt = createTestRuntime();
    rt.controller.reset();
    const a = rt.controller.getState();
    const b = rt.controller.getState();
    expect(a).toBe(b);
  });

  it('RS2: new snapshot after state change', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();
    const before = rt.controller.getState();
    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    const after = rt.controller.getState();
    expect(after).not.toBe(before);
  });

  it('RS3: subscriber receives new stable snapshot on state change', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();
    const snapshots: DashboardControllerState[] = [];
    const unsub = rt.controller.subscribe(() => {
      snapshots.push(rt.controller.getState());
    });
    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    unsub();
    // All snapshots after mutation should be referentially different from each other
    // (because state changes on each event)
    // But getState within the same tick should return same ref
    // At minimum, final snapshot should have lastSuccess
    expect(snapshots.length).toBeGreaterThan(0);
    const lastSnap = snapshots[snapshots.length - 1];
    expect(lastSnap.lastSuccess).not.toBeNull();
  });

  it('RS4: reset changes snapshot, then stable again', async () => {
    const rt = createTestRuntime();
    rt.controller.reset();
    await rt.controller.submitCommand(GOLDEN_CASES[0].input);
    const beforeReset = rt.controller.getState();
    rt.controller.reset();
    const afterReset = rt.controller.getState();
    expect(afterReset).not.toBe(beforeReset);
    // After reset, consecutive getState calls return same ref
    const a = rt.controller.getState();
    const b = rt.controller.getState();
    expect(a).toBe(b);
  });
});
