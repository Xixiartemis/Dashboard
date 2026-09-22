/**
 * Semantic Validation — validates business-level correctness of a DashboardSpec.
 *
 * Precondition: input has already passed structural validation.
 * Checks: registry membership, reference closure, data capability, mark compatibility.
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import { isKnownSymbol } from '../registries/instruments';
import { isKnownMetric, getMetric, metricSupportsMark } from '../registries/metrics';
import { getDataset } from '../data/mock-dataset';
import { type ValidationError, makeError } from './errors';

export interface SemanticResult {
  ok: true;
}

export interface SemanticFailure {
  ok: false;
  errors: ValidationError[];
}

export type SemanticValidation = SemanticResult | SemanticFailure;

export function validateSemantics(spec: DashboardSpec): SemanticValidation {
  const errors: ValidationError[] = [];

  // 1. Instrument exists in registry
  if (!isKnownSymbol(spec.instrument.symbol)) {
    errors.push(makeError('UNKNOWN_INSTRUMENT', 'instrument.symbol', `symbol=${spec.instrument.symbol}`));
  }

  // 2. All metric ids from registry
  for (const m of spec.metrics) {
    if (!isKnownMetric(m.id)) {
      errors.push(makeError('UNSUPPORTED_METRIC', 'metrics', `metric=${m.id}`));
    } else {
      // Check unit consistency
      const def = getMetric(m.id)!;
      if (m.unit !== def.unit) {
        errors.push(makeError('INVALID_UNIT', `metrics[${m.id}]`, `expected ${def.unit}, got ${m.unit}`));
      }
      if (m.kind !== def.kind) {
        errors.push(makeError('INVALID_UNIT', `metrics[${m.id}]`, `kind expected ${def.kind}, got ${m.kind}`));
      }
    }
  }

  // 3. All metric ids unique
  const metricIds = new Set<string>();
  for (const m of spec.metrics) {
    if (metricIds.has(m.id)) {
      errors.push(makeError('DUPLICATE_ID', 'metrics', `duplicate metric: ${m.id}`));
    }
    metricIds.add(m.id);
  }

  // 4. All view ids unique
  const viewIds = new Set<string>();
  for (const v of spec.views) {
    if (viewIds.has(v.id)) {
      errors.push(makeError('DUPLICATE_ID', 'views', `duplicate view: ${v.id}`));
    }
    viewIds.add(v.id);
  }

  // 5. All series ids unique within each view
  for (const v of spec.views) {
    const seriesIds = new Set<string>();
    for (const s of v.series) {
      if (seriesIds.has(s.id)) {
        errors.push(makeError('DUPLICATE_ID', `views[${v.id}].series`, `duplicate series: ${s.id}`));
      }
      seriesIds.add(s.id);
    }
  }

  // 6. Build available field set: raw fields + metric ids
  const availableFields = new Set<string>(['date', 'open', 'high', 'low', 'close', 'volume']);
  for (const m of spec.metrics) {
    availableFields.add(m.id);
  }

  // 7. Series.field exists in available fields
  for (const v of spec.views) {
    for (const s of v.series) {
      if (!availableFields.has(s.field)) {
        errors.push(makeError('MISSING_SERIES_FIELD', `views[${v.id}].series[${s.id}]`, `field=${s.field}`));
      }
      // Check mark compatibility
      if (isKnownMetric(s.field) && !metricSupportsMark(s.field, s.mark)) {
        errors.push(makeError('METRIC_MARK_INCOMPATIBLE', `views[${v.id}].series[${s.id}]`, `${s.field} does not support ${s.mark}`));
      }
    }
  }

  // 8. Transform fields exist
  for (const t of spec.transforms) {
    if (!availableFields.has(t.field)) {
      errors.push(makeError('MISSING_SERIES_FIELD', `transforms[${t.id}]`, `field=${t.field}`));
    }
  }

  // 9. Annotation transformRef closure
  const transformIds = new Set(spec.transforms.map((t) => t.id));
  for (const v of spec.views) {
    for (const a of v.annotations) {
      if (!transformIds.has(a.transformRef)) {
        errors.push(makeError('MISSING_TRANSFORM_REF', `views[${v.id}].annotations[${a.id}]`, `transformRef=${a.transformRef}`));
      }
    }
  }

  // 10. Time range doesn't exceed data capability
  const dataset = getDataset(spec.instrument.symbol);
  if (dataset && spec.timeRange.count > dataset.length) {
    errors.push(makeError('TIME_RANGE_EXCEEDS_DATA', 'timeRange.count', `requested=${spec.timeRange.count}, available=${dataset.length}`));
  }

  // 11. Resolved provider is known
  if (spec.dataSource.resolved !== 'embedded_mock' && spec.dataSource.resolved !== 'wencai') {
    errors.push(makeError('UNRESOLVED_PROVIDER', 'dataSource.resolved', `resolved=${spec.dataSource.resolved}`));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/**
 * Validate that a patch is applicable to the current spec.
 * Checks: from-metric exists, to-metric from registry, target view/series exist.
 */
export function validatePatchSemantics(
  spec: DashboardSpec,
  patch: DashboardPatch,
): SemanticValidation {
  const errors: ValidationError[] = [];

  switch (patch.op) {
    case 'replace_metric': {
      const hasFrom = spec.metrics.some((m) => m.id === patch.from);
      if (!hasFrom) {
        errors.push(makeError('PATCH_TARGET_NOT_FOUND', 'from', `metric=${patch.from}`));
      }
      if (!isKnownMetric(patch.to)) {
        errors.push(makeError('PATCH_NEW_METRIC_INVALID', 'to', `metric=${patch.to}`));
      }
      break;
    }
    case 'add_metric': {
      if (!isKnownMetric(patch.metric)) {
        errors.push(makeError('PATCH_NEW_METRIC_INVALID', 'metric', `metric=${patch.metric}`));
      }
      const view = spec.views.find((v) => v.id === patch.viewId);
      if (!view) {
        errors.push(makeError('PATCH_TARGET_NOT_FOUND', 'viewId', `view=${patch.viewId}`));
      }
      break;
    }
    case 'set_time_range': {
      // count range already validated by Zod; check against data
      const dataset = getDataset(spec.instrument.symbol);
      if (dataset && patch.count > dataset.length) {
        errors.push(makeError('TIME_RANGE_EXCEEDS_DATA', 'count', `requested=${patch.count}, available=${dataset.length}`));
      }
      break;
    }
    case 'set_mark': {
      const view = spec.views.find((v) => v.id === patch.viewId);
      if (!view) {
        errors.push(makeError('PATCH_TARGET_NOT_FOUND', 'viewId', `view=${patch.viewId}`));
      } else {
        const series = view.series.find((s) => s.id === patch.seriesId);
        if (!series) {
          errors.push(makeError('PATCH_TARGET_NOT_FOUND', 'seriesId', `series=${patch.seriesId}`));
        } else if (isKnownMetric(series.field) && !metricSupportsMark(series.field, patch.mark)) {
          errors.push(makeError('METRIC_MARK_INCOMPATIBLE', 'mark', `${series.field} does not support ${patch.mark}`));
        }
      }
      break;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}
