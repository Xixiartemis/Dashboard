/**
 * DashboardPatch Application — applies domain patches to DashboardSpec.
 *
 * Pipeline:
 *   Current Spec + Patch → validate patch semantics → apply → re-validate full spec
 *
 * Every application MUST be followed by full structural + semantic re-validation.
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import { getMetric } from '../registries/metrics';
import { validateStructure } from '../validation/structural';
import { validateSemantics, validatePatchSemantics } from '../validation/semantic';
import type { ValidationError } from '../validation/errors';
import { makeError } from '../validation/errors';

export interface PatchResult {
  ok: true;
  spec: DashboardSpec;
}

export interface PatchFailure {
  ok: false;
  errors: ValidationError[];
}

export type PatchApplication = PatchResult | PatchFailure;

export function applyPatch(
  currentSpec: DashboardSpec,
  patch: DashboardPatch,
): PatchApplication {
  // 1. Validate patch semantics against current spec
  const patchValidation = validatePatchSemantics(currentSpec, patch);
  if (!patchValidation.ok) {
    return { ok: false, errors: patchValidation.errors };
  }

  // 2. Apply patch to produce new spec
  let newSpec: DashboardSpec;

  switch (patch.op) {
    case 'replace_metric': {
      const metricDef = getMetric(patch.to)!;
      // If 'to' metric already exists in metrics (e.g. for transforms), just remove 'from'
      const toAlreadyExists = currentSpec.metrics.some((m) => m.id === patch.to);
      const newMetrics = toAlreadyExists
        ? currentSpec.metrics.filter((m) => m.id !== patch.from)
        : currentSpec.metrics.map((m) =>
            m.id === patch.from
              ? { id: metricDef.id, label: metricDef.label, kind: metricDef.kind, unit: metricDef.unit }
              : m,
          );
      newSpec = {
        ...currentSpec,
        metrics: newMetrics,
        // Also update any series that referenced the old metric
        views: currentSpec.views.map((v) => ({
          ...v,
          series: v.series.map((s) =>
            s.field === patch.from
              ? { ...s, field: patch.to, unit: metricDef.unit }
              : s,
          ),
        })),
      };
      break;
    }

    case 'add_metric': {
      const metricDef = getMetric(patch.metric)!;
      // Add to metrics if not already there
      const alreadyInMetrics = currentSpec.metrics.some((m) => m.id === patch.metric);
      const newMetrics = alreadyInMetrics
        ? currentSpec.metrics
        : [...currentSpec.metrics, { id: metricDef.id, label: metricDef.label, kind: metricDef.kind, unit: metricDef.unit }];

      newSpec = {
        ...currentSpec,
        metrics: newMetrics,
        views: currentSpec.views.map((v) =>
          v.id === patch.viewId
            ? {
                ...v,
                series: [
                  ...v.series,
                  {
                    id: `${patch.metric}_series`,
                    field: patch.metric,
                    mark: 'line' as const,
                    unit: metricDef.unit,
                  },
                ],
              }
            : v,
        ),
      };
      break;
    }

    case 'set_time_range': {
      newSpec = {
        ...currentSpec,
        timeRange: {
          ...currentSpec.timeRange,
          count: patch.count,
        },
      };
      break;
    }

    case 'set_mark': {
      newSpec = {
        ...currentSpec,
        views: currentSpec.views.map((v) =>
          v.id === patch.viewId
            ? {
                ...v,
                series: v.series.map((s) =>
                  s.id === patch.seriesId
                    ? { ...s, mark: patch.mark }
                    : s,
                ),
              }
            : v,
        ),
      };
      break;
    }
  }

  // 3. Re-validate the new spec (structural + semantic)
  const structResult = validateStructure(newSpec);
  if (!structResult.ok) {
    return { ok: false, errors: [
      makeError('PATCH_REVALIDATION_FAILED', undefined, 'structural validation failed after patch'),
      ...structResult.errors,
    ]};
  }

  const semResult = validateSemantics(structResult.spec);
  if (!semResult.ok) {
    return { ok: false, errors: [
      makeError('PATCH_REVALIDATION_FAILED', undefined, 'semantic validation failed after patch'),
      ...semResult.errors,
    ]};
  }

  return { ok: true, spec: structResult.spec };
}
