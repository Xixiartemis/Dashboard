/**
 * Tests: Dataset invariants, registries, and basic data integrity.
 */

import { describe, it, expect } from 'vitest';
import { MOCK_A_DATA, MOCK_B_DATA, getLastTradingDate } from '../src/data/mock-dataset';
import { validateDataset, assertAllDatasetsValid } from '../src/data/invariants';
import { MANIFEST } from '../src/data/manifest';
import { getInstrument, isKnownSymbol, resolveInstrument, listInstruments } from '../src/registries/instruments';
import { getMetric, isKnownMetric, metricSupportsMark, listMetrics } from '../src/registries/metrics';

// ── Dataset Invariants ─────────────────────────────────────────────────────

describe('Dataset Invariants', () => {
  it('MOCK.A passes all invariants', () => {
    const violations = validateDataset(MOCK_A_DATA, 'MOCK.A');
    expect(violations).toEqual([]);
  });

  it('MOCK.B passes all invariants', () => {
    const violations = validateDataset(MOCK_B_DATA, 'MOCK.B');
    expect(violations).toEqual([]);
  });

  it('both datasets pass via assertAllDatasetsValid', () => {
    expect(() => assertAllDatasetsValid({
      'MOCK.A': MOCK_A_DATA,
      'MOCK.B': MOCK_B_DATA,
    })).not.toThrow();
  });

  it('each dataset has 80 trading days', () => {
    expect(MOCK_A_DATA.length).toBe(80);
    expect(MOCK_B_DATA.length).toBe(80);
  });

  it('manifest.asOf matches last trading day', () => {
    expect(getLastTradingDate()).toBe(MANIFEST.asOf);
  });

  it('manifest.asOf matches last record date', () => {
    expect(MOCK_A_DATA[MOCK_A_DATA.length - 1].date).toBe(MANIFEST.asOf);
    expect(MOCK_B_DATA[MOCK_B_DATA.length - 1].date).toBe(MANIFEST.asOf);
  });

  it('coverage supports max query (60) + lookback (1)', () => {
    expect(MOCK_A_DATA.length).toBeGreaterThanOrEqual(61);
    expect(MOCK_B_DATA.length).toBeGreaterThanOrEqual(61);
  });

  it('all prices are positive and finite', () => {
    for (const r of MOCK_A_DATA) {
      expect(Number.isFinite(r.open)).toBe(true);
      expect(Number.isFinite(r.high)).toBe(true);
      expect(Number.isFinite(r.low)).toBe(true);
      expect(Number.isFinite(r.close)).toBe(true);
      expect(Number.isFinite(r.volume)).toBe(true);
      expect(r.open).toBeGreaterThan(0);
      expect(r.high).toBeGreaterThan(0);
      expect(r.low).toBeGreaterThan(0);
      expect(r.close).toBeGreaterThan(0);
      expect(r.volume).toBeGreaterThanOrEqual(0);
    }
  });

  it('high >= max(open, close) and low <= min(open, close)', () => {
    for (const r of MOCK_A_DATA) {
      expect(r.high).toBeGreaterThanOrEqual(Math.max(r.open, r.close));
      expect(r.low).toBeLessThanOrEqual(Math.min(r.open, r.close));
      expect(r.high).toBeGreaterThanOrEqual(r.low);
    }
  });

  it('dates are unique and strictly ascending', () => {
    const dates = MOCK_A_DATA.map((r) => r.date);
    const unique = new Set(dates);
    expect(unique.size).toBe(dates.length);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it('corrupted dataset is detected', () => {
    const bad = [{ date: '2025-01-01', open: 0, high: 10, low: 5, close: 8, volume: 100 }];
    const violations = validateDataset(bad, 'BAD');
    expect(violations.length).toBeGreaterThan(0);
  });
});

// ── Instrument Registry ────────────────────────────────────────────────────

describe('Instrument Registry', () => {
  it('finds MOCK.A', () => {
    const inst = getInstrument('MOCK.A');
    expect(inst).toBeDefined();
    expect(inst!.displayName).toBe('A公司');
    expect(inst!.assetType).toBe('equity');
  });

  it('finds MOCK.B', () => {
    const inst = getInstrument('MOCK.B');
    expect(inst).toBeDefined();
    expect(inst!.displayName).toBe('B公司');
  });

  it('returns undefined for unknown symbol', () => {
    expect(getInstrument('UNKNOWN')).toBeUndefined();
  });

  it('isKnownSymbol works', () => {
    expect(isKnownSymbol('MOCK.A')).toBe(true);
    expect(isKnownSymbol('MOCK.B')).toBe(true);
    expect(isKnownSymbol('UNKNOWN')).toBe(false);
  });

  it('resolveInstrument works with aliases', () => {
    expect(resolveInstrument('A公司')).toBeDefined();
    expect(resolveInstrument('A 公司')).toBeDefined();
    expect(resolveInstrument('B公司')).toBeDefined();
    expect(resolveInstrument('不存在')).toBeUndefined();
  });

  it('listInstruments returns all entries', () => {
    expect(listInstruments().length).toBe(2);
  });
});

// ── Metric Registry ────────────────────────────────────────────────────────

describe('Metric Registry', () => {
  it('all 6 metrics are registered', () => {
    expect(listMetrics().length).toBe(6);
  });

  it('raw metrics: open, high, low, close, volume', () => {
    for (const id of ['open', 'high', 'low', 'close', 'volume']) {
      const m = getMetric(id);
      expect(m).toBeDefined();
      expect(m!.kind).toBe('raw');
    }
  });

  it('derived metrics: change_pct', () => {
    const m = getMetric('change_pct');
    expect(m).toBeDefined();
    expect(m!.kind).toBe('derived');
    expect(m!.unit).toBe('%');
  });

  it('units are correct', () => {
    for (const id of ['open', 'high', 'low', 'close']) {
      expect(getMetric(id)!.unit).toBe('CNY');
    }
    expect(getMetric('volume')!.unit).toBe('share');
    expect(getMetric('change_pct')!.unit).toBe('%');
  });

  it('all metrics support line and bar', () => {
    for (const m of listMetrics()) {
      expect(m.supportedMarks).toContain('line');
      expect(m.supportedMarks).toContain('bar');
    }
  });

  it('metricSupportsMark works', () => {
    expect(metricSupportsMark('close', 'line')).toBe(true);
    expect(metricSupportsMark('close', 'bar')).toBe(true);
    expect(metricSupportsMark('nonexistent', 'line')).toBe(false);
  });

  it('isKnownMetric works', () => {
    expect(isKnownMetric('close')).toBe(true);
    expect(isKnownMetric('pe_ratio')).toBe(false);
  });
});
