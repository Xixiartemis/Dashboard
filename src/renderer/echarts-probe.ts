/**
 * Renderer Contract Probe — minimal ECharts option compiler.
 *
 * Purpose: prove that any valid DashboardSpec can be deterministically
 * compiled into a valid ECharts option structure. NOT a full renderer.
 *
 * Verified: single-series line, multi-series line, bar, annotations.
 * No UI, themes, animations, tooltips, responsive layout.
 */

import type { View } from '../schema/dashboard-spec';
import type { EnrichedRecord, RankedResult } from '../analytics/engine';

// ── ECharts option types (minimal) ─────────────────────────────────────────

export interface EChartsSeriesOption {
  name: string;
  type: 'line' | 'bar';
  data: (number | null)[];
  xAxisIndex?: number;
  yAxisIndex?: number;
  markPoint?: {
    data: { coord: [number, number]; value?: number; name?: string }[];
  };
}

export interface EChartsOption {
  title?: { text: string };
  xAxis: {
    type: 'category';
    data: string[];
  };
  yAxis: {
    type: 'value';
    name?: string;
  } | {
    type: 'value';
    name?: string;
  }[];
  series: EChartsSeriesOption[];
  tooltip?: { trigger: string };
}

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

  // Determine if we need multiple Y axes (different units)
  const units = new Set(view.series.map((s) => s.unit));
  const needsMultiAxis = units.size > 1;

  // Build series options
  const echartsSeries: EChartsSeriesOption[] = [];

  for (const series of view.series) {
    const seriesData = data.map((r) => {
      const val = (r as unknown as Record<string, number>)[series.field];
      return typeof val === 'number' ? val : null;
    });

    const echartsS: EChartsSeriesOption = {
      name: series.id,
      type: series.mark,
      data: seriesData,
    };

    // For multi-axis, assign price metrics to axis 0, volume/% to axis 1
    if (needsMultiAxis) {
      if (series.unit === 'CNY') {
        echartsS.yAxisIndex = 0;
      } else {
        echartsS.yAxisIndex = 1;
      }
    }

    // Map annotations that reference transforms
    if (view.annotations.length > 0 && transforms) {
      const markPoints: { coord: [number, number]; value?: number; name?: string }[] = [];

      for (const ann of view.annotations) {
        const ranked = transforms.get(ann.transformRef);
        if (ranked) {
          for (const rec of ranked.records) {
            const xIdx = data.findIndex((r) => r.date === rec.date);
            if (xIdx >= 0) {
              const val = (rec as unknown as Record<string, number>)[series.field];
              if (typeof val === 'number') {
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
        echartsS.markPoint = { data: markPoints };
      }
    }

    echartsSeries.push(echartsS);
  }

  // Build Y axis
  let yAxis: EChartsOption['yAxis'];
  if (needsMultiAxis) {
    yAxis = [
      { type: 'value', name: 'CNY' },
      { type: 'value', name: Array.from(units).filter((u) => u !== 'CNY').join('/') },
    ];
  } else {
    yAxis = { type: 'value', name: Array.from(units)[0] };
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
 * Validate that a compiled ECharts option has the minimal required structure.
 */
export function validateEChartsOption(option: EChartsOption): boolean {
  if (!option.xAxis || option.xAxis.type !== 'category') return false;
  if (!option.xAxis.data || option.xAxis.data.length === 0) return false;
  if (!option.series || option.series.length === 0) return false;

  for (const s of option.series) {
    if (s.type !== 'line' && s.type !== 'bar') return false;
    if (!s.data || s.data.length === 0) return false;
    if (s.data.length !== option.xAxis.data.length) return false;
  }

  return true;
}
