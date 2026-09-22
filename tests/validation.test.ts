/**
 * Tests: Schema structural + semantic validation.
 */

import { describe, it, expect } from 'vitest';

import { parseDashboardPatch } from '../src/schema/dashboard-patch';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics, validatePatchSemantics } from '../src/validation/semantic';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { NEGATIVE_CASES } from '../src/fixtures/negative-cases';
import { MANIFEST } from '../src/data/manifest';

describe('Structural Validation', () => {
  it('rejects null input', () => {
    expect(validateStructure(null).ok).toBe(false);
  });

  it('rejects empty object', () => {
    expect(validateStructure({}).ok).toBe(false);
  });

  it('rejects unknown properties', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
      unknownField: 'should fail',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects schemaVersion != 1.0.0', () => {
    const result = validateStructure({
      schemaVersion: '2.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects x.field != date', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'close', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects x.type != ordinal', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'linear' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('rejects resolved != embedded_mock', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'auto', resolved: 'wencai', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('all golden cases pass structural validation', () => {
    for (const gc of GOLDEN_CASES) {
      expect(validateStructure(gc.expectedSpec).ok).toBe(true);
    }
  });
});

describe('Semantic Validation', () => {
  it('all golden cases pass semantic validation', () => {
    for (const gc of GOLDEN_CASES) {
      expect(validateSemantics(gc.expectedSpec).ok).toBe(true);
    }
  });

  it('rejects unknown instrument (N1)', () => {
    const n1 = NEGATIVE_CASES.find((c) => c.id === 'N1')!;
    const result = validateSemantics(n1.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('UNKNOWN_INSTRUMENT');
  });

  it('rejects unsupported metric (N2)', () => {
    const n2 = NEGATIVE_CASES.find((c) => c.id === 'N2')!;
    const result = validateSemantics(n2.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('UNSUPPORTED_METRIC');
  });

  it('rejects non-existent series field (N5)', () => {
    const n5 = NEGATIVE_CASES.find((c) => c.id === 'N5')!;
    const result = validateSemantics(n5.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('MISSING_SERIES_FIELD');
  });

  it('rejects non-existent transform reference (N6)', () => {
    const n6 = NEGATIVE_CASES.find((c) => c.id === 'N6')!;
    const result = validateSemantics(n6.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('MISSING_TRANSFORM_REF');
  });
});

describe('Patch Validation', () => {
  it('valid patches parse', () => {
    expect(parseDashboardPatch({ op: 'replace_metric', from: 'volume', to: 'change_pct' }).success).toBe(true);
    expect(parseDashboardPatch({ op: 'add_metric', metric: 'close', viewId: 'v1' }).success).toBe(true);
    expect(parseDashboardPatch({ op: 'set_time_range', count: 10 }).success).toBe(true);
    expect(parseDashboardPatch({ op: 'set_mark', viewId: 'v1', seriesId: 's1', mark: 'line' }).success).toBe(true);
  });

  it('rejects invalid op', () => {
    expect(parseDashboardPatch({ op: 'delete_everything' }).success).toBe(false);
  });

  it('N8: replace non-existent metric rejected', () => {
    const n8 = NEGATIVE_CASES.find((c) => c.id === 'N8')!;
    const result = validatePatchSemantics(n8.patch!.spec, n8.patch!.patch);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('PATCH_TARGET_NOT_FOUND');
  });
});
