/**
 * Tests: Dataset invariants, registries, and basic data integrity.
 */

import { describe, it, expect } from 'vitest';
import { MOCK_A_DATA, MOCK_B_DATA, getLastTradingDate } from '../src/data/mock-dataset';
import { validateDataset, assertAllDatasetsValid } from '../src/data/invariants';
import { MANIFEST } from '../src/data/manifest';
import { getInstrument, resolveInstrument } from '../src/registries/instruments';
import { getMetric, listMetrics } from '../src/registries/metrics';

describe('Dataset Invariants', () => {
  it('MOCK.A passes all invariants', () => {
    expect(validateDataset(MOCK_A_DATA, 'MOCK.A')).toEqual([]);
  });

  it('MOCK.B passes all invariants', () => {
    expect(validateDataset(MOCK_B_DATA, 'MOCK.B')).toEqual([]);
  });

  it('both datasets pass via assertAllDatasetsValid', () => {
    expect(() => assertAllDatasetsValid({ 'MOCK.A': MOCK_A_DATA, 'MOCK.B': MOCK_B_DATA })).not.toThrow();
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
  });

  it('all prices are positive and finite', () => {
    for (const r of MOCK_A_DATA) {
      expect(Number.isFinite(r.open) && r.open > 0).toBe(true);
      expect(Number.isFinite(r.high) && r.high > 0).toBe(true);
      expect(Number.isFinite(r.low) && r.low > 0).toBe(true);
      expect(Number.isFinite(r.close) && r.close > 0).toBe(true);
      expect(Number.isFinite(r.volume) && r.volume >= 0).toBe(true);
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
    expect(new Set(dates).size).toBe(dates.length);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it('calendar is MOCK_WEEKDAY, not SSE', () => {
    expect(MANIFEST.calendar).toBe('MOCK_WEEKDAY');
  });
});

describe('Instrument Registry', () => {
  it('finds MOCK.A with correct metadata', () => {
    const inst = getInstrument('MOCK.A');
    expect(inst).toBeDefined();
    expect(inst!.displayName).toBe('A公司');
    expect(inst!.assetType).toBe('equity');
  });

  it('finds MOCK.B', () => {
    expect(getInstrument('MOCK.B')).toBeDefined();
    expect(getInstrument('MOCK.B')!.displayName).toBe('B公司');
  });

  it('returns undefined for unknown symbol', () => {
    expect(getInstrument('UNKNOWN')).toBeUndefined();
  });

  it('resolveInstrument works with aliases', () => {
    expect(resolveInstrument('A公司')).toBeDefined();
    expect(resolveInstrument('A 公司')).toBeDefined();
    expect(resolveInstrument('不存在')).toBeUndefined();
  });
});

describe('Metric Registry', () => {
  it('all 6 metrics are registered', () => {
    expect(listMetrics().length).toBe(6);
  });

  it('units are correct', () => {
    for (const id of ['open', 'high', 'low', 'close']) expect(getMetric(id)!.unit).toBe('CNY');
    expect(getMetric('volume')!.unit).toBe('share');
    expect(getMetric('change_pct')!.unit).toBe('%');
  });

  it('all metrics support line and bar', () => {
    for (const m of listMetrics()) {
      expect(m.supportedMarks).toContain('line');
      expect(m.supportedMarks).toContain('bar');
    }
  });
});
