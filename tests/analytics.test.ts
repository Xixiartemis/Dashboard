/**
 * Tests: Analytics engine — change_pct computation, time range, transforms.
 */

import { describe, it, expect } from 'vitest';
import { computeChangePct, applyTimeRange, applyRankTransform, runAnalytics } from '../src/analytics/engine';
import { MOCK_A_DATA } from '../src/data/mock-dataset';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';

describe('Analytics Engine', () => {
  describe('computeChangePct', () => {
    it('first day has change_pct = 0', () => {
      expect(computeChangePct(MOCK_A_DATA)[0].change_pct).toBe(0);
    });

    it('subsequent days have correct change_pct', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      for (let i = 1; i < enriched.length; i++) {
        const expected = Math.round(((MOCK_A_DATA[i].close - MOCK_A_DATA[i - 1].close) / MOCK_A_DATA[i - 1].close) * 100 * 100) / 100;
        expect(enriched[i].change_pct).toBe(expected);
      }
    });

    it('all change_pct values are finite', () => {
      for (const r of computeChangePct(MOCK_A_DATA)) {
        expect(Number.isFinite(r.change_pct)).toBe(true);
      }
    });
  });

  describe('Time range and change_pct interaction', () => {
    it('change_pct on first day of 30-day window uses previous day close (regression)', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      const last30 = applyTimeRange(enriched, 30);
      // First day of 30-day window should NOT be 0 (unless by coincidence)
      expect(last30[0].change_pct).toBe(enriched[50].change_pct);
      expect(last30[0].change_pct).not.toBe(0);
    });
  });

  describe('Rank Transform', () => {
    it('bottom-3 by change_pct', () => {
      const enriched = applyTimeRange(computeChangePct(MOCK_A_DATA), 30);
      const result = applyRankTransform(enriched, { id: 'test', type: 'rank', field: 'change_pct', order: 'asc', limit: 3 });
      expect(result.records.length).toBe(3);
      for (let i = 1; i < result.records.length; i++) {
        expect(result.records[i].change_pct).toBeGreaterThanOrEqual(result.records[i - 1].change_pct);
      }
    });

    it('top-5 by volume', () => {
      const enriched = applyTimeRange(computeChangePct(MOCK_A_DATA), 30);
      const result = applyRankTransform(enriched, { id: 'test', type: 'rank', field: 'volume', order: 'desc', limit: 5 });
      expect(result.records.length).toBe(5);
    });
  });

  describe('runAnalytics', () => {
    it('G1: returns 30-day series with worst_3_days transform', () => {
      const result = runAnalytics(GOLDEN_CASES[0].expectedSpec);
      expect(result.isEmpty).toBe(false);
      expect(result.series.length).toBe(30);
      expect(result.transforms.get('worst_3_days')!.records.length).toBe(3);
    });

    it('G2: returns 20-day series with open and close', () => {
      const result = runAnalytics(GOLDEN_CASES[1].expectedSpec);
      expect(result.series.length).toBe(20);
    });

    it('G3: returns 15-day series with best_3_days', () => {
      const result = runAnalytics(GOLDEN_CASES[2].expectedSpec);
      expect(result.series.length).toBe(15);
      expect(result.transforms.get('best_3_days')!.records.length).toBe(3);
    });

    it('G4: returns 30-day series with top_5_volume', () => {
      const result = runAnalytics(GOLDEN_CASES[3].expectedSpec);
      expect(result.series.length).toBe(30);
      expect(result.transforms.get('top_5_volume')!.records.length).toBe(5);
    });

    it('G5: returns 20-day series with high, low', () => {
      const result = runAnalytics(GOLDEN_CASES[4].expectedSpec);
      expect(result.series.length).toBe(20);
    });
  });
});
