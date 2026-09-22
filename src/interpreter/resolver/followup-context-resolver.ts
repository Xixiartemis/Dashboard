/**
 * Follow-up Context Resolver — DraftFollowUpIntent + currentSpec → ResolvedFollowUpIntent.
 *
 * Maps raw Chinese metric mentions to canonical IDs using currentSpec context.
 * Resolves target viewId/seriesId for add_metric and set_mark.
 * Fails closed on ambiguous or missing references.
 */

import type { DashboardSpec } from '../../schema/dashboard-spec';
import type { ResolvedFollowUpIntent } from '../intent';
import type { DraftFollowUpIntent } from '../extract/followup-extractor';
import type { InterpreterError } from '../errors';
import { makeInterpreterError } from '../errors';
import { resolveMetricId } from './metric-resolver';
import { getMetric } from '../../registries/metrics';

export interface FollowUpResolutionResult {
  ok: true;
  intent: ResolvedFollowUpIntent;
}

export interface FollowUpResolutionFailure {
  ok: false;
  error: InterpreterError;
}

export type FollowUpResolutionOutput = FollowUpResolutionResult | FollowUpResolutionFailure;

/**
 * Find the view that contains a metric, for add_metric context resolution.
 * Returns the view whose unit matches the new metric's unit.
 * Fails if ambiguous (multiple matching views).
 */
function findTargetViewForMetric(
  spec: DashboardSpec,
  metricId: string,
): { ok: true; viewId: string } | { ok: false; error: InterpreterError } {
  const def = getMetric(metricId);
  if (!def) return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `metric=${metricId}`) };

  const matchingViews = spec.views.filter((v) =>
    v.series.some((s) => s.unit === def.unit),
  );

  if (matchingViews.length === 0) {
    return { ok: false, error: makeInterpreterError('COMPILATION_FAILED', `no view with unit=${def.unit}`) };
  }
  if (matchingViews.length > 1) {
    return { ok: false, error: makeInterpreterError('AMBIGUOUS_INPUT', `multiple views match unit=${def.unit}`) };
  }

  return { ok: true, viewId: matchingViews[0].id };
}

/**
 * Find the series target for set_mark by metric name.
 * Returns viewId + seriesId.
 */
function findSeriesTarget(
  spec: DashboardSpec,
  targetMetric: string,
): { ok: true; viewId: string; seriesId: string } | { ok: false; error: InterpreterError } {
  const resolved = resolveMetricId(targetMetric);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  for (const view of spec.views) {
    for (const series of view.series) {
      if (series.field === resolved.metricId) {
        return { ok: true, viewId: view.id, seriesId: series.id };
      }
    }
  }

  return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `metric ${resolved.metricId} not in any view`) };
}

/**
 * Resolve a DraftFollowUpIntent into a ResolvedFollowUpIntent using currentSpec context.
 */
export function resolveFollowUpIntent(
  draft: DraftFollowUpIntent,
  currentSpec: DashboardSpec,
): FollowUpResolutionOutput {
  switch (draft.op) {
    case 'replace_metric': {
      const fromResolved = resolveMetricId(draft.from);
      if (!fromResolved.ok) return { ok: false, error: fromResolved.error };
      const toResolved = resolveMetricId(draft.to);
      if (!toResolved.ok) return { ok: false, error: toResolved.error };
      return { ok: true, intent: { op: 'replace_metric', from: fromResolved.metricId, to: toResolved.metricId } };
    }

    case 'add_metric': {
      const resolved = resolveMetricId(draft.metric);
      if (!resolved.ok) return { ok: false, error: resolved.error };
      const target = findTargetViewForMetric(currentSpec, resolved.metricId);
      if (!target.ok) return { ok: false, error: target.error };
      return { ok: true, intent: { op: 'add_metric', metric: resolved.metricId, viewId: target.viewId } };
    }

    case 'set_time_range': {
      return { ok: true, intent: { op: 'set_time_range', count: draft.count } };
    }

    case 'set_mark': {
      if (draft.targetMetric) {
        // User specified which metric's chart to change
        const target = findSeriesTarget(currentSpec, draft.targetMetric);
        if (!target.ok) return { ok: false, error: target.error };
        return { ok: true, intent: { op: 'set_mark', viewId: target.viewId, seriesId: target.seriesId, mark: draft.mark } };
      }

      // No target specified — safe only if there's exactly one series overall
      const allSeries = currentSpec.views.flatMap((v) =>
        v.series.map((s) => ({ viewId: v.id, seriesId: s.id, field: s.field })),
      );

      if (allSeries.length === 1) {
        return {
          ok: true,
          intent: {
            op: 'set_mark',
            viewId: allSeries[0].viewId,
            seriesId: allSeries[0].seriesId,
            mark: draft.mark,
          },
        };
      }

      return { ok: false, error: makeInterpreterError('AMBIGUOUS_INPUT', '请指定要修改哪个指标的图表类型') };
    }
  }
}
