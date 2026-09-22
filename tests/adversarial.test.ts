/**
 * Adversarial Regression Tests — Contract Tightening Round 2.
 *
 * Each test proves that a "Schema-valid-looking but semantically wrong" input
 * is correctly rejected. These are the counterexamples from independent audit.
 */

import { describe, it, expect } from 'vitest';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { runAnalytics, computeInsight, computeChangePct, applyTimeRange } from '../src/analytics/engine';
import { compileViewToEChartsOption } from '../src/renderer/echarts-probe';
import { getDashboardSpecJsonSchema, parseDashboardSpec } from '../src/schema/dashboard-spec';
import { MOCK_A_DATA } from '../src/data/mock-dataset';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { MANIFEST } from '../src/data/manifest';
import type { DashboardSpec } from '../src/schema/dashboard-spec';

function makeSpec(overrides: Partial<DashboardSpec> = {}): DashboardSpec {
  return {
    schemaVersion: '1.0.0',
    instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
    timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
    metrics: [
      { id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' },
      { id: 'volume', label: '成交量', kind: 'raw', unit: 'share' },
    ],
    dataSource: {
      preference: 'embedded_mock',
      resolved: 'embedded_mock',
      datasetId: MANIFEST.datasetId,
      asOf: MANIFEST.asOf,
      timezone: MANIFEST.timezone,
      priceAdjustment: 'raw',
    },
    transforms: [],
    views: [{
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [],
    }],
    insight: { intentSummary: 'test', facts: [] },
    ...overrides,
  } as DashboardSpec;
}

describe('A1-A5: DataSource Provenance', () => {
  it('A1: resolved=wencai rejected by structural validation', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'auto', resolved: 'wencai', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('A2: datasetId mismatch rejected by semantic validation', () => {
    const spec = makeSpec({
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: 'WRONG_ID', asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'UNRESOLVED_PROVIDER')).toBe(true);
  });

  it('A3: asOf mismatch rejected', () => {
    const spec = makeSpec({
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: '2030-01-01', timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
  });

  it('A4: timezone mismatch rejected', () => {
    const spec = makeSpec({
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: 'UTC', priceAdjustment: 'raw' },
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
  });

  it('A5: priceAdjustment=adjusted rejected by structural validation', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'adjusted' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });
});

describe('A6-A8: Metric Dependency Closure', () => {
  it('A6: series uses volume but metrics only has close → FAIL', () => {
    const spec = makeSpec({
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      views: [{
        id: 'v1', title: 'Test',
        x: { field: 'date', type: 'ordinal' },
        series: [{ id: 's1', field: 'volume', mark: 'bar', unit: 'share' }],
        annotations: [],
      }],
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'MISSING_SERIES_FIELD')).toBe(true);
  });

  it('A7: transform uses volume but metrics only has close → FAIL', () => {
    const spec = makeSpec({
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      transforms: [{ id: 't1', type: 'rank', field: 'volume', order: 'desc', limit: 5 }],
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'MISSING_SERIES_FIELD')).toBe(true);
  });

  it('A8: insight uses volume but metrics only has close → FAIL', () => {
    const spec = makeSpec({
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      insight: { intentSummary: 'test', facts: [{ kind: 'period_change', metric: 'volume', label: '成交量变化' }] },
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'MISSING_SERIES_FIELD')).toBe(true);
  });
});

describe('A9-A10: X-Axis Contract', () => {
  it('A9: x.field=close rejected by structural validation', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'close', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('A10: x.type=linear rejected by structural validation', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'linear' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });
});

describe('A11-A12: Instrument Metadata Consistency', () => {
  it('A11: MOCK.A with wrong displayName rejected', () => {
    const spec = makeSpec({
      instrument: { symbol: 'MOCK.A', displayName: 'B公司', assetType: 'equity' },
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'UNKNOWN_INSTRUMENT')).toBe(true);
  });

  it('A12: MOCK.A with wrong assetType rejected', () => {
    const spec = makeSpec({
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'crypto' },
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'UNKNOWN_INSTRUMENT')).toBe(true);
  });
});

describe('A13: schemaVersion Literal', () => {
  it('A13: schemaVersion=abc rejected', () => {
    const result = validateStructure({
      schemaVersion: 'abc',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });
});

describe('A14: Renderer Series Data Validity', () => {
  it('A14: all-null series rejected by Renderer Probe', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      open: NaN, high: NaN, low: NaN, close: NaN, volume: 0,
      change_pct: 0,
    }));
    const view = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' as const },
      series: [{ id: 's1', field: 'close', mark: 'line' as const, unit: 'CNY' as const }],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data);
    expect(result.ok).toBe(false);
  });
});

describe('A15-A16: Insight/Transform Consistency', () => {
  it('A15: ranking insight records count matches transform limit', () => {
    const spec = GOLDEN_CASES[0].expectedSpec; // G1 has worst_3_days (limit=3)
    const analytics = runAnalytics(spec);
    const insight = computeInsight(spec, analytics);
    const rankResult = insight.rank_results?.get('worst_3_days');
    expect(rankResult).toBeDefined();
    expect(rankResult!.records.length).toBe(3);
  });

  it('A16: ranking insight records are identical to transform records (same source)', () => {
    const spec = GOLDEN_CASES[3].expectedSpec; // G4 has top_5_volume (limit=5)
    const analytics = runAnalytics(spec);
    const insight = computeInsight(spec, analytics);
    const rankResult = insight.rank_results?.get('top_5_volume');
    const transformResult = analytics.transforms.get('top_5_volume');
    expect(rankResult).toBeDefined();
    expect(transformResult).toBeDefined();
    // Exact same dates in exact same order
    expect(rankResult!.records.map((r) => r.date)).toEqual(
      transformResult!.records.map((r) => r.date),
    );
    expect(rankResult!.records.length).toBe(5);
  });
});

describe('A17: Multi-Unit Y Axis', () => {
  it('A17: 3 distinct units create 3 Y axes', () => {
    const data = applyTimeRange(computeChangePct(MOCK_A_DATA), 30);
    const view = {
      id: 'v1', title: 'Test',
      x: { field: 'date', type: 'ordinal' as const },
      series: [
        { id: 's1', field: 'close', mark: 'line' as const, unit: 'CNY' as const },
        { id: 's2', field: 'volume', mark: 'bar' as const, unit: 'share' as const },
        { id: 's3', field: 'change_pct', mark: 'line' as const, unit: '%' as const },
      ],
      annotations: [],
    };
    const result = compileViewToEChartsOption(view, data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.option.yAxis)).toBe(true);
      expect((result.option.yAxis as any[]).length).toBe(3);
    }
  });
});

describe('A18: JSON Schema Export', () => {
  it('A18: getDashboardSpecJsonSchema returns an object', () => {
    const schema = getDashboardSpecJsonSchema();
    expect(schema).toBeDefined();
    expect(typeof schema).toBe('object');
    expect(schema.title).toBe('DashboardSpec');
  });

  it('Zod schema is the real validator (not hand-written JSON Schema)', () => {
    // Verify that Zod correctly validates/rejects
    const valid = parseDashboardSpec(GOLDEN_CASES[0].expectedSpec);
    expect(valid.success).toBe(true);

    const invalid = parseDashboardSpec({ schemaVersion: 'wrong' });
    expect(invalid.success).toBe(false);
  });
});
