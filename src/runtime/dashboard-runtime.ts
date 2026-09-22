/**
 * Runtime Composition Root — wires interpreter + service + controller.
 *
 * UI imports from here, NOT from interpreter or application internals.
 *
 * Usage:
 *   import { createRuntime } from '../runtime';
 *   const runtime = createRuntime();
 *   const result = await runtime.controller.submitCommand('分析A公司...');
 */

import { DeterministicInterpreter } from '../interpreter/deterministic-interpreter';
import { createDashboardService } from '../application/dashboard-service';
import { createDashboardController, type DashboardController } from './dashboard-controller';
import type { DashboardService } from '../application/contracts';

export interface DashboardRuntime {
  service: DashboardService;
  controller: DashboardController;
}

/**
 * Create a fully wired runtime with DeterministicInterpreter.
 * This is the Composition Root — the only place that knows about concrete implementations.
 */
export function createRuntime(): DashboardRuntime {
  const interpreter = new DeterministicInterpreter();
  const service = createDashboardService(interpreter);
  const controller = createDashboardController(service);
  return { service, controller };
}

/**
 * Create a runtime with a custom interpreter (for testing).
 */
export function createRuntimeWithInterpreter(
  interpreter: import('../application/contracts').DashboardInterpreterPort,
): DashboardRuntime {
  const service = createDashboardService(interpreter);
  const controller = createDashboardController(service);
  return { service, controller };
}

// Re-export controller types for convenience
export type { DashboardController, DashboardControllerState } from './dashboard-controller';
