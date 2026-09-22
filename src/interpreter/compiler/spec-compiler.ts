/**
 * Spec Compiler — deterministic ResolvedInitialIntent → DashboardSpec.
 *
 * This is the ONLY Interpreter module that knows DashboardSpec structure.
 * It uses: Registry (metadata), Policy (structure decisions), Intent (user's goal).
 *
 * Compiler does NOT parse natural language. It receives already-resolved canonical IDs.
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
  // ── Validate instrument ──
  const inst = getInstrument(intent.instrument);
  if (!inst) {
    return { ok: false, error: makeInterpreterError('UNKNOWN_INSTRUMENT', `symbol=${intent.instrument}`) };
  }

  // ── Validate metrics ──
  if (intent.metrics.length === 0) {
    return { ok: false, error: makeInterpreterError('MISSING_METRICS') };
  }

  const metricDefs = intent.metrics.map((id) => {
    const def = getMetric(id);
    if (!def) return null;
    return def;
  });

  if (metricDefs.some((d) => d === null)) {
    const badIds = intent.metrics.filter((id) => !getMetric(id));
    return { ok: false, error: makeInterpreterError('UNKNOWN_METRIC', `ids=${badIds.join(',')}`) };
  }

  // ── Validate time range ──
  if (intent.timeRange.count < 1 || intent.timeRange.count > 60) {
    return { ok: false, error: makeInterpreterError('OUT_OF_RANGE', `count=${intent.timeRange.count}`) };
  }

  // ── Build MetricRef[] from Registry ──
  const metrics = intent.metrics.map((id) => {
    const def = getMetric(id)!;
    return { id: def.id, label: def.label, kind: def.kind, unit: def.unit };
  });

  // ── Determine display metrics (for views) vs analysis metrics (for closure) ──
  const displayMetricIds = intent.displayMetrics ?? intent.metrics;

  // ── Group display metrics by unit → views ──
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
          viewAnnotations.push({
            id: generateAnnotationId(generateTransformId(ranking.metric, ranking.order, ranking.limit)),
            type: 'highlight',
            transformRef: generateTransformId(ranking.metric, ranking.order, ranking.limit),
            label: ranking.annotationLabel || getRankingAnnotationLabel(ranking.metric, ranking.order),
          });
        }
      }
    }

    // For rankings whose metric is NOT in any display group (analysis-only),
    // attach the annotation to the first view (the "primary" view)
    if (views.length === 0 && intent.rankings) {
      for (const ranking of intent.rankings) {
        const inDisplay = displayMetricIds.includes(ranking.metric);
        if (!inDisplay) {
          viewAnnotations.push({
            id: generateAnnotationId(generateTransformId(ranking.metric, ranking.order, ranking.limit)),
            type: 'highlight',
            transformRef: generateTransformId(ranking.metric, ranking.order, ranking.limit),
            label: ranking.annotationLabel || getRankingAnnotationLabel(ranking.metric, ranking.order),
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

  // ── Build transforms from rankings ──
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

  // ── Build insight facts from rankings ──
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

  // ── Assemble DashboardSpec ──
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
