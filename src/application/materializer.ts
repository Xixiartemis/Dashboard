/**
 * Materializer — downstream pipeline execution.
 *
 * Scope: validate_schema → load_data → analyze → render
 *
 * understand_request and build_schema are owned by DashboardService
 * (the orchestration owner), NOT this module.
 *
 * Data dependency seam: default uses real Domain getDataset().
 * Inject custom checker for test/demo scenarios (e.g. empty data).
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import { validateStructure } from '../validation/structural';
import { validateSemantics } from '../validation/semantic';
import { runAnalytics, computeInsight } from '../analytics/engine';
import { getDataset } from '../data/mock-dataset';
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

// ── Data availability seam ────────────────────────────────────────────────

export interface DataAvailabilityChecker {
  /** Returns record count if data exists, 0 if empty. */
  check(spec: DashboardSpec): number;
}

/** Default: uses real Domain getDataset(). */
const defaultDataChecker: DataAvailabilityChecker = {
  check(spec: DashboardSpec): number {
    const raw = getDataset(spec.instrument.symbol);
    return raw?.length ?? 0;
  },
};

// ── Internal helpers ──────────────────────────────────────────────────────

const DOWNSTREAM_STEPS: PipelineStepId[] = [
  'validate_schema',
  'load_data',
  'analyze',
  'render',
];

function createDownstreamTrace(): PipelineStepSnapshot[] {
  return DOWNSTREAM_STEPS.map((id) => ({ id, status: 'pending' }));
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

// failure helper removed — use mergeAndFail instead

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

// ── Downstream pipeline (shared by initial + follow-up) ───────────────────

export interface PipelineContext {
  trace: PipelineStepSnapshot[];
  options?: RunOptions;
  input: string;
  /** Upstream steps already completed (for trace merging). */
  upstreamTrace?: PipelineStepSnapshot[];
}

/**
 * Execute the downstream pipeline: validate → load → analyze → render.
 * Returns DashboardRunSuccess or DashboardRunFailure.
 *
 * upstreamTrace is prepended to the returned trace for complete pipeline view.
 */
export function executeDownstreamPipeline(
  spec: DashboardSpec,
  ctx: PipelineContext,
  dataChecker?: DataAvailabilityChecker,
): DashboardRunSuccess | DashboardRunFailure {
  const { trace, options, input } = ctx;
  const checker = dataChecker ?? defaultDataChecker;

  // ── validate_schema ──
  emit(options, 'validate_schema', 'start');
  markStep(trace, 'validate_schema', 'running');

  const structResult = validateStructure(spec);
  if (!structResult.ok) {
    markStep(trace, 'validate_schema', 'error', structResult.errors[0]?.message);
    emit(options, 'validate_schema', 'error', structResult.errors[0]?.message);
    return mergeAndFail(input, 'validate_schema',
      structResult.errors[0]?.code ?? 'STRUCTURAL_VALIDATION_FAILED',
      structResult.errors[0]?.message ?? '结构校验失败',
      structResult.errors.map((e) => `${e.code}: ${e.details ?? e.message}`).join('; '),
      true, ctx);
  }
  const validatedSpec = structResult.spec;

  const semResult = validateSemantics(validatedSpec);
  if (!semResult.ok) {
    markStep(trace, 'validate_schema', 'error', semResult.errors[0]?.message);
    emit(options, 'validate_schema', 'error', semResult.errors[0]?.message);
    return mergeAndFail(input, 'validate_schema',
      semResult.errors[0]?.code ?? 'SEMANTIC_VALIDATION_FAILED',
      semResult.errors[0]?.message ?? '语义校验失败',
      semResult.errors.map((e) => `${e.code}: ${e.details ?? e.message}`).join('; '),
      true, ctx);
  }
  markStep(trace, 'validate_schema', 'success');
  emit(options, 'validate_schema', 'success');

  // ── load_data (data availability check only) ──
  emit(options, 'load_data', 'start');
  markStep(trace, 'load_data', 'running');
  const recordCount = checker.check(validatedSpec);
  if (recordCount === 0) {
    markStep(trace, 'load_data', 'error', '无可用数据');
    emit(options, 'load_data', 'error', '无可用数据');
    return mergeAndFail(input, 'load_data', 'EMPTY_DATA', '查询结果为空，无可用数据',
      `instrument=${validatedSpec.instrument.symbol}`, false, ctx);
  }
  markStep(trace, 'load_data', 'success', `${recordCount} records available`);
  emit(options, 'load_data', 'success', `${recordCount} records`);

  // ── analyze (analytics + insight) ──
  emit(options, 'analyze', 'start');
  markStep(trace, 'analyze', 'running');
  const analytics = runAnalytics(validatedSpec);
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
      return mergeAndFail(input, 'render', 'RENDER_FAILED', '图表渲染失败',
        compileResult.reason, false, ctx);
    }
    charts.push({ viewId: view.id, title: view.title, option: compileResult.option });
  }
  markStep(trace, 'render', 'success', `${charts.length} charts`);
  emit(options, 'render', 'success', `${charts.length} charts`);

  // Merge upstream trace
  const fullTrace = ctx.upstreamTrace
    ? [...ctx.upstreamTrace, ...trace]
    : trace;

  return {
    status: 'success',
    input,
    spec: validatedSpec,
    charts,
    insight: insightResult,
    provenance: buildProvenance(validatedSpec),
    trace: fullTrace,
  };
}

/** Merge upstream trace + downstream trace for failure results. */
function mergeAndFail(
  input: string,
  stage: PipelineStepId,
  code: string,
  message: string,
  details: string | undefined,
  recoverable: boolean,
  ctx: PipelineContext,
): DashboardRunFailure {
  // Mark all steps after the failing one as skipped
  const stepOrder: PipelineStepId[] = ['validate_schema', 'load_data', 'analyze', 'render'];
  const failIdx = stepOrder.indexOf(stage);
  for (let i = failIdx + 1; i < stepOrder.length; i++) {
    const step = ctx.trace.find((s) => s.id === stepOrder[i]);
    if (step && step.status === 'pending') step.status = 'skipped';
  }
  const fullTrace = ctx.upstreamTrace
    ? [...ctx.upstreamTrace, ...ctx.trace]
    : ctx.trace;
  return { status: 'error', input, stage, error: { code, message, details, recoverable }, trace: fullTrace };
}

// ── Convenience: full pipeline for direct use (tests, fixtures) ───────────

/**
 * Execute a complete pipeline from a materialized spec.
 * Creates upstream trace steps (understand_request, build_schema as instant/success)
 * then runs the downstream pipeline.
 *
 * This is used by demo-fixtures and tests.
 * DashboardService does its own orchestration.
 */
export function executeSpec(
  spec: DashboardSpec,
  input: string,
  options?: RunOptions,
  dataChecker?: DataAvailabilityChecker,
): DashboardRunSuccess | DashboardRunFailure {
  // Build upstream trace (instant — spec is already materialized)
  const upstreamTrace: PipelineStepSnapshot[] = [
    { id: 'understand_request', status: 'success' },
    { id: 'build_schema', status: 'success', message: `schemaVersion=${spec.schemaVersion}` },
  ];

  emit(options, 'understand_request', 'start');
  emit(options, 'understand_request', 'success');
  emit(options, 'build_schema', 'start');
  emit(options, 'build_schema', 'success', `schemaVersion=${spec.schemaVersion}`);

  const downstreamTrace = createDownstreamTrace();
  return executeDownstreamPipeline(spec, {
    trace: downstreamTrace,
    options,
    input,
    upstreamTrace,
  }, dataChecker);
}
