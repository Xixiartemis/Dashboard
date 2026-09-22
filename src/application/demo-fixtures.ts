/**
 * Demo Fixtures — real pipeline outputs for Google Studio UI development.
 *
 * Every fixture is produced by executing the REAL Domain pipeline.
 * NO hand-written ECharts options, NO hardcoded insight numbers.
 *
 * Empty data fixture uses a DataAvailabilityChecker seam to inject
 * "no data" without modifying Frozen Domain (Registry/Dataset).
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import { GOLDEN_CASES } from '../fixtures/golden-cases';
import { NEGATIVE_CASES } from '../fixtures/negative-cases';
import { executeSpec, executeDownstreamPipeline } from './materializer';
import type { DataAvailabilityChecker } from './materializer';
import { applyPatch } from '../patch/apply-patch';
import type {
  DemoFixture,
  DemoFailureFixture,
  DashboardRunSuccess,
  DashboardRunFailure,
  PipelineStepSnapshot,
} from './contracts';

// ── Data availability checker: always returns empty ───────────────────────

const emptyDataChecker: DataAvailabilityChecker = {
  check(_spec: DashboardSpec): number {
    return 0;
  },
};

// ── Golden Fixtures (G1-G5 initial + follow-up) ──────────────────────────

function materializeGoldenFixtures(): DemoFixture[] {
  return GOLDEN_CASES.map((gc) => {
    const initialResult = executeSpec(gc.expectedSpec, gc.input) as DashboardRunSuccess;

    let followUpResult: DashboardRunFailure | DashboardRunSuccess | undefined;
    if (gc.patch && gc.patchInput) {
      const patchResult = applyPatch(gc.expectedSpec, gc.patch);
      if (patchResult.ok) {
        const upstreamTrace: PipelineStepSnapshot[] = [
          { id: 'understand_request', status: 'success', message: `patch=${gc.patch.op}` },
          { id: 'build_schema', status: 'success', message: `patch=${gc.patch.op} applied` },
        ];
        followUpResult = executeDownstreamPipeline(patchResult.spec, {
          trace: [
            { id: 'validate_schema', status: 'pending' },
            { id: 'load_data', status: 'pending' },
            { id: 'analyze', status: 'pending' },
            { id: 'render', status: 'pending' },
          ],
          input: gc.patchInput,
          upstreamTrace,
        });
      } else {
        followUpResult = {
          status: 'error',
          input: gc.patchInput,
          stage: 'build_schema',
          error: {
            code: patchResult.errors[0]?.code ?? 'PATCH_FAILED',
            message: patchResult.errors[0]?.message ?? 'Patch 失败',
            recoverable: true,
          },
          trace: [
            { id: 'understand_request', status: 'success' },
            { id: 'build_schema', status: 'error' },
            { id: 'validate_schema', status: 'skipped' },
            { id: 'load_data', status: 'skipped' },
            { id: 'analyze', status: 'skipped' },
            { id: 'render', status: 'skipped' },
          ],
        };
      }
    }

    return {
      id: gc.id,
      name: gc.name,
      prompt: gc.input,
      initialResult,
      followUpPrompt: gc.patchInput,
      followUpResult,
    };
  });
}

// ── Failure Fixtures ──────────────────────────────────────────────────────

function materializeFailureFixtures(): DemoFailureFixture[] {
  const failures: DemoFailureFixture[] = [];

  // Failure 1: validation_error — N1 (unknown instrument)
  const n1 = NEGATIVE_CASES.find((c) => c.id === 'N1')!;
  if (n1.spec) {
    // Run through real pipeline — it will fail at validate_schema
    const result = executeSpec(n1.spec, '分析 XYZ 公司的走势');
    failures.push({
      id: 'validation_error',
      name: '校验失败：未知股票',
      description: '使用不存在的股票代码，触发语义校验失败',
      result: result as DashboardRunFailure,
    });
  }

  // Failure 2: empty_data — valid spec + empty data checker seam
  // Use a valid Golden Case spec, but inject empty data checker
  // so it passes validation but fails at load_data with EMPTY_DATA
  const validSpec = GOLDEN_CASES[0].expectedSpec;
  const emptyResult = executeSpec(
    validSpec,
    '查看无数据公司的走势',
    undefined,
    emptyDataChecker, // ← seam: returns 0 records
  );
  failures.push({
    id: 'empty_data',
    name: '数据不存在',
    description: '通过数据可用性检查注入空数据，触发 load_data 阶段 EMPTY_DATA',
    result: emptyResult as DashboardRunFailure,
  });

  return failures;
}

// ── Lazy-initialized singleton fixtures ───────────────────────────────────

let _goldenFixtures: DemoFixture[] | null = null;
let _failureFixtures: DemoFailureFixture[] | null = null;

export function getDemoFixtures(): DemoFixture[] {
  if (!_goldenFixtures) {
    _goldenFixtures = materializeGoldenFixtures();
  }
  return _goldenFixtures;
}

export function getFailureFixtures(): DemoFailureFixture[] {
  if (!_failureFixtures) {
    _failureFixtures = materializeFailureFixtures();
  }
  return _failureFixtures;
}

export function getAllFixtures(): {
  golden: DemoFixture[];
  failures: DemoFailureFixture[];
} {
  return {
    golden: getDemoFixtures(),
    failures: getFailureFixtures(),
  };
}
