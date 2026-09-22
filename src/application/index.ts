/**
 * Application Layer — public API barrel export.
 *
 * UI imports ONLY from this file.
 * This is the sole business entry point for UI.
 *
 * UI does NOT import from:
 *   src/schema/, src/analytics/, src/data/, src/registries/,
 *   src/validation/, src/patch/, src/renderer/
 *
 * Internal execution (executeSpec, executeDownstreamPipeline) is NOT exported.
 * Fixtures and tests import directly from internal modules.
 */

// ── Types (contracts) ─────────────────────────────────────────────────────

export type {
  PipelineStepId,
  PipelineStepStatus,
  PipelineStepSnapshot,
  PipelineEvent,
  RunOptions,
  DashboardChartResult,
  DashboardInsightItem,
  RankInsightItem,
  PeriodChangeInsightItem,
  DashboardInsightResult,
  DashboardDataProvenance,
  DashboardError,
  DashboardRunSuccess,
  DashboardRunFailure,
  DashboardRunResult,
  DashboardInterpreterPort,
  DashboardService,
  DemoFixture,
  DemoFailureFixture,
} from './contracts';

// ── Service factory (sole public entry) ───────────────────────────────────

export { createDashboardService } from './dashboard-service';

// ── Demo fixtures (for UI development) ────────────────────────────────────

export { getDemoFixtures, getFailureFixtures, getAllFixtures } from './demo-fixtures';
