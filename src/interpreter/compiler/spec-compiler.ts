/**
 * Spec Compiler — deterministic ResolvedInitialIntent → DashboardSpec.
 *
 * This is the ONLY Interpreter module that knows DashboardSpec structure.
 * It uses: Registry (metadata), Policy (structure decisions), Intent (user's goal).
 *
 * Compiler does NOT parse natural language. It receives already-resolved canonical IDs.
 *
 * Invariant: compileInitialIntent(ok:true) means the intent is internally coherent
 * AND the resulting spec satisfies all Compiler-checkable invariants.
 * Downstream Validator should only catch things the Compiler cannot know
 * (e.g. dataset availability).
 */

import type { DashboardSpec, View, Transform, Annotation } from '../../schema/dashboard-spec';
import type { ResolvedInitialIntent } from '../intent';
import type { InterpreterError } from '../errors';
import { makeInterpreterError } from '../errors';
import { getInstrument } from '../../registries/instruments';
import { getMetric } from '../../registries/metrics';
import { MANIFEST } from '../../data/manifest';
import {
  groupMetricsByUnit,
  getDefaultMark,
  generateViewId,
  generateSeriesId,
  generateAnnotationId,
  generateTransformId,
  generateViewTitle,
  generateIntentSummary,
  getRankingAnnotationLabel,
} from '../policies';

export interface CompileResult {
  ok: true;
  spec: DashboardSpec;
}

export interface CompileFailure {
  ok: false;
  error: InterpreterError;
}

export type CompileOutput = CompileResult | CompileFailure;

/**
 * Compile a ResolvedInitialIntent into a complete DashboardSpec.
 *
 * Deterministic: same input → same output. No randomness, no Date.now(), no LLM.
 */
export function compileInitialIntent(intent: ResolvedInitialIntent): CompileOutput {
  // ── 1. Validate instrument ──
  const inst = getInstrument(intent.instrument);
  if (!inst) {
    return { ok: false, error: makeInterpreterError('UNKNOWN_INSTRUMENT', `symbol=${intent.instrument}`) };
  }

  // ── 2. Validate metrics: non-empty, all known, no duplicates ──
  if (intent.metrics.length === 0) {
    return { ok: false, error: makeInterpreterError('MISSING_METRICS') };
  }

  const metricSet = new Set<string>();
  for (const id of intent.metrics) {
    if (metricSet.has(id)) {
      return { ok: false, error: makeInterpreterError('CONFLICTING_INTENT', `duplicate metric: ${id}`) };
    }
    metricSet.add(id);
    if (!getMetric(id)) {
      return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `id=${id}`) };
    }
  }

  // ── 3. Validate displayMetrics ──
  const displayMetricIds = intent.displayMetrics ?? intent.metrics;
  if (displayMetricIds.length === 0) {
    return { ok: false, error: makeInterpreterError('MISSING_METRICS', 'displayMetrics is empty') };
  }
  const displaySet = new Set<string>();
  for (const id of displayMetricIds) {
    if (displaySet.has(id)) {
      return { ok: false, error: makeInterpreterError('CONFLICTING_INTENT', `duplicate displayMetric: ${id}`) };
    }
    displaySet.add(id);
    if (!metricSet.has(id)) {
      return { ok: false, error: makeInterpreterError('CONFLICTING_INTENT', `displayMetric "${id}" not in metrics`) };
    }
  }

  // ── 4. Validate time range ──
  if (intent.timeRange.count < 1 || intent.timeRange.count > 60) {
    return { ok: false, error: makeInterpreterError('OUT_OF_RANGE', `count=${intent.timeRange.count}`) };
  }

  // ── 5. Validate rankings: metric ∈ metrics, limit >= 1, no duplicate transform IDs ──
  const transformIds = new Set<string>();
  if (intent.rankings) {
    for (const ranking of intent.rankings) {
      if (!metricSet.has(ranking.metric)) {
        return { ok: false, error: makeInterpreterError('CONFLICTING_INTENT', `ranking.metric "${ranking.metric}" not in metrics`) };
      }
      if (ranking.limit < 1) {
        return { ok: false, error: makeInterpreterError('OUT_OF_RANGE', `ranking.limit=${ranking.limit}`) };
      }
      const tid = generateTransformId(ranking.metric, ranking.order, ranking.limit);
      if (transformIds.has(tid)) {
        return { ok: false, error: makeInterpreterError('CONFLICTING_INTENT', `duplicate transform: ${tid}`) };
      }
      transformIds.add(tid);
    }
  }

  // ── 6. Build MetricRef[] from Registry ──
  const metrics = intent.metrics.map((id) => {
    const def = getMetric(id)!;
    return { id: def.id, label: def.label, kind: def.kind, unit: def.unit };
  });

  // ── 7. Group display metrics by unit → views ──
  const groups = groupMetricsByUnit(displayMetricIds);
  const views: View[] = [];

  for (const group of groups) {
    const series = group.metricIds.map((metricId) => {
      const def = getMetric(metricId)!;
      const mark = intent.preferredMark ?? getDefaultMark(metricId);
      return {
        id: generateSeriesId(metricId),
        field: metricId,
        mark,
        unit: def.unit,
      };
    });

    const metricLabels = group.metricIds.map((id) => getMetric(id)!.label);
    const title = generateViewTitle(inst.displayName, intent.timeRange.count, metricLabels);
    const viewId = generateViewId(group.metricIds);

    // Find rankings that apply to metrics in this view
    const viewAnnotations: Annotation[] = [];
    if (intent.rankings) {
      for (const ranking of intent.rankings) {
        if (group.metricIds.includes(ranking.metric)) {
          const tid = generateTransformId(ranking.metric, ranking.order, ranking.limit);
          viewAnnotations.push({
            id: generateAnnotationId(tid),
            type: 'highlight',
            transformRef: tid,
            label: getRankingAnnotationLabel(ranking.metric, ranking.order),
          });
        }
      }
    }

    // For rankings whose metric is NOT in any display group (analysis-only),
    // attach the annotation to the first view (the "primary" view)
    if (views.length === 0 && intent.rankings) {
      for (const ranking of intent.rankings) {
        if (!displaySet.has(ranking.metric)) {
          const tid = generateTransformId(ranking.metric, ranking.order, ranking.limit);
          viewAnnotations.push({
            id: generateAnnotationId(tid),
            type: 'highlight',
            transformRef: tid,
            label: getRankingAnnotationLabel(ranking.metric, ranking.order),
          });
        }
      }
    }

    views.push({
      id: viewId,
      title,
      x: { field: 'date', type: 'ordinal' },
      series,
      annotations: viewAnnotations,
    });
  }

  // ── 8. Build transforms from rankings ──
  const transforms: Transform[] = [];
  if (intent.rankings) {
    for (const ranking of intent.rankings) {
      transforms.push({
        id: generateTransformId(ranking.metric, ranking.order, ranking.limit),
        type: 'rank',
        field: ranking.metric,
        order: ranking.order,
        limit: ranking.limit,
      });
    }
  }

  // ── 9. Build insight facts from rankings ──
  const facts: DashboardSpec['insight']['facts'] = [];
  if (intent.rankings) {
    for (const ranking of intent.rankings) {
      facts.push({
        kind: 'rank_summary',
        transformRef: generateTransformId(ranking.metric, ranking.order, ranking.limit),
      });
    }
  }

  const metricLabels = intent.metrics.map((id) => getMetric(id)!.label);

  // ── 10. Assemble DashboardSpec ──
  const spec: DashboardSpec = {
    schemaVersion: '1.0.0',
    instrument: {
      symbol: inst.symbol,
      displayName: inst.displayName,
      assetType: inst.assetType,
    },
    timeRange: {
      mode: 'relative',
      basis: 'trading_day',
      count: intent.timeRange.count,
      end: 'data_as_of',
    },
    metrics,
    dataSource: {
      preference: 'embedded_mock',
      resolved: 'embedded_mock',
      datasetId: MANIFEST.datasetId,
      asOf: MANIFEST.asOf,
      timezone: MANIFEST.timezone,
      priceAdjustment: 'raw',
    },
    transforms,
    views,
    insight: {
      intentSummary: generateIntentSummary(inst.displayName, intent.timeRange.count, metricLabels),
      facts,
    },
  };

  return { ok: true, spec };
}
