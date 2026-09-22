/**
 * Patch Compiler — deterministic ResolvedFollowUpIntent → DashboardPatch.
 *
 * Follow-up compiler produces DashboardPatch, NOT a new DashboardSpec.
 * The frozen applyPatch() handles spec mutation + validation + presentation normalization.
 *
 * Context closure: Compiler validates all references against currentSpec
 * before producing a patch. ok:true means all references are valid.
 */

import type { DashboardPatch } from '../../schema/dashboard-patch';
import type { DashboardSpec } from '../../schema/dashboard-spec';
import type { ResolvedFollowUpIntent } from '../intent';
import type { InterpreterError } from '../errors';
import { makeInterpreterError } from '../errors';
import { isKnownMetric, metricSupportsMark } from '../../registries/metrics';

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
 * @param currentSpec - the current DashboardSpec (for context validation)
 */
export function compileFollowUpIntent(
  intent: ResolvedFollowUpIntent,
  currentSpec: DashboardSpec,
): PatchCompileOutput {
  switch (intent.op) {
    case 'replace_metric': {
      // 'to' must be a known metric in Registry
      if (!isKnownMetric(intent.to)) {
        return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `to=${intent.to}`) };
      }
      // 'from' must exist in current spec's metrics
      if (!currentSpec.metrics.some((m) => m.id === intent.from)) {
        return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `from=${intent.from} not in current spec`) };
      }
      // Can't replace a metric with itself
      if (intent.from === intent.to) {
        return { ok: false, error: makeInterpreterError('CONFLICTING_INTENT', `from and to are the same: ${intent.from}`) };
      }
      return { ok: true, patch: { op: 'replace_metric', from: intent.from, to: intent.to } };
    }

    case 'add_metric': {
      // metric must be known in Registry
      if (!isKnownMetric(intent.metric)) {
        return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `metric=${intent.metric}`) };
      }
      // viewId must exist in current spec
      if (!currentSpec.views.some((v) => v.id === intent.viewId)) {
        return { ok: false, error: makeInterpreterError('COMPILATION_FAILED', `viewId=${intent.viewId} not found`) };
      }
      // metric must not already be in spec's metrics (duplicate)
      if (currentSpec.metrics.some((m) => m.id === intent.metric)) {
        return { ok: false, error: makeInterpreterError('CONFLICTING_INTENT', `metric ${intent.metric} already in spec`) };
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
      // viewId must exist
      const view = currentSpec.views.find((v) => v.id === intent.viewId);
      if (!view) {
        return { ok: false, error: makeInterpreterError('COMPILATION_FAILED', `viewId=${intent.viewId} not found`) };
      }
      // seriesId must exist IN THAT view (not just any view)
      const series = view.series.find((s) => s.id === intent.seriesId);
      if (!series) {
        return { ok: false, error: makeInterpreterError('COMPILATION_FAILED', `seriesId=${intent.seriesId} not in view ${intent.viewId}`) };
      }
      // requested mark must be supported by the metric behind this series
      if (!metricSupportsMark(series.field, intent.mark)) {
        return { ok: false, error: makeInterpreterError('UNSUPPORTED_CAPABILITY', `metric ${series.field} does not support mark ${intent.mark}`) };
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
