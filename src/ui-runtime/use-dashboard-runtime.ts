/**
 * useDashboardRuntime — React hook consuming Runtime Controller state.
 *
 * Uses useSyncExternalStore for tear-free reads.
 * UI gets: state, submitCommand, reset.
 * No second state model — controller is the single source of truth.
 */

import { useSyncExternalStore } from 'react';
import { dashboardRuntime } from './dashboard-runtime-instance';

const controller = dashboardRuntime.controller;

export function useDashboardRuntime() {
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  return {
    state,
    submitCommand: controller.submitCommand.bind(controller),
    reset: controller.reset.bind(controller),
  };
}
