/**
 * Materializer — executes a validated DashboardSpec through the real Domain pipeline
 * to produce a DashboardRunSuccess.
 *
 * This is the single execution path: Golden Fixtures, Demo, and future Runtime
 * ALL go through this function. No shortcut, no hand-written data.
 *
 * Pipeline: validate → load data → analyze → insight → render → DashboardRunSuccess
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import { validateStructure } from '../validation/structural';
import { validateSemantics } from '../validation/semantic';
import { applyPatch } from '../patch/apply-patch';
import { runAnalytics, computeInsight } from '../analytics/engine';
import { getMetric } from '../registries/metrics';
import { compileViewToEChartsOption } from '../renderer/echarts-probe';
import { MANIFEST } from '../data/manifest';
import type {
  DashboardRunSuccess,
  DashboardRunFailure,
  DashboardChartResult,
  DashboardInsightResult,
  DashboardInsightItem,
  DashboardDataProvenance,
  PipelineStepSnapshot,
  PipelineEvent,
  RunOptions,
  PipelineStepId,
} from './contracts';

// ── Trace builder ─────────────────────────────────────────────────────────

function createTrace(): PipelineStepSnapshot[] {
  const steps: PipelineStepId[] = [
    'understand_request',
    'build_schema',
    'validate_schema',
    'load_data',
    'analyze',
    'render',
  ];
  return steps.map((id) => ({ id, status: 'pending' }));
}

function emit(
  options: RunOptions | undefined,
  step: PipelineStepId,
  phase: PipelineEvent['phase'],
  message?: string,
) {
  options?.onEvent?.({ step, phase, message });
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

// ── Failure helper ────────────────────────────────────────────────────────

function failure(
  input: string,
  stage: PipelineStepId,
  code: string,
  message: string,
  details: string | undefined,
  recoverable: boolean,
  trace: PipelineStepSnapshot[],
): DashboardRunFailure {
  return { status: 'error', input, stage, error: { code, message, details, recoverable }, trace };
}

// ── Provenance builder ────────────────────────────────────────────────────

function buildProvenance(spec: DashboardSpec): DashboardDataProvenance {
  return {
    datasetId: spec.dataSource.datasetId,
    asOf: spec.dataSource.asOf,
    timezone: spec.dataSource.timezone,
    calendar: MANIFEST.calendar,
    instrument: {
      symbol: spec.instrument.symbol,
      displayName: spec.instrument.displayName,
    },
    timeRange: {
      count: spec.timeRange.count,
      basis: spec.timeRange.basis,
    },
  };
}

// ── Insight builder ───────────────────────────────────────────────────────

function buildInsightResult(spec: DashboardSpec, insightData: ReturnType<typeof computeInsight>): DashboardInsightResult {
  const items: DashboardInsightItem[] = [];

  if (insightData.period_change) {
    const pc = insightData.period_change;
    const def = getMetric(pc.metric);
    items.push({
      type: 'period_change',
      metric: pc.metric,
      metricLabel: def?.label ?? pc.metric,
      startValue: pc.startValue,
      endValue: pc.endValue,
      changePct: pc.changePct,
      unit: def?.unit ?? '',
    });
  }

  if (insightData.rank_results) {
    for (const [, rr] of insightData.rank_results) {
      const transform = spec.transforms.find((t) => t.id === rr.transformRef);
      const def = getMetric(rr.metric);
      items.push({
        type: 'rank',
        transformId: rr.transformRef,
        metric: rr.metric,
        metricLabel: def?.label ?? rr.metric,
        order: transform?.order ?? 'desc',
        limit: transform?.limit ?? rr.records.length,
        points: rr.records.map((r) => ({
          date: r.date,
          value: r.value,
          unit: def?.unit ?? '',
        })),
      });
    }
  }

  return {
    intentSummary: spec.insight.intentSummary,
    items,
  };
}

// ── Main materializer ─────────────────────────────────────────────────────

export function executeSpec(
  spec: DashboardSpec,
  input: string,
  options?: RunOptions,
): DashboardRunSuccess | DashboardRunFailure {
  const trace = createTrace();

  // ── understand_request ──
  emit(options, 'understand_request', 'start');
  markStep(trace, 'understand_request', 'running');
  // For materialized specs, "understand" is instant — the spec IS the understanding
  markStep(trace, 'understand_request', 'success');
  emit(options, 'understand_request', 'success');

  // ── build_schema ──
  emit(options, 'build_schema', 'start');
  markStep(trace, 'build_schema', 'running');
  // Spec is already built (either from Interpreter or from Golden Case)
  markStep(trace, 'build_schema', 'success', `schemaVersion=${spec.schemaVersion}`);
  emit(options, 'build_schema', 'success', `schemaVersion=${spec.schemaVersion}`);

  // ── validate_schema ──
  emit(options, 'validate_schema', 'start');
  markStep(trace, 'validate_schema', 'running');
  const structResult = validateStructure(spec);
  if (!structResult.ok) {
    markStep(trace, 'validate_schema', 'error', structResult.errors[0]?.message);
    emit(options, 'validate_schema', 'error', structResult.errors[0]?.message);
    return failure(input, 'validate_schema',
      structResult.errors[0]?.code ?? 'STRUCTURAL_VALIDATION_FAILED',
      structResult.errors[0]?.message ?? '结构校验失败',
      structResult.errors.map((e) => `${e.code}: ${e.details ?? e.message}`).join('; '),
      true, trace);
  }
  const validatedSpec = structResult.spec;

  const semResult = validateSemantics(validatedSpec);
  if (!semResult.ok) {
    markStep(trace, 'validate_schema', 'error', semResult.errors[0]?.message);
    emit(options, 'validate_schema', 'error', semResult.errors[0]?.message);
    return failure(input, 'validate_schema',
      semResult.errors[0]?.code ?? 'SEMANTIC_VALIDATION_FAILED',
      semResult.errors[0]?.message ?? '语义校验失败',
      semResult.errors.map((e) => `${e.code}: ${e.details ?? e.message}`).join('; '),
      true, trace);
  }
  markStep(trace, 'validate_schema', 'success');
  emit(options, 'validate_schema', 'success');

  // ── load_data ──
  emit(options, 'load_data', 'start');
  markStep(trace, 'load_data', 'running');
  const analytics = runAnalytics(validatedSpec);
  if (analytics.isEmpty) {
    markStep(trace, 'load_data', 'error', '无可用数据');
    emit(options, 'load_data', 'error', '无可用数据');
    return failure(input, 'load_data', 'EMPTY_DATA', '查询结果为空，无可用数据',
      `instrument=${validatedSpec.instrument.symbol}`, false, trace);
  }
  markStep(trace, 'load_data', 'success', `${analytics.series.length} records`);
  emit(options, 'load_data', 'success', `${analytics.series.length} records`);

  // ── analyze ──
  emit(options, 'analyze', 'start');
  markStep(trace, 'analyze', 'running');
  const insightData = computeInsight(validatedSpec, analytics);
  const insightResult = buildInsightResult(validatedSpec, insightData);
  markStep(trace, 'analyze', 'success', `${insightResult.items.length} insight items`);
  emit(options, 'analyze', 'success', `${insightResult.items.length} insight items`);

  // ── render ──
  emit(options, 'render', 'start');
  markStep(trace, 'render', 'running');
  const charts: DashboardChartResult[] = [];
  for (const view of validatedSpec.views) {
    const compileResult = compileViewToEChartsOption(view, analytics.series, analytics.transforms);
    if (!compileResult.ok) {
      markStep(trace, 'render', 'error', compileResult.reason);
      emit(options, 'render', 'error', compileResult.reason);
      return failure(input, 'render', 'RENDER_FAILED', '图表渲染失败',
        compileResult.reason, false, trace);
    }
    charts.push({
      viewId: view.id,
      title: view.title,
      option: compileResult.option,
    });
  }
  markStep(trace, 'render', 'success', `${charts.length} charts`);
  emit(options, 'render', 'success', `${charts.length} charts`);

  return {
    status: 'success',
    input,
    spec: validatedSpec,
    charts,
    insight: insightResult,
    provenance: buildProvenance(validatedSpec),
    trace,
  };
}

// ── Follow-up materializer ────────────────────────────────────────────────

export function executeFollowUp(
  currentSpec: DashboardSpec,
  patch: DashboardPatch,
  input: string,
  options?: RunOptions,
): DashboardRunSuccess | DashboardRunFailure {
  const trace = createTrace();

  // ── understand_request ──
  emit(options, 'understand_request', 'start');
  markStep(trace, 'understand_request', 'running');
  markStep(trace, 'understand_request', 'success', `patch=${patch.op}`);
  emit(options, 'understand_request', 'success', `patch=${patch.op}`);

  // ── build_schema (apply patch) ──
  emit(options, 'build_schema', 'start');
  markStep(trace, 'build_schema', 'running');
  const patchResult = applyPatch(currentSpec, patch);
  if (!patchResult.ok) {
    markStep(trace, 'build_schema', 'error', 'Patch 应用失败');
    emit(options, 'build_schema', 'error', 'Patch 应用失败');
    return failure(input, 'build_schema',
      patchResult.errors[0]?.code ?? 'PATCH_FAILED',
      patchResult.errors[0]?.message ?? '修改应用失败',
      patchResult.errors.map((e) => `${e.code}: ${e.details ?? e.message}`).join('; '),
      true, trace);
  }
  markStep(trace, 'build_schema', 'success', `patch=${patch.op} applied`);
  emit(options, 'build_schema', 'success');

  // Continue with the rest of the pipeline using the patched spec
  const result = executeSpec(patchResult.spec, input, options);
  // Merge traces: prepend our understand + build steps
  const mergedTrace = [
    ...trace.filter((s) => s.id === 'understand_request' || s.id === 'build_schema'),
    ...result.trace.filter((s) => s.id !== 'understand_request' && s.id !== 'build_schema'),
  ];
  return { ...result, trace: mergedTrace };
}
