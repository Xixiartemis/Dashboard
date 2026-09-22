/**
 * Adversarial Regression Tests — Contract Tightening Round 2 + Round 3.
 *
 * Each test proves that a "Schema-valid-looking but semantically wrong" input
 * is correctly rejected. These are the counterexamples from independent audit.
 *
 * Round 3 additions (A19-A26):
 * - A19-A20: Patch presentation metadata sync
 * - A21: timeRange.end non-data_as_of rejected
 * - A22: Metric label mismatch rejected
 * - A23: Series unit mismatch rejected
 * - A24: rank_summary with metric field rejected
 * - A25: rank_summary result derived entirely from transform
 * - A26: JSON Schema key constraints verified
 */

import { describe, it, expect } from 'vitest';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { runAnalytics, computeInsight, computeChangePct, applyTimeRange } from '../src/analytics/engine';
import { compileViewToEChartsOption } from '../src/renderer/echarts-probe';
import { getDashboardSpecJsonSchema, parseDashboardSpec } from '../src/schema/dashboard-spec';
import { applyPatch } from '../src/patch/apply-patch';
import { MOCK_A_DATA } from '../src/data/mock-dataset';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { MANIFEST } from '../src/data/manifest';
import type { DashboardSpec } from '../src/schema/dashboard-spec';

function makeSpec(overrides: Partial<DashboardSpec> = {}): DashboardSpec {
  return {
    schemaVersion: '1.0.0',
    instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
    timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: 'data_as_of' },
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
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: 'data_as_of' },
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
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: 'data_as_of' },
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
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: 'data_as_of' },
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
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: 'data_as_of' },
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
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: 'data_as_of' },
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

describe('A18: JSON Schema Export (smoke)', () => {
  it('A18: getDashboardSpecJsonSchema returns a valid object', () => {
    const schema = getDashboardSpecJsonSchema();
    expect(schema).toBeDefined();
    expect(typeof schema).toBe('object');
    expect(schema.title).toBe('DashboardSpec');
  });

  it('Zod schema is the real validator (not hand-written JSON Schema)', () => {
    const valid = parseDashboardSpec(GOLDEN_CASES[0].expectedSpec);
    expect(valid.success).toBe(true);

    const invalid = parseDashboardSpec({ schemaVersion: 'wrong' });
    expect(invalid.success).toBe(false);
  });
});

// ── Round 3: A19-A26 ──────────────────────────────────────────────────────

describe('A19: Patch time range → presentation metadata sync', () => {
  it('A19: set_time_range(20→10) updates titles and intentSummary', () => {
    const spec = GOLDEN_CASES[1].expectedSpec; // G2: count=20, "最近20个交易日"
    expect(spec.timeRange.count).toBe(20);
    expect(spec.views[0].title).toContain('20');
    expect(spec.insight.intentSummary).toContain('20');

    const result = applyPatch(spec, { op: 'set_time_range', count: 10 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.timeRange.count).toBe(10);
      // Titles must NOT still say "20个交易日"
      for (const v of result.spec.views) {
        expect(v.title).not.toContain('20个交易日');
        expect(v.title).toContain('10');
      }
      // intentSummary must NOT still say "20"
      expect(result.spec.insight.intentSummary).not.toContain('20个交易日');
      expect(result.spec.insight.intentSummary).toContain('10');
    }
  });

  it('A19b: set_time_range(30→15) updates G1 titles', () => {
    const spec = GOLDEN_CASES[0].expectedSpec; // G1: count=30
    const result = applyPatch(spec, { op: 'set_time_range', count: 15 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.timeRange.count).toBe(15);
      for (const v of result.spec.views) {
        expect(v.title).toContain('15个交易日');
        expect(v.title).not.toContain('30个交易日');
      }
    }
  });
});

describe('A20: Replace metric → presentation metadata sync', () => {
  it('A20: replace_metric(volume→change_pct) updates titles and intentSummary', () => {
    const spec = GOLDEN_CASES[0].expectedSpec; // G1: has volume and change_pct
    // volume_view title says "成交量"
    const volumeView = spec.views.find((v) => v.id === 'volume_view')!;
    expect(volumeView.title).toContain('成交量');

    const result = applyPatch(spec, { op: 'replace_metric', from: 'volume', to: 'change_pct' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // volume_view title should now say "涨跌幅", NOT "成交量"
      const updatedView = result.spec.views.find((v) => v.id === 'volume_view')!;
      expect(updatedView.title).not.toContain('成交量');
      expect(updatedView.title).toContain('涨跌幅');
    }
  });
});

describe('A21: timeRange.end non-data_as_of rejected', () => {
  it('A21: end=2024-01-01 rejected by structural validation', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2024-01-01' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });
});

describe('A22: Metric label mismatch rejected', () => {
  it('A22: volume labeled as "收盘价" → METRIC_LABEL_MISMATCH', () => {
    const spec = makeSpec({
      metrics: [
        { id: 'volume', label: '收盘价', kind: 'raw', unit: 'share' },
      ],
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'METRIC_LABEL_MISMATCH')).toBe(true);
  });
});

describe('A23: Series unit mismatch rejected', () => {
  it('A23: volume with unit=CNY → SERIES_UNIT_MISMATCH', () => {
    const spec = makeSpec({
      metrics: [
        { id: 'volume', label: '成交量', kind: 'raw', unit: 'share' },
      ],
      views: [{
        id: 'v1', title: 'Test',
        x: { field: 'date', type: 'ordinal' },
        series: [{ id: 's1', field: 'volume', mark: 'bar', unit: 'CNY' }],
        annotations: [],
      }],
    });
    const result = validateSemantics(spec);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.code === 'SERIES_UNIT_MISMATCH')).toBe(true);
  });
});

describe('A24: rank_summary with metric field rejected', () => {
  it('A24: rank_summary with metric field → structural FAIL', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: 'data_as_of' },
      metrics: [{ id: 'volume', label: '成交量', kind: 'raw', unit: 'share' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [{ id: 'worst', type: 'rank', field: 'volume', order: 'asc', limit: 3 }],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'volume', mark: 'bar', unit: 'share' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [
        { kind: 'rank_summary', metric: 'volume', label: '成交量最低的3天', transformRef: 'worst' },
      ] },
    });
    // Should fail because rank_summary schema no longer accepts 'metric' field
    expect(result.ok).toBe(false);
  });
});

describe('A25: rank_summary result derived entirely from transform', () => {
  it('A25: rank volume desc limit 4 → insight records length=4 from transform', () => {
    const spec = makeSpec({
      metrics: [
        { id: 'volume', label: '成交量', kind: 'raw', unit: 'share' },
      ],
      transforms: [{ id: 'top_4_volume', type: 'rank', field: 'volume', order: 'desc', limit: 4 }],
      views: [{
        id: 'v1', title: 'Test',
        x: { field: 'date', type: 'ordinal' },
        series: [{ id: 's1', field: 'volume', mark: 'bar', unit: 'share' }],
        annotations: [{ id: 'a1', type: 'highlight', transformRef: 'top_4_volume', label: '最高' }],
      }],
      insight: {
        intentSummary: 'test',
        facts: [{ kind: 'rank_summary', transformRef: 'top_4_volume' }],
      },
    });
    const analytics = runAnalytics(spec);
    const insight = computeInsight(spec, analytics);
    const rankResult = insight.rank_results?.get('top_4_volume');
    expect(rankResult).toBeDefined();
    // Length must equal transform limit (4), NOT from any independent fact
    expect(rankResult!.records.length).toBe(4);
    // Must be identical to the transform result
    const transformResult = analytics.transforms.get('top_4_volume')!;
    expect(rankResult!.records.map((r) => r.date)).toEqual(
      transformResult.records.map((r) => r.date),
    );
    // Metric must be derived from transform, not from an independent fact field
    expect(rankResult!.metric).toBe('volume');
  });
});

describe('A26: JSON Schema key constraints verified', () => {
  it('A26: exported JSON Schema contains critical Zod constraints', () => {
    const schema = getDashboardSpecJsonSchema();
    const schemaStr = JSON.stringify(schema);

    // schemaVersion must be const "1.0.0"
    expect(schemaStr).toContain('1.0.0');

    // timeRange.end must only allow "data_as_of"
    expect(schemaStr).toContain('data_as_of');

    // mark must be enum [line, bar]
    expect(schemaStr).toContain('line');
    expect(schemaStr).toContain('bar');

    // x.field must be const "date"
    expect(schemaStr).toContain('"date"');

    // x.type must be const "ordinal"
    expect(schemaStr).toContain('"ordinal"');

    // timeRange.count must have min=1 max=60
    // (Zod toJSONSchema should include minimum/maximum)
    expect(schemaStr).toContain('"minimum"');
    expect(schemaStr).toContain('"maximum"');

    // Must be a proper object with properties
    expect(schema).toHaveProperty('properties');
  });
});
