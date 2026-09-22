/**
 * Patch Compiler — deterministic ResolvedFollowUpIntent → DashboardPatch.
 *
 * Follow-up compiler produces DashboardPatch, NOT a new DashboardSpec.
 * The frozen applyPatch() handles spec mutation + validation + presentation normalization.
 */

import type { DashboardPatch } from '../../schema/dashboard-patch';
import type { DashboardSpec } from '../../schema/dashboard-spec';
import type { ResolvedFollowUpIntent } from '../intent';
import type { InterpreterError } from '../errors';
import { makeInterpreterError } from '../errors';
import { isKnownMetric } from '../../registries/metrics';

export interface PatchCompileResult {
  ok: true;
  patch: DashboardPatch;
}

export interface PatchCompileFailure {
  ok: false;
  error: InterpreterError;
}

export type PatchCompileOutput = PatchCompileResult | PatchCompileFailure;

/**
 * Compile a ResolvedFollowUpIntent into a DashboardPatch.
 *
 * @param intent - the resolved follow-up intent
 * @param currentSpec - the current DashboardSpec (for context-dependent intents like add_metric)
 */
export function compileFollowUpIntent(
  intent: ResolvedFollowUpIntent,
  currentSpec: DashboardSpec,
): PatchCompileOutput {
  switch (intent.op) {
    case 'replace_metric': {
      if (!isKnownMetric(intent.to)) {
        return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `to=${intent.to}`) };
      }
      if (!currentSpec.metrics.some((m) => m.id === intent.from)) {
        return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `from=${intent.from} not in current spec`) };
      }
      return { ok: true, patch: { op: 'replace_metric', from: intent.from, to: intent.to } };
    }

    case 'add_metric': {
      if (!isKnownMetric(intent.metric)) {
        return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `metric=${intent.metric}`) };
      }
      if (!currentSpec.views.some((v) => v.id === intent.viewId)) {
        return { ok: false, error: makeInterpreterError('COMPILATION_FAILED', `viewId=${intent.viewId} not found`) };
      }
      return { ok: true, patch: { op: 'add_metric', metric: intent.metric, viewId: intent.viewId } };
    }

    case 'set_time_range': {
      if (intent.count < 1 || intent.count > 60) {
        return { ok: false, error: makeInterpreterError('OUT_OF_RANGE', `count=${intent.count}`) };
      }
      return { ok: true, patch: { op: 'set_time_range', count: intent.count } };
    }

    case 'set_mark': {
      if (!currentSpec.views.some((v) => v.id === intent.viewId)) {
        return { ok: false, error: makeInterpreterError('COMPILATION_FAILED', `viewId=${intent.viewId} not found`) };
      }
      return {
        ok: true,
        patch: {
          op: 'set_mark',
          viewId: intent.viewId,
          seriesId: intent.seriesId,
          mark: intent.mark,
        },
      };
    }
  }
}
