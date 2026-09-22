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
 * 8. Observable state via subscribe() for reactive UIs
 * 9. Race guard: stale completions cannot overwrite fresh state
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

export type StateListener = (state: DashboardControllerState) => void;

// ── Controller Interface ─────────────────────────────────────────────────

export interface DashboardController {
  /** Get current state snapshot (immutable copy). */
  getState(): DashboardControllerState;

  /**
   * Subscribe to state changes. Listener fires on every state update
   * (including pipeline events during a run).
   * Returns unsubscribe function.
   */
  subscribe(listener: StateListener): () => void;

  /**
   * Submit a command. Automatically determines initial vs follow-up.
   * Returns the DashboardRunResult.
   * On follow-up failure, preserves lastSuccess.
   * On concurrent submit, returns RUNTIME_BUSY.
   * Stale completions (after reset) are silently discarded.
   */
  submitCommand(input: string): Promise<DashboardRunResult>;

  /**
   * Start a new analysis. Clears all state.
   * In-flight requests are invalidated (stale guard).
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

  const listeners = new Set<StateListener>();

  // Race guard: incremented on reset, captured on submit
  let generation = 0;

  function setState(partial: Partial<DashboardControllerState>) {
    state = { ...state, ...partial };
    // Notify all subscribers with immutable snapshot
    const snapshot = { ...state };
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return {
    getState() {
      return { ...state };
    },

    subscribe(listener: StateListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
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

      // Capture generation for stale guard
      const runGeneration = generation;

      // Clear previous error, set running
      setState({ running: true, latestError: null, pipeline: createInitialTrace() });

      const onEvent = (event: PipelineEvent) => {
        // Don't update if stale
        if (runGeneration !== generation) return;
        setState({ pipeline: reducePipelineEvent(state.pipeline, event) });
      };
      const options: RunOptions = { onEvent };

      let result: DashboardRunResult;

      if (state.commandContext === 'initial' || !state.lastSuccess) {
        result = await service.runQuery(input, options);
      } else {
        result = await service.runFollowUp(state.lastSuccess.spec, input, options);
      }

      // Stale guard: if reset was called during this run, discard result
      if (runGeneration !== generation) {
        // Return the result to the caller (they can still use it)
        // but don't update controller state
        return result;
      }

      if (result.status === 'success') {
        setState({
          lastSuccess: result,
          latestError: null,
          running: false,
          pipeline: result.trace,
          commandContext: 'refine',
        });
      } else {
        // Follow-up failure: preserve lastSuccess
        setState({
          latestError: result,
          running: false,
          pipeline: result.trace,
        });
      }

      return result;
    },

    reset() {
      generation += 1;
      state = {
        lastSuccess: null,
        latestError: null,
        running: false,
        pipeline: createInitialTrace(),
        commandContext: 'initial',
      };
      // Notify subscribers of reset
      const snapshot = { ...state };
      for (const listener of listeners) {
        listener(snapshot);
      }
    },
  };
}
