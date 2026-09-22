/**
 * Tests: Renderer Contract Probe — prove valid specs compile to valid ECharts options.
 */

import { describe, it, expect } from 'vitest';
import { compileViewToEChartsOption, validateEChartsOption } from '../src/renderer/echarts-probe';
import { runAnalytics } from '../src/analytics/engine';
import { computeChangePct, applyTimeRange } from '../src/analytics/engine';
import { MOCK_A_DATA } from '../src/data/mock-dataset';
import type { View } from '../src/schema/dashboard-spec';

describe('Renderer Contract Probe', () => {
  const data30 = applyTimeRange(computeChangePct(MOCK_A_DATA), 30);

  it('single-series line compiles to valid option', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.option.series.length).toBe(1);
      expect(result.option.series[0].type).toBe('line');
      expect(result.option.xAxis.data.length).toBe(30);
      expect(validateEChartsOption(result.option)).toBe(true);
    }
  });

  it('multi-series line compiles to valid option', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [
        { id: 's1', field: 'open', mark: 'line', unit: 'CNY' },
        { id: 's2', field: 'close', mark: 'line', unit: 'CNY' },
      ],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.option.series.length).toBe(2);
      expect(validateEChartsOption(result.option)).toBe(true);
    }
  });

  it('bar chart compiles to valid option', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'volume', mark: 'bar', unit: 'share' }],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.option.series[0].type).toBe('bar');
      expect(validateEChartsOption(result.option)).toBe(true);
    }
  });

  it('multi-series with different units uses multi-axis', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [
        { id: 's1', field: 'close', mark: 'line', unit: 'CNY' },
        { id: 's2', field: 'volume', mark: 'bar', unit: 'share' },
      ],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should have yAxis as array (multi-axis)
      expect(Array.isArray(result.option.yAxis)).toBe(true);
    }
  });

  it('annotation with transform creates markPoint', () => {
    const spec = {
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' as const },
      timeRange: { mode: 'relative' as const, basis: 'trading_day' as const, count: 30, end: '2025-12-31' },
    };
    const analytics = runAnalytics({
      schemaVersion: '1.0.0',
      ...spec,
      metrics: [
        { id: 'close', label: '收盘价', kind: 'raw' as const, unit: 'CNY' as const },
        { id: 'change_pct', label: '涨跌幅', kind: 'derived' as const, unit: '%' as const },
      ],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: 'x', asOf: '2025-12-31', timezone: 'Asia/Shanghai', priceAdjustment: 'raw' },
      transforms: [{ id: 'worst_3', type: 'rank' as const, field: 'change_pct', order: 'asc' as const, limit: 3 }],
      views: [{
        id: 'v1', title: 'Test',
        x: { field: 'date', type: 'ordinal' as const },
        series: [{ id: 's1', field: 'close', mark: 'line' as const, unit: 'CNY' as const }],
        annotations: [{ id: 'a1', type: 'highlight' as const, transformRef: 'worst_3', label: '跌幅最大' }],
      }],
      insight: { summary: 'test', facts: [] },
    });

    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [{ id: 'a1', type: 'highlight', transformRef: 'worst_3', label: '跌幅最大' }],
    };

    const result = compileViewToEChartsOption(view, analytics.series, analytics.transforms);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.option.series[0].markPoint).toBeDefined();
      expect(result.option.series[0].markPoint!.data.length).toBe(3);
    }
  });

  it('empty data returns failure', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, []);
    expect(result.ok).toBe(false);
  });

  it('validateEChartsOption rejects malformed option', () => {
    expect(validateEChartsOption({ xAxis: null, yAxis: null, series: [] } as any)).toBe(false);
    expect(validateEChartsOption({
      xAxis: { type: 'category', data: ['a', 'b'] },
      yAxis: { type: 'value' },
      series: [{ name: 's', type: 'pie', data: [1, 2] }],
    } as any)).toBe(false);
  });
});
