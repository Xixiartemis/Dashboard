/**
 * Tests: Renderer Contract Probe — prove valid specs compile to valid ECharts options
 * using real ECharts types.
 */

import { describe, it, expect } from 'vitest';
import { compileViewToEChartsOption, validateEChartsOption } from '../src/renderer/echarts-probe';
import { runAnalytics } from '../src/analytics/engine';
import { computeChangePct, applyTimeRange } from '../src/analytics/engine';
import { MOCK_A_DATA } from '../src/data/mock-dataset';
import type { View } from '../src/schema/dashboard-spec';
import type { EChartsOption } from 'echarts';

describe('Renderer Contract Probe', () => {
  const data30 = applyTimeRange(computeChangePct(MOCK_A_DATA), 30);

  it('single-series line compiles to valid ECharts option', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.option.series!.length).toBe(1);
      expect((result.option.series as any[])[0].type).toBe('line');
      expect((result.option.xAxis as any).data.length).toBe(30);
      expect(validateEChartsOption(result.option)).toBe(true);
    }
  });

  it('multi-series line compiles', () => {
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
    if (result.ok) expect(validateEChartsOption(result.option)).toBe(true);
  });

  it('bar chart compiles', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'volume', mark: 'bar', unit: 'share' }],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data30);
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.option.series as any[])[0].type).toBe('bar');
  });

  it('multi-unit creates one Y axis per distinct unit (Issue #14)', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [
        { id: 's1', field: 'close', mark: 'line', unit: 'CNY' },
        { id: 's2', field: 'volume', mark: 'bar', unit: 'share' },
        { id: 's3', field: 'change_pct', mark: 'line', unit: '%' },
      ],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data30);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 3 distinct units → 3 Y axes
      expect(Array.isArray(result.option.yAxis)).toBe(true);
      expect((result.option.yAxis as any[]).length).toBe(3);
      expect((result.option.yAxis as any[])[0].name).toBe('CNY');
      expect((result.option.yAxis as any[])[1].name).toBe('share');
      expect((result.option.yAxis as any[])[2].name).toBe('%');
      // Each series bound to correct axis
      expect((result.option.series as any[])[0].yAxisIndex).toBe(0);
      expect((result.option.series as any[])[1].yAxisIndex).toBe(1);
      expect((result.option.series as any[])[2].yAxisIndex).toBe(2);
    }
  });

  it('annotation creates markPoint', () => {
    const analytics = runAnalytics({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [
        { id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' },
        { id: 'change_pct', label: '涨跌幅', kind: 'derived', unit: '%' },
      ],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: 'mock-embedded-v1', asOf: '2025-12-31', timezone: 'Asia/Shanghai', priceAdjustment: 'raw' },
      transforms: [{ id: 'worst_3', type: 'rank', field: 'change_pct', order: 'asc', limit: 3 }],
      views: [{
        id: 'v1', title: 'Test',
        x: { field: 'date', type: 'ordinal' },
        series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
        annotations: [{ id: 'a1', type: 'highlight', transformRef: 'worst_3', label: '跌幅最大' }],
      }],
      insight: { intentSummary: 'test', facts: [] },
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
      expect((result.option.series as any[])[0].markPoint).toBeDefined();
      expect((result.option.series as any[])[0].markPoint.data.length).toBe(3);
    }
  });

  it('empty data returns failure', () => {
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [],
    };
    expect(compileViewToEChartsOption(view, []).ok).toBe(false);
  });

  it('all-null series returns failure (Issue #5)', () => {
    // Simulate a series where field='date' produces no numeric values
    const view: View = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [],
    };
    // Pass data with NaN close values
    const badData = data30.map((r) => ({ ...r, close: NaN }));
    const result = compileViewToEChartsOption(view, badData);
    expect(result.ok).toBe(false);
  });

  it('validateEChartsOption rejects malformed option', () => {
    expect(validateEChartsOption({} as EChartsOption)).toBe(false);
    expect(validateEChartsOption({
      xAxis: { type: 'value', data: [] },
      yAxis: { type: 'value' },
      series: [],
    } as unknown as EChartsOption)).toBe(false);
  });
});
