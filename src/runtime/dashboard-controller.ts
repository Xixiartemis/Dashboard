/**
 * Dashboard Controller — UI-agnostic runtime state management.
 *
 * Responsibilities:
 * 1. Holds current successful Dashboard (lastSuccess)
 * 2. Determines initial vs follow-up context
 * 3. Calls DashboardService
 * 4. Consumes PipelineEvents via reducer
 * 5. Manages running state
 * 6. Preserves previous dashboard on follow-up failure
 * 7. Supports reset / new analysis
 *
 * NOT responsible for:
 * - Business data computation
 * - Chart rendering
 * - UI layout / styling
 */

import type {
  DashboardService,
  DashboardRunSuccess,
  DashboardRunResult,
  DashboardRunFailure,
  PipelineStepSnapshot,
  PipelineEvent,
  RunOptions,
} from '../application/contracts';
import { reducePipelineEvent, createInitialTrace } from './reduce-pipeline-event';

// ── Controller State ─────────────────────────────────────────────────────

export interface DashboardControllerState {
  /** Last successful result (displayed dashboard). Null if no success yet. */
  lastSuccess: DashboardRunSuccess | null;

  /** Latest error from the most recent run. Cleared on next success or reset. */
  latestError: DashboardRunFailure | null;

  /** Whether a run is currently in progress. */
  running: boolean;

  /** Current pipeline trace (updated by events during run). */
  pipeline: PipelineStepSnapshot[];

  /** Whether the next submit should be initial or follow-up. */
  commandContext: 'initial' | 'refine';
}

// ── Controller Interface ─────────────────────────────────────────────────

export interface DashboardController {
  /** Get current state snapshot. */
  getState(): DashboardControllerState;

  /**
   * Submit a command. Automatically determines initial vs follow-up.
   * Returns the DashboardRunResult.
   * On follow-up failure, preserves lastSuccess.
   */
  submitCommand(input: string): Promise<DashboardRunResult>;

  /**
   * Start a new analysis. Clears all state.
   * Next submitCommand will be 'initial'.
   */
  reset(): void;
}

// ── Implementation ───────────────────────────────────────────────────────

export function createDashboardController(
  service: DashboardService,
): DashboardController {
  let state: DashboardControllerState = {
    lastSuccess: null,
    latestError: null,
    running: false,
    pipeline: createInitialTrace(),
    commandContext: 'initial',
  };

  function updateState(partial: Partial<DashboardControllerState>) {
    state = { ...state, ...partial };
  }

  return {
    getState() {
      return { ...state };
    },

    async submitCommand(input: string): Promise<DashboardRunResult> {
      if (state.running) {
        // Fail safe: don't allow concurrent submissions
        const failure: DashboardRunFailure = {
          status: 'error',
          input,
          stage: 'understand_request',
          error: { code: 'RUNTIME_BUSY', message: '正在处理上一条请求，请稍候', recoverable: true },
          trace: state.pipeline,
        };
        return failure;
      }

      // Clear previous error, set running
      updateState({ running: true, latestError: null, pipeline: createInitialTrace() });

      const onEvent = (event: PipelineEvent) => {
        updateState({ pipeline: reducePipelineEvent(state.pipeline, event) });
      };
      const options: RunOptions = { onEvent };

      let result: DashboardRunResult;

      if (state.commandContext === 'initial' || !state.lastSuccess) {
        // ── Initial: no current spec ──
        result = await service.runQuery(input, options);
      } else {
        // ── Follow-up: has current spec ──
        result = await service.runFollowUp(state.lastSuccess.spec, input, options);
      }

      if (result.status === 'success') {
        updateState({
          lastSuccess: result,
          latestError: null,
          running: false,
          pipeline: result.trace,
          commandContext: 'refine',
        });
      } else {
        // Follow-up failure: preserve lastSuccess
        updateState({
          latestError: result,
          running: false,
          pipeline: result.trace,
          // commandContext stays 'refine' — user can still refine
        });
      }

      return result;
    },

    reset() {
      state = {
        lastSuccess: null,
        latestError: null,
        running: false,
        pipeline: createInitialTrace(),
        commandContext: 'initial',
      };
    },
  };
}
