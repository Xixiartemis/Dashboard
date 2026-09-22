/**
 * Pipeline Event Reducer — maps PipelineEvent to PipelineStepSnapshot updates.
 *
 * Single source of truth for event → state mapping.
 * Used by both initial and follow-up flows.
 */

import type { PipelineEvent, PipelineStepSnapshot, PipelineStepId } from '../application/contracts';

/**
 * Apply a PipelineEvent to a trace array, returning a new trace.
 * Immutable — does not mutate the input.
 */
export function reducePipelineEvent(
  trace: PipelineStepSnapshot[],
  event: PipelineEvent,
): PipelineStepSnapshot[] {
  return trace.map((step) => {
    if (step.id !== event.step) return step;

    switch (event.phase) {
      case 'start':
        return { ...step, status: 'running' as const, message: event.message };
      case 'success':
        return { ...step, status: 'success' as const, message: event.message };
      case 'error':
        return { ...step, status: 'error' as const, message: event.message };
      default:
        return step;
    }
  });
}

/**
 * Create an initial empty trace for UI display before any events arrive.
 */
export function createInitialTrace(): PipelineStepSnapshot[] {
  const steps: PipelineStepId[] = [
    'understand_request',
    'build_schema',
    'validate_schema',
    'load_data',
    'analyze',
    'render',
  ];
  return steps.map((id) => ({ id, status: 'pending' }));
}
