/**
 * DashboardService — async public API and orchestration owner.
 *
 * Responsibilities:
 * - Emits ALL PipelineEvent (understand_request, build_schema, then delegates downstream)
 * - Catches ALL interpreter exceptions → maps to DashboardRunFailure
 * - UI never sees a rejected Promise from public API
 * - Follow-up does NOT re-emit understand/build (only once per call)
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import type {
  DashboardService,
  DashboardInterpreterPort,
  DashboardRunResult,
  DashboardRunFailure,
  RunOptions,
  PipelineStepSnapshot,
  PipelineStepId,
} from './contracts';
import { executeDownstreamPipeline, type DataAvailabilityChecker } from './materializer';

const UPSTREAM_STEPS: PipelineStepId[] = ['understand_request', 'build_schema'];
const DOWNSTREAM_STEPS: PipelineStepId[] = ['validate_schema', 'load_data', 'analyze', 'render'];

function emit(
  options: RunOptions | undefined,
  step: PipelineStepId,
  phase: 'start' | 'success' | 'error',
  message?: string,
) {
  options?.onEvent?.({ step, phase, message });
}

function createUpstreamTrace(): PipelineStepSnapshot[] {
  return UPSTREAM_STEPS.map((id) => ({ id, status: 'pending' }));
}

function createDownstreamTrace(): PipelineStepSnapshot[] {
  return DOWNSTREAM_STEPS.map((id) => ({ id, status: 'pending' }));
}

function markStep(
  trace: PipelineStepSnapshot[],
  stepId: PipelineStepId,
  status: PipelineStepSnapshot['status'],
  message?: string,
): void {
  const step = trace.find((s) => s.id === stepId);
  if (step) {
    step.status = status;
    if (message) step.message = message;
  }
}

function interpreterFailure(
  input: string,
  stage: PipelineStepId,
  error: unknown,
  upstreamTrace: PipelineStepSnapshot[],
): DashboardRunFailure {
  let code = 'INTERPRETER_ERROR';
  let message = '解读请求时发生错误';
  let details: string | undefined;

  if (error instanceof Error) {
    details = error.message;
    // Map known error patterns to user-friendly messages
    if (error.message.includes('timeout') || error.message.includes('Timeout')) {
      code = 'INTERPRETER_TIMEOUT';
      message = '理解请求超时，请重试';
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      code = 'INTERPRETER_NETWORK_ERROR';
      message = '网络连接失败，请检查网络后重试';
    }
  }

  const fullTrace: PipelineStepSnapshot[] = [
    ...upstreamTrace,
    ...DOWNSTREAM_STEPS.map((id) => ({ id, status: 'skipped' as const })),
  ];
  // Mark the failing upstream step as error
  const failStep = fullTrace.find((s) => s.id === stage);
  if (failStep) {
    failStep.status = 'error';
    failStep.message = message;
  }

  return { status: 'error', input, stage, error: { code, message, details, recoverable: true }, trace: fullTrace };
}

export function createDashboardService(
  interpreter?: DashboardInterpreterPort,
  dataChecker?: DataAvailabilityChecker,
): DashboardService {
  const interp = interpreter ?? {
    async interpretInitial(): Promise<DashboardSpec> {
      throw new Error('Interpreter not yet implemented.');
    },
    async interpretFollowUp(): Promise<DashboardPatch> {
      throw new Error('Interpreter not yet implemented.');
    },
  };

  return {
    async runQuery(input: string, options?: RunOptions): Promise<DashboardRunResult> {
      const upstreamTrace = createUpstreamTrace();
      const downstreamTrace = createDownstreamTrace();

      // ── understand_request (wraps interpreter execution) ──
      emit(options, 'understand_request', 'start');
      markStep(upstreamTrace, 'understand_request', 'running');

      let spec: DashboardSpec;
      try {
        spec = await interp.interpretInitial(input);
      } catch (error) {
        markStep(upstreamTrace, 'understand_request', 'error');
        return interpreterFailure(input, 'understand_request', error, upstreamTrace);
      }
      markStep(upstreamTrace, 'understand_request', 'success');
      emit(options, 'understand_request', 'success');

      // ── build_schema ──
      emit(options, 'build_schema', 'start');
      markStep(upstreamTrace, 'build_schema', 'running');
      markStep(upstreamTrace, 'build_schema', 'success', `schemaVersion=${spec.schemaVersion}`);
      emit(options, 'build_schema', 'success', `schemaVersion=${spec.schemaVersion}`);

      // ── downstream: validate → load → analyze → render ──
      return executeDownstreamPipeline(spec, {
        trace: downstreamTrace,
        options,
        input,
        upstreamTrace,
      }, dataChecker);
    },

    async runFollowUp(
      currentSpec: DashboardSpec,
      input: string,
      options?: RunOptions,
    ): Promise<DashboardRunResult> {
      const upstreamTrace = createUpstreamTrace();
      const downstreamTrace = createDownstreamTrace();

      // ── understand_request (wraps interpreter execution) ──
      emit(options, 'understand_request', 'start');
      markStep(upstreamTrace, 'understand_request', 'running');

      let patch: DashboardPatch;
      try {
        patch = await interp.interpretFollowUp(currentSpec, input);
      } catch (error) {
        markStep(upstreamTrace, 'understand_request', 'error');
        return interpreterFailure(input, 'understand_request', error, upstreamTrace);
      }
      markStep(upstreamTrace, 'understand_request', 'success', `patch=${patch.op}`);
      emit(options, 'understand_request', 'success', `patch=${patch.op}`);

      // ── build_schema (apply patch) ──
      emit(options, 'build_schema', 'start');
      markStep(upstreamTrace, 'build_schema', 'running');

      const { applyPatch } = await import('../patch/apply-patch');
      const patchResult = applyPatch(currentSpec, patch);
      if (!patchResult.ok) {
        markStep(upstreamTrace, 'build_schema', 'error', 'Patch 应用失败');
        emit(options, 'build_schema', 'error', 'Patch 应用失败');
        const fullTrace = [...upstreamTrace, ...downstreamTrace.map((s) => ({ ...s, status: 'skipped' as const }))];
        return {
          status: 'error', input, stage: 'build_schema',
          error: {
            code: patchResult.errors[0]?.code ?? 'PATCH_FAILED',
            message: patchResult.errors[0]?.message ?? '修改应用失败',
            details: patchResult.errors.map((e) => `${e.code}: ${e.details ?? e.message}`).join('; '),
            recoverable: true,
          },
          trace: fullTrace,
        };
      }
      markStep(upstreamTrace, 'build_schema', 'success', `patch=${patch.op} applied`);
      emit(options, 'build_schema', 'success');

      // ── downstream: validate → load → analyze → render ──
      return executeDownstreamPipeline(patchResult.spec, {
        trace: downstreamTrace,
        options,
        input,
        upstreamTrace,
      }, dataChecker);
    },
  };
}
