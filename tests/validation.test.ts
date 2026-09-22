/**
 * Tests: Schema structural + semantic validation.
 */

import { describe, it, expect } from 'vitest';
import { parseDashboardSpec } from '../src/schema/dashboard-spec';
import { parseDashboardPatch } from '../src/schema/dashboard-patch';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics, validatePatchSemantics } from '../src/validation/semantic';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { NEGATIVE_CASES } from '../src/fixtures/negative-cases';


// ── Structural Validation ──────────────────────────────────────────────────

describe('Structural Validation', () => {
  it('rejects null input', () => {
    const result = validateStructure(null);
    expect(result.ok).toBe(false);
  });

  it('rejects empty object', () => {
    const result = validateStructure({});
    expect(result.ok).toBe(false);
  });

  it('rejects unknown properties', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: 'x', asOf: '2025-12-31', timezone: 'Asia/Shanghai', priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { summary: 't', facts: [] },
      unknownField: 'should fail',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'UNKNOWN_PROPERTY')).toBe(true);
    }
  });

  it('rejects invalid mark enum', () => {
    const result = validateStructure({
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: '2025-12-31' },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: 'x', asOf: '2025-12-31', timezone: 'Asia/Shanghai', priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'pie', unit: 'CNY' }], annotations: [] }],
      insight: { summary: 't', facts: [] },
    });
    expect(result.ok).toBe(false);
  });

  it('all golden cases pass structural validation', () => {
    for (const gc of GOLDEN_CASES) {
      const result = validateStructure(gc.expectedSpec);
      expect(result.ok).toBe(true);
    }
  });

  it('parses valid Zod schema', () => {
    const result = parseDashboardSpec(GOLDEN_CASES[0].expectedSpec);
    expect(result.success).toBe(true);
  });
});

// ── Semantic Validation ────────────────────────────────────────────────────

describe('Semantic Validation', () => {
  it('all golden cases pass semantic validation', () => {
    for (const gc of GOLDEN_CASES) {
      const semResult = validateSemantics(gc.expectedSpec);
      expect(semResult.ok).toBe(true);
    }
  });

  it('rejects unknown instrument (N1)', () => {
    const n1 = NEGATIVE_CASES.find((c) => c.id === 'N1')!;
    const result = validateSemantics(n1.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe('UNKNOWN_INSTRUMENT');
    }
  });

  it('rejects unsupported metric (N2)', () => {
    const n2 = NEGATIVE_CASES.find((c) => c.id === 'N2')!;
    const result = validateSemantics(n2.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe('UNSUPPORTED_METRIC');
    }
  });

  it('rejects non-existent series field (N5)', () => {
    const n5 = NEGATIVE_CASES.find((c) => c.id === 'N5')!;
    const result = validateSemantics(n5.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe('MISSING_SERIES_FIELD');
    }
  });

  it('rejects non-existent transform reference (N6)', () => {
    const n6 = NEGATIVE_CASES.find((c) => c.id === 'N6')!;
    const result = validateSemantics(n6.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe('MISSING_TRANSFORM_REF');
    }
  });

  it('rejects time range exceeding data (N7)', () => {
    const n7 = NEGATIVE_CASES.find((c) => c.id === 'N7')!;
    const result = validateSemantics(n7.spec!);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe('TIME_RANGE_EXCEEDS_DATA');
    }
  });
});

// ── Negative Cases (structural) ────────────────────────────────────────────

describe('Negative Cases - Structural', () => {
  it('N3: zero count rejected by Zod', () => {
    const n3 = NEGATIVE_CASES.find((c) => c.id === 'N3')!;
    const result = validateStructure(n3.rawInput);
    expect(result.ok).toBe(false);
  });

  it('N4: unsupported mark rejected by Zod', () => {
    const n4 = NEGATIVE_CASES.find((c) => c.id === 'N4')!;
    const result = validateStructure(n4.rawInput);
    expect(result.ok).toBe(false);
  });
});

// ── Patch Structural Validation ────────────────────────────────────────────

describe('Patch Structural Validation', () => {
  it('valid replace_metric patch parses', () => {
    const result = parseDashboardPatch({ op: 'replace_metric', from: 'volume', to: 'change_pct' });
    expect(result.success).toBe(true);
  });

  it('valid add_metric patch parses', () => {
    const result = parseDashboardPatch({ op: 'add_metric', metric: 'close', viewId: 'v1' });
    expect(result.success).toBe(true);
  });

  it('valid set_time_range patch parses', () => {
    const result = parseDashboardPatch({ op: 'set_time_range', count: 10 });
    expect(result.success).toBe(true);
  });

  it('valid set_mark patch parses', () => {
    const result = parseDashboardPatch({ op: 'set_mark', viewId: 'v1', seriesId: 's1', mark: 'line' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid op', () => {
    const result = parseDashboardPatch({ op: 'delete_everything' });
    expect(result.success).toBe(false);
  });
});

// ── Patch Semantic Validation ──────────────────────────────────────────────

describe('Patch Semantic Validation', () => {
  it('N8: replace non-existent metric rejected', () => {
    const n8 = NEGATIVE_CASES.find((c) => c.id === 'N8')!;
    const result = validatePatchSemantics(n8.patch!.spec, n8.patch!.patch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe('PATCH_TARGET_NOT_FOUND');
    }
  });

  it('N9: add_metric to non-existent view rejected', () => {
    const n9 = NEGATIVE_CASES.find((c) => c.id === 'N9')!;
    const result = validatePatchSemantics(n9.patch!.spec, n9.patch!.patch);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe('PATCH_TARGET_NOT_FOUND');
    }
  });
});
