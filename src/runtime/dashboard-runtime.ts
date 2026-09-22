/**
 * Runtime Composition Root — wires interpreter + service + controller.
 *
 * UI imports from here, NOT from interpreter or application internals.
 *
 * Product entry: createDashboardRuntime() — exposes only controller.
 * Test entry: createRuntimeWithInterpreter() — exposes both for test assertions.
 */

import { DeterministicInterpreter } from '../interpreter/deterministic-interpreter';
import { createDashboardService } from '../application/dashboard-service';
import { createDashboardController, type DashboardController } from './dashboard-controller';
import type { DashboardInterpreterPort } from '../application/contracts';

// ── Product Runtime (controller only, no service escape hatch) ────────────

export interface DashboardRuntime {
  controller: DashboardController;
}

/**
 * Create a product runtime. UI only sees the controller.
 * The service is internal — UI cannot bypass the controller.
 */
export function createDashboardRuntime(): DashboardRuntime {
  const interpreter = new DeterministicInterpreter();
  const service = createDashboardService(interpreter);
  const controller = createDashboardController(service);
  return { controller };
}

// ── Test Runtime (exposes service for assertions) ─────────────────────────

export interface TestDashboardRuntime {
  service: import('../application/contracts').DashboardService;
  controller: DashboardController;
}

/**
 * Create a test runtime with a custom interpreter.
 * Exposes service for direct test assertions.
 * NOT for product UI use.
 */
export function createRuntimeWithInterpreter(
  interpreter: DashboardInterpreterPort,
): TestDashboardRuntime {
  const service = createDashboardService(interpreter);
  const controller = createDashboardController(service);
  return { service, controller };
}

// Re-export controller types for convenience
export type { DashboardController, DashboardControllerState } from './dashboard-controller';
