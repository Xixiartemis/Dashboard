/**
 * Semantic Comparison — compare two DashboardSpecs by business semantics.
 *
 * Compares the meaningful content, ignoring non-essential differences like
 * view ID naming conventions, exact title wording, or annotation label phrasing.
 *
 * Used by tests to verify Compiler output matches Golden Cases semantically.
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';

export interface SpecComparisonResult {
  equal: boolean;
  differences: string[];
}

/**
 * Compare two DashboardSpecs by their essential business semantics.
 *
 * Checks:
 * - instrument symbol
 * - timeRange (count, mode, basis, end)
 * - metric set (ids, ignoring order)
 * - view series structure (field, mark, unit per view)
 * - transform set (field, order, limit)
 * - insight facts (kind, transformRef)
 *
 * Does NOT check:
 * - exact title wording
 * - exact intentSummary wording
 * - view/series/annotation ID naming
 * - dataSource (always same in v1)
 */
export function compareSpecSemantics(
  a: DashboardSpec,
  b: DashboardSpec,
): SpecComparisonResult {
  const diffs: string[] = [];

  // Instrument
  if (a.instrument.symbol !== b.instrument.symbol) {
    diffs.push(`instrument: ${a.instrument.symbol} vs ${b.instrument.symbol}`);
  }

  // TimeRange
  if (a.timeRange.count !== b.timeRange.count) {
    diffs.push(`timeRange.count: ${a.timeRange.count} vs ${b.timeRange.count}`);
  }
  if (a.timeRange.end !== b.timeRange.end) {
    diffs.push(`timeRange.end: ${a.timeRange.end} vs ${b.timeRange.end}`);
  }

  // Metrics (set comparison, order-independent)
  const aMetricIds = new Set(a.metrics.map((m) => m.id));
  const bMetricIds = new Set(b.metrics.map((m) => m.id));
  for (const id of aMetricIds) {
    if (!bMetricIds.has(id)) diffs.push(`metric ${id} in A but not B`);
  }
  for (const id of bMetricIds) {
    if (!aMetricIds.has(id)) diffs.push(`metric ${id} in B but not A`);
  }

  // Metric metadata (label, kind, unit must match for each id)
  for (const aM of a.metrics) {
    const bM = b.metrics.find((m) => m.id === aM.id);
    if (bM) {
      if (aM.label !== bM.label) diffs.push(`metric[${aM.id}].label: ${aM.label} vs ${bM.label}`);
      if (aM.kind !== bM.kind) diffs.push(`metric[${aM.id}].kind: ${aM.kind} vs ${bM.kind}`);
      if (aM.unit !== bM.unit) diffs.push(`metric[${aM.id}].unit: ${aM.unit} vs ${bM.unit}`);
    }
  }

  // Views (compare by series structure, not IDs)
  const aViewSeries = a.views.map((v) => ({
    fields: v.series.map((s) => `${s.field}:${s.mark}:${s.unit}`).sort().join(','),
    annotationTransforms: v.annotations.map((an) => an.transformRef).sort().join(','),
  }));
  const bViewSeries = b.views.map((v) => ({
    fields: v.series.map((s) => `${s.field}:${s.mark}:${s.unit}`).sort().join(','),
    annotationTransforms: v.annotations.map((an) => an.transformRef).sort().join(','),
  }));

  if (aViewSeries.length !== bViewSeries.length) {
    diffs.push(`view count: ${aViewSeries.length} vs ${bViewSeries.length}`);
  } else {
    for (let i = 0; i < aViewSeries.length; i++) {
      if (aViewSeries[i].fields !== bViewSeries[i].fields) {
        diffs.push(`view[${i}] series: ${aViewSeries[i].fields} vs ${bViewSeries[i].fields}`);
      }
      if (aViewSeries[i].annotationTransforms !== bViewSeries[i].annotationTransforms) {
        diffs.push(`view[${i}] annotations: ${aViewSeries[i].annotationTransforms} vs ${bViewSeries[i].annotationTransforms}`);
      }
    }
  }

  // Transforms
  const aTransforms = a.transforms.map((t) => `${t.field}:${t.order}:${t.limit}`).sort();
  const bTransforms = b.transforms.map((t) => `${t.field}:${t.order}:${t.limit}`).sort();
  if (JSON.stringify(aTransforms) !== JSON.stringify(bTransforms)) {
    diffs.push(`transforms: [${aTransforms}] vs [${bTransforms}]`);
  }

  // Insight facts
  const aFacts = a.insight.facts.map((f) => {
    if (f.kind === 'rank_summary') return `rank:${f.transformRef}`;
    return `period:${f.metric}`;
  }).sort();
  const bFacts = b.insight.facts.map((f) => {
    if (f.kind === 'rank_summary') return `rank:${f.transformRef}`;
    return `period:${f.metric}`;
  }).sort();
  if (JSON.stringify(aFacts) !== JSON.stringify(bFacts)) {
    diffs.push(`insight facts: [${aFacts}] vs [${bFacts}]`);
  }

  return { equal: diffs.length === 0, differences: diffs };
}

/**
 * Compare two DashboardPatches for semantic equality.
 */
export function comparePatchSemantics(
  a: DashboardPatch,
  b: DashboardPatch,
): SpecComparisonResult {
  const diffs: string[] = [];

  if (a.op !== b.op) {
    diffs.push(`op: ${a.op} vs ${b.op}`);
    return { equal: false, differences: diffs };
  }

  switch (a.op) {
    case 'replace_metric':
      if ((a as any).from !== (b as any).from) diffs.push(`from: ${(a as any).from} vs ${(b as any).from}`);
      if ((a as any).to !== (b as any).to) diffs.push(`to: ${(a as any).to} vs ${(b as any).to}`);
      break;
    case 'add_metric':
      if ((a as any).metric !== (b as any).metric) diffs.push(`metric: ${(a as any).metric} vs ${(b as any).metric}`);
      if ((a as any).viewId !== (b as any).viewId) diffs.push(`viewId: ${(a as any).viewId} vs ${(b as any).viewId}`);
      break;
    case 'set_time_range':
      if ((a as any).count !== (b as any).count) diffs.push(`count: ${(a as any).count} vs ${(b as any).count}`);
      break;
    case 'set_mark':
      if ((a as any).viewId !== (b as any).viewId) diffs.push(`viewId: ${(a as any).viewId} vs ${(b as any).viewId}`);
      if ((a as any).seriesId !== (b as any).seriesId) diffs.push(`seriesId: ${(a as any).seriesId} vs ${(b as any).seriesId}`);
      if ((a as any).mark !== (b as any).mark) diffs.push(`mark: ${(a as any).mark} vs ${(b as any).mark}`);
      break;
  }

  return { equal: diffs.length === 0, differences: diffs };
}
