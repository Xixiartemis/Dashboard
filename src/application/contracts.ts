/**
 * Application Contracts — the sole interface between UI and Domain.
 *
 * These types are the Application Boundary. UI only consumes these.
 * Domain internals (AnalyticsResult, Map, ZodError, etc.) never cross this line.
 *
 * Invariants:
 * - Every type here is JSON-serializable (string/number/boolean/null/object/array)
 * - No Map, Set, Date, Function, Error instance, class instance, circular ref
 * - DashboardRunResult = single result model for both initial and follow-up
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { EChartsOption } from 'echarts';

// ── Pipeline Steps ────────────────────────────────────────────────────────

export type PipelineStepId =
  | 'understand_request'
  | 'build_schema'
  | 'validate_schema'
  | 'load_data'
  | 'analyze'
  | 'render';

export type PipelineStepStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'skipped';

export interface PipelineStepSnapshot {
  id: PipelineStepId;
  status: PipelineStepStatus;
  message?: string;
}

// ── Pipeline Events (for real-time UI streaming) ──────────────────────────

export interface PipelineEvent {
  step: PipelineStepId;
  phase: 'start' | 'success' | 'error';
  message?: string;
}

// ── Run Options ───────────────────────────────────────────────────────────

export interface RunOptions {
  onEvent?: (event: PipelineEvent) => void;
}

// ── Chart Result (UI可以直接渲染) ──────────────────────────────────────────

export interface DashboardChartResult {
  viewId: string;
  title: string;
  option: EChartsOption;
}

// ── Insight Result (UI-friendly plain data) ───────────────────────────────

export type DashboardInsightItem =
  | RankInsightItem
  | PeriodChangeInsightItem;

export interface RankInsightItem {
  type: 'rank';
  transformId: string;
  metric: string;
  metricLabel: string;
  order: 'asc' | 'desc';
  limit: number;
  points: Array<{
    date: string;
    value: number;
    unit: string;
  }>;
}

export interface PeriodChangeInsightItem {
  type: 'period_change';
  metric: string;
  metricLabel: string;
  startValue: number;
  endValue: number;
  changePct: number;
  unit: string;
}

export interface DashboardInsightResult {
  intentSummary: string;
  items: DashboardInsightItem[];
}

// ── Data Provenance ───────────────────────────────────────────────────────

export interface DashboardDataProvenance {
  datasetId: string;
  asOf: string;
  timezone: string;
  calendar: string;
  instrument: {
    symbol: string;
    displayName: string;
  };
  timeRange: {
    count: number;
    basis: string;
  };
}

// ── Error Contract ────────────────────────────────────────────────────────

export interface DashboardError {
  code: string;
  message: string;       // 用户可读中文
  details?: string;      // debug 用
  recoverable: boolean;
}

// ── Run Result (discriminated union) ──────────────────────────────────────

export interface DashboardRunSuccess {
  status: 'success';
  input: string;
  spec: DashboardSpec;
  charts: DashboardChartResult[];
  insight: DashboardInsightResult;
  provenance: DashboardDataProvenance;
  trace: PipelineStepSnapshot[];
}

export interface DashboardRunFailure {
  status: 'error';
  input: string;
  stage: PipelineStepId;
  error: DashboardError;
  trace: PipelineStepSnapshot[];
}

export type DashboardRunResult = DashboardRunSuccess | DashboardRunFailure;

// ── Interpreter Port (dependency boundary for future interpreters) ────────

export interface DashboardInterpreterPort {
  interpretInitial(input: string): Promise<DashboardSpec>;
  interpretFollowUp(
    currentSpec: DashboardSpec,
    input: string,
  ): Promise<import('../schema/dashboard-patch').DashboardPatch>;
}

// ── Dashboard Service (public async API) ──────────────────────────────────

export interface DashboardService {
  runQuery(input: string, options?: RunOptions): Promise<DashboardRunResult>;
  runFollowUp(
    currentSpec: DashboardSpec,
    input: string,
    options?: RunOptions,
  ): Promise<DashboardRunResult>;
}

// ── Demo Fixture ──────────────────────────────────────────────────────────

export interface DemoFixture {
  id: string;
  name: string;
  prompt: string;
  initialResult: DashboardRunSuccess;
  followUpPrompt?: string;
  followUpResult?: DashboardRunResult;
}

export interface DemoFailureFixture {
  id: string;
  name: string;
  description: string;
  result: DashboardRunFailure;
}
