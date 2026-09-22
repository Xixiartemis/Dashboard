/**
 * Application Layer — public API barrel export.
 *
 * UI imports ONLY from this file:
 *   import { ... } from '../application';
 *
 * Or equivalently:
 *   import { ... } from '../application/index';
 *
 * This is the sole business entry point for UI.
 * UI does NOT import from:
 *   - src/schema/
 *   - src/analytics/
 *   - src/data/
 *   - src/registries/
 *   - src/validation/
 *   - src/patch/
 *   - src/renderer/
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

// ── Service factory ───────────────────────────────────────────────────────

export { createDashboardService } from './dashboard-service';

// ── Direct execution (for fixtures, testing, and future server use) ────────

export { executeSpec, executeFollowUp } from './materializer';

// ── Demo fixtures ─────────────────────────────────────────────────────────

export { getDemoFixtures, getFailureFixtures, getAllFixtures } from './demo-fixtures';
