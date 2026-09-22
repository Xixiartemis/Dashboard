/**
 * Renderer Contract Probe — minimal ECharts option compiler using official types.
 *
 * Purpose: prove that any valid DashboardSpec can be deterministically
 * compiled into a valid ECharts option structure using REAL ECharts types.
 *
 * Verified: single-series line, multi-series line, bar, multi-unit Y axes,
 * annotation/markPoint mapping.
 *
 * NOT a full renderer: no React, no DOM, no theme, no animation.
 */

import type { View } from '../schema/dashboard-spec';
import type { EnrichedRecord, RankedResult } from '../analytics/engine';
import type { EChartsOption, SeriesOption } from 'echarts';

// ── Compilation ────────────────────────────────────────────────────────────

export interface CompileResult {
  ok: true;
  option: EChartsOption;
}

export interface CompileFailure {
  ok: false;
  reason: string;
}

export type CompileOutput = CompileResult | CompileFailure;

export function compileViewToEChartsOption(
  view: View,
  data: EnrichedRecord[],
  transforms?: Map<string, RankedResult>,
): CompileOutput {
  if (data.length === 0) {
    return { ok: false, reason: 'No data to render' };
  }

  if (view.series.length === 0) {
    return { ok: false, reason: 'No series defined' };
  }

  // X-axis data (dates)
  const xData = data.map((r) => r.date);

  // Build distinct unit list for multi-Y-axis mapping
  const unitOrder: string[] = [];
  const unitIndexMap = new Map<string, number>();
  for (const s of view.series) {
    if (!unitIndexMap.has(s.unit)) {
      unitIndexMap.set(s.unit, unitOrder.length);
      unitOrder.push(s.unit);
    }
  }
  const needsMultiAxis = unitOrder.length > 1;

  // Build series options
  const echartsSeries: SeriesOption[] = [];

  for (const series of view.series) {
    const seriesData = data.map((r) => {
      const val = (r as unknown as Record<string, number>)[series.field];
      return typeof val === 'number' && Number.isFinite(val) ? val : null;
    });

    // Data validity check: at least one finite number required (Issue #5)
    const hasFiniteValue = seriesData.some((v) => v !== null && Number.isFinite(v));
    if (!hasFiniteValue) {
      return { ok: false, reason: `Series "${series.id}" has no finite data values (field="${series.field}")` };
    }

    const echartsS: SeriesOption = {
      name: series.id,
      type: series.mark,
      data: seriesData,
    };

    // Multi-axis: each distinct unit gets its own Y axis (Issue #14)
    if (needsMultiAxis) {
      (echartsS as any).yAxisIndex = unitIndexMap.get(series.unit);
    }

    // Map annotations via transforms
    if (view.annotations.length > 0 && transforms) {
      const markPoints: { coord: [number, number]; value?: number; name?: string }[] = [];

      for (const ann of view.annotations) {
        const ranked = transforms.get(ann.transformRef);
        if (ranked) {
          for (const rec of ranked.records) {
            const xIdx = data.findIndex((r) => r.date === rec.date);
            if (xIdx >= 0) {
              const val = (rec as unknown as Record<string, number>)[series.field];
              if (typeof val === 'number' && Number.isFinite(val)) {
                markPoints.push({
                  coord: [xIdx, val],
                  value: val,
                  name: ann.label,
                });
              }
            }
          }
        }
      }

      if (markPoints.length > 0) {
        (echartsS as any).markPoint = { data: markPoints };
      }
    }

    echartsSeries.push(echartsS);
  }

  // Build Y axis (one per distinct unit)
  let yAxis: EChartsOption['yAxis'];
  if (needsMultiAxis) {
    yAxis = unitOrder.map((unit) => ({
      type: 'value' as const,
      name: unit,
    }));
  } else {
    yAxis = { type: 'value' as const, name: unitOrder[0] };
  }

  const option: EChartsOption = {
    title: { text: view.title },
    xAxis: { type: 'category', data: xData },
    yAxis,
    series: echartsSeries,
    tooltip: { trigger: 'axis' },
  };

  return { ok: true, option };
}

/**
 * Validate that a compiled ECharts option has the minimal required structure
 * AND contains meaningful data (not all null).
 */
export function validateEChartsOption(option: EChartsOption): boolean {
  if (!option.xAxis || (option.xAxis as any).type !== 'category') return false;
  if (!(option.xAxis as any).data || (option.xAxis as any).data.length === 0) return false;
  if (!option.series || !Array.isArray(option.series) || option.series.length === 0) return false;

  for (const s of option.series as any[]) {
    if (s.type !== 'line' && s.type !== 'bar') return false;
    if (!s.data || s.data.length === 0) return false;
    if (s.data.length !== (option.xAxis as any).data.length) return false;
    // At least one finite value in the series (Issue #5)
    const hasFinite = s.data.some((v: unknown) => typeof v === 'number' && Number.isFinite(v));
    if (!hasFinite) return false;
  }

  // Multi-axis validation
  if (Array.isArray(option.yAxis)) {
    for (const y of option.yAxis) {
      if ((y as any).type !== 'value') return false;
    }
  }

  return true;
}
