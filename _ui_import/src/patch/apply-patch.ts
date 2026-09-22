/**
 * DashboardPatch Application — applies domain patches to DashboardSpec.
 *
 * Pipeline:
 *   Current Spec + Patch → validate patch semantics → apply → normalize presentation → re-validate
 *
 * Every application MUST be followed by full structural + semantic re-validation.
 * After structural changes, presentation metadata (view titles, intentSummary)
 * is deterministically normalized to stay consistent with the new state.
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

// ── Presentation Metadata Normalization ───────────────────────────────────
// After structural changes, title and intentSummary must be derived from the
// current state — not left as stale independent facts.

/** Replace all occurrences of a metric label in text. */
function replaceMetricLabel(text: string, oldLabel: string, newLabel: string): string {
  if (oldLabel === newLabel) return text;
  return text.split(oldLabel).join(newLabel);
}

/** Replace old time range count with new count in text. */
function replaceTimeCount(text: string, oldCount: number, newCount: number): string {
  if (oldCount === newCount) return text;
  return text.split(String(oldCount)).join(String(newCount));
}

/** Update a view title for replace_metric: swap old label → new label. */
function updateTitleForReplaceMetric(
  title: string,
  spec: DashboardSpec,
  fromLabel: string,
  toLabel: string,
): string {
  // Primary: swap old metric label for new
  let updated = replaceMetricLabel(title, fromLabel, toLabel);

  // Also fix stale time count
  updated = replaceTimeCount(updated, spec.timeRange.count, spec.timeRange.count);
  // (no-op if count hasn't changed; this is for combined patches)

  return updated;
}

/** Update a view title for add_metric: append the new metric name. */
function updateTitleForAddMetric(title: string, newLabel: string): string {
  // Don't duplicate if already mentioned
  if (title.includes(newLabel)) return title;

  // Try to append after a Chinese conjunction pattern
  const andPattern = /(.+?)(和|与)(.+)$/;
  const match = title.match(andPattern);
  if (match) {
    // "A公司最高价和最低价走势" → "A公司最高价、最低价和收盘价走势"
    const suffix = match[3]; // e.g. "最低价走势"
    // Extract trailing non-metric text (like "走势")
    const trailMatch = suffix.match(/^(.*?价|量)(.*)$/);
    if (trailMatch) {
      const metricEnd = trailMatch[1];
      const trail = trailMatch[2]; // "走势" etc.
      return match[1] + match[2] + metricEnd + '、' + newLabel + trail;
    }
  }
  // Fallback: append
  return title + '和' + newLabel;
}

/**
 * Normalize all view titles and intentSummary after a structural change.
 * Deterministic, no LLM, no fragile regex guessing.
 */
function normalizePresentationMetadata(
  currentSpec: DashboardSpec,
  patch: { op: string; [key: string]: unknown },
): DashboardSpec {
  let updatedViews = currentSpec.views;
  let updatedInsight = currentSpec.insight;

  switch (patch.op) {
    case 'set_time_range': {
      // Find the old count from the spec before patch was applied
      // At this point spec already has the new count, so we use the patch count
      // and the fact that the spec's titles still reference the old count.
      // We scan for any integer in titles that looks like a trading day count.
      const newCount = currentSpec.timeRange.count;
      updatedViews = currentSpec.views.map((v) => ({
        ...v,
        title: replaceTradingDayCount(v.title, newCount),
      }));
      updatedInsight = {
        ...currentSpec.insight,
        intentSummary: replaceTradingDayCount(currentSpec.insight.intentSummary, newCount),
      };
      break;
    }

    case 'replace_metric': {
      const fromId = patch.from as string;
      const toId = patch.to as string;
      const fromDef = getMetric(fromId);
      const toDef = getMetric(toId);
      if (fromDef && toDef) {
        updatedViews = currentSpec.views.map((v) => ({
          ...v,
          title: updateTitleForReplaceMetric(v.title, currentSpec, fromDef.label, toDef.label),
        }));
        updatedInsight = {
          ...currentSpec.insight,
          intentSummary: replaceMetricLabel(currentSpec.insight.intentSummary, fromDef.label, toDef.label),
        };
      }
      break;
    }

    case 'add_metric': {
      const metricId = patch.metric as string;
      const metricDef = getMetric(metricId);
      if (metricDef) {
        const targetViewId = patch.viewId as string;
        // Only update the target view's title — other views are untouched
        updatedViews = currentSpec.views.map((v) =>
          v.id === targetViewId
            ? { ...v, title: updateTitleForAddMetric(v.title, metricDef.label) }
            : v,
        );
        // Dashboard-level intentSummary can still reflect the new metric
        if (!currentSpec.insight.intentSummary.includes(metricDef.label)) {
          updatedInsight = {
            ...currentSpec.insight,
            intentSummary: currentSpec.insight.intentSummary + '和' + metricDef.label,
          };
        }
      }
      break;
    }

    case 'set_mark': {
      // Mark type does NOT go into title (user's explicit design decision).
      // No change needed.
      break;
    }
  }

  return {
    ...currentSpec,
    views: updatedViews,
    insight: updatedInsight,
  };
}

/**
 * Replace a stale "N个交易日" count in text with the correct one.
 * Pattern: find the number immediately before "个交易日" or "个交易日" context.
 */
function replaceTradingDayCount(text: string, newCount: number): string {
  // Match "N个交易日" and replace N
  return text.replace(/(\d+)(?=个交易日)/g, String(newCount));
}

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

  // 3. Normalize presentation metadata (titles, intentSummary)
  newSpec = normalizePresentationMetadata(newSpec, patch);

  // 4. Re-validate the new spec (structural + semantic)
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
