/**
 * DashboardService — async public API for UI consumption.
 *
 * This is the sole business entry point. UI calls this, never Domain directly.
 * Currently uses a placeholder interpreter (throws — no real interpreter yet).
 * The interface is async from day one to avoid future rework when LLM is added.
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import type {
  DashboardService,
  DashboardInterpreterPort,
  DashboardRunResult,
  RunOptions,
} from './contracts';
import { executeSpec, executeFollowUp } from './materializer';

/**
 * Placeholder interpreter: throws because no real interpreter exists yet.
 * Replace with DeterministicInterpreter / LLMInterpreter / TestAdapter later.
 */
class PlaceholderInterpreter implements DashboardInterpreterPort {
  async interpretInitial(_input: string): Promise<DashboardSpec> {
    throw new Error(
      'Interpreter not yet implemented. Use executeSpec() with a materialized spec for demo/fixtures.',
    );
  }

  async interpretFollowUp(
    _currentSpec: DashboardSpec,
    _input: string,
  ): Promise<DashboardPatch> {
    throw new Error(
      'Interpreter not yet implemented. Use executeFollowUp() with a known patch for demo/fixtures.',
    );
  }
}

export function createDashboardService(
  interpreter?: DashboardInterpreterPort,
): DashboardService {
  const interp = interpreter ?? new PlaceholderInterpreter();

  return {
    async runQuery(input: string, options?: RunOptions): Promise<DashboardRunResult> {
      const spec = await interp.interpretInitial(input);
      return executeSpec(spec, input, options);
    },

    async runFollowUp(
      currentSpec: DashboardSpec,
      input: string,
      options?: RunOptions,
    ): Promise<DashboardRunResult> {
      const patch = await interp.interpretFollowUp(currentSpec, input);
      return executeFollowUp(currentSpec, patch, input, options);
    },
  };
}
