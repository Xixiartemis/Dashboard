/**
 * Semantic Validation — validates business-level correctness of a DashboardSpec.
 *
 * Precondition: input has already passed structural validation.
 * Checks: registry membership, reference closure, data capability, mark compatibility,
 * datasource provenance, metric dependency closure, instrument metadata consistency.
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import { getInstrument } from '../registries/instruments';
import { isKnownMetric, getMetric, metricSupportsMark } from '../registries/metrics';
import { getDataset } from '../data/mock-dataset';
import { MANIFEST } from '../data/manifest';
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

  // ── 1. DataSource provenance (Issue #2) ───────────────────────────────
  if (spec.dataSource.datasetId !== MANIFEST.datasetId) {
    errors.push(makeError('UNRESOLVED_PROVIDER', 'dataSource.datasetId',
      `expected ${MANIFEST.datasetId}, got ${spec.dataSource.datasetId}`));
  }
  if (spec.dataSource.asOf !== MANIFEST.asOf) {
    errors.push(makeError('UNRESOLVED_PROVIDER', 'dataSource.asOf',
      `expected ${MANIFEST.asOf}, got ${spec.dataSource.asOf}`));
  }
  if (spec.dataSource.timezone !== MANIFEST.timezone) {
    errors.push(makeError('UNRESOLVED_PROVIDER', 'dataSource.timezone',
      `expected ${MANIFEST.timezone}, got ${spec.dataSource.timezone}`));
  }

  // ── 2. Instrument exists AND metadata matches registry (Issue #11) ────
  const inst = getInstrument(spec.instrument.symbol);
  if (!inst) {
    errors.push(makeError('UNKNOWN_INSTRUMENT', 'instrument.symbol', `symbol=${spec.instrument.symbol}`));
  } else {
    if (spec.instrument.displayName !== inst.displayName) {
      errors.push(makeError('UNKNOWN_INSTRUMENT', 'instrument.displayName',
        `expected "${inst.displayName}", got "${spec.instrument.displayName}"`));
    }
    if (spec.instrument.assetType !== inst.assetType) {
      errors.push(makeError('UNKNOWN_INSTRUMENT', 'instrument.assetType',
        `expected "${inst.assetType}", got "${spec.instrument.assetType}"`));
    }
  }

  // ── 3. Metric dependency closure (Issue #3) ───────────────────────────
  // All business metric references must be in spec.metrics
  const metricIds = new Set<string>();
  for (const m of spec.metrics) {
    if (metricIds.has(m.id)) {
      errors.push(makeError('DUPLICATE_ID', 'metrics', `duplicate metric: ${m.id}`));
    }
    metricIds.add(m.id);
    // Check against registry
    if (!isKnownMetric(m.id)) {
      errors.push(makeError('UNSUPPORTED_METRIC', 'metrics', `metric=${m.id}`));
    } else {
      const def = getMetric(m.id)!;
      if (m.unit !== def.unit) {
        errors.push(makeError('INVALID_UNIT', `metrics[${m.id}]`, `expected ${def.unit}, got ${m.unit}`));
      }
      if (m.kind !== def.kind) {
        errors.push(makeError('INVALID_UNIT', `metrics[${m.id}]`, `kind expected ${def.kind}, got ${m.kind}`));
      }
    }
  }

  // ── 4. All view ids unique ────────────────────────────────────────────
  const viewIds = new Set<string>();
  for (const v of spec.views) {
    if (viewIds.has(v.id)) {
      errors.push(makeError('DUPLICATE_ID', 'views', `duplicate view: ${v.id}`));
    }
    viewIds.add(v.id);
  }

  // ── 5. Series ids unique within each view ─────────────────────────────
  for (const v of spec.views) {
    const seriesIds = new Set<string>();
    for (const s of v.series) {
      if (seriesIds.has(s.id)) {
        errors.push(makeError('DUPLICATE_ID', `views[${v.id}].series`, `duplicate series: ${s.id}`));
      }
      seriesIds.add(s.id);
    }
  }

  // ── 6. series.field must be in spec.metrics ───────────────────────────
  for (const v of spec.views) {
    for (const s of v.series) {
      if (!metricIds.has(s.field)) {
        errors.push(makeError('MISSING_SERIES_FIELD', `views[${v.id}].series[${s.id}]`,
          `field="${s.field}" not in spec.metrics (metrics=analysis dependency closure)`));
      }
      // Check mark compatibility
      if (isKnownMetric(s.field) && !metricSupportsMark(s.field, s.mark)) {
        errors.push(makeError('METRIC_MARK_INCOMPATIBLE', `views[${v.id}].series[${s.id}]`,
          `${s.field} does not support ${s.mark}`));
      }
    }
  }

  // ── 7. transform.field must be in spec.metrics ────────────────────────
  for (const t of spec.transforms) {
    if (!metricIds.has(t.field)) {
      errors.push(makeError('MISSING_SERIES_FIELD', `transforms[${t.id}]`,
        `field="${t.field}" not in spec.metrics`));
    }
  }

  // ── 8. Annotation transformRef closure ────────────────────────────────
  const transformIds = new Set(spec.transforms.map((t) => t.id));
  for (const v of spec.views) {
    for (const a of v.annotations) {
      if (!transformIds.has(a.transformRef)) {
        errors.push(makeError('MISSING_TRANSFORM_REF', `views[${v.id}].annotations[${a.id}]`,
          `transformRef=${a.transformRef}`));
      }
    }
  }

  // ── 9. Insight facts consistency ──────────────────────────────────────
  for (const fact of spec.insight.facts) {
    // insight.metric must be in spec.metrics
    if (!metricIds.has(fact.metric)) {
      errors.push(makeError('MISSING_SERIES_FIELD', `insight.facts`,
        `metric="${fact.metric}" not in spec.metrics`));
    }
    // rank_summary must reference a valid transform
    if (fact.kind === 'rank_summary') {
      if (!fact.transformRef) {
        errors.push(makeError('MISSING_TRANSFORM_REF', `insight.facts`,
          `rank_summary requires transformRef`));
      } else if (!transformIds.has(fact.transformRef)) {
        errors.push(makeError('MISSING_TRANSFORM_REF', `insight.facts`,
          `transformRef=${fact.transformRef} not in transforms`));
      }
    }
  }

  // ── 10. Time range doesn't exceed data capability ─────────────────────
  const dataset = getDataset(spec.instrument.symbol);
  if (dataset && spec.timeRange.count > dataset.length) {
    errors.push(makeError('TIME_RANGE_EXCEEDS_DATA', 'timeRange.count',
      `requested=${spec.timeRange.count}, available=${dataset.length}`));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/**
 * Validate that a patch is applicable to the current spec.
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
      const dataset = getDataset(spec.instrument.symbol);
      if (dataset && patch.count > dataset.length) {
        errors.push(makeError('TIME_RANGE_EXCEEDS_DATA', 'count',
          `requested=${patch.count}, available=${dataset.length}`));
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
          errors.push(makeError('METRIC_MARK_INCOMPATIBLE', 'mark',
            `${series.field} does not support ${patch.mark}`));
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
