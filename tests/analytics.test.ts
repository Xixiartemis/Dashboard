/**
 * Tests: Analytics engine — change_pct computation, time range, transforms.
 *
 * Critical: change_pct must be computed on FULL series before time range filter.
 */

import { describe, it, expect } from 'vitest';
import { computeChangePct, applyTimeRange, applyRankTransform, runAnalytics } from '../src/analytics/engine';
import { MOCK_A_DATA } from '../src/data/mock-dataset';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';

describe('Analytics Engine', () => {
  describe('computeChangePct', () => {
    it('first day has change_pct = 0', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      expect(enriched[0].change_pct).toBe(0);
    });

    it('subsequent days have correct change_pct', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      for (let i = 1; i < enriched.length; i++) {
        const prev = MOCK_A_DATA[i - 1].close;
        const curr = MOCK_A_DATA[i].close;
        const expected = Math.round(((curr - prev) / prev) * 100 * 100) / 100;
        expect(enriched[i].change_pct).toBe(expected);
      }
    });

    it('all change_pct values are finite', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      for (const r of enriched) {
        expect(Number.isFinite(r.change_pct)).toBe(true);
      }
    });

    it('length matches input', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      expect(enriched.length).toBe(MOCK_A_DATA.length);
    });
  });

  describe('Time range and change_pct interaction', () => {
    it('change_pct on first day of 30-day window uses previous day close (regression)', () => {
      // This is the critical regression test:
      // If we compute change_pct AFTER slicing to 30 days,
      // the first day would have change_pct=0 (missing lookback).
      // We must compute on full 80-day series first.
      const enriched = computeChangePct(MOCK_A_DATA);
      const last30 = applyTimeRange(enriched, 30);

      // The first day of the 30-day window should NOT be 0 (unless by coincidence)
      // It should reflect the real change from the day before
      const fullSeriesDay71 = enriched[50]; // index 50 = day 71 in 80-day series
      expect(last30[0].date).toBe(fullSeriesDay71.date);
      expect(last30[0].change_pct).toBe(fullSeriesDay71.change_pct);

      // Verify this is NOT 0 by default (the lookback exists)
      // Only true if the price actually changed
      expect(last30[0].change_pct).not.toBe(0);
    });

    it('30-day window returns exactly 30 records', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      const result = applyTimeRange(enriched, 30);
      expect(result.length).toBe(30);
    });
  });

  describe('Rank Transform', () => {
    it('bottom-3 by change_pct', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      const last30 = applyTimeRange(enriched, 30);
      const result = applyRankTransform(last30, {
        id: 'test', type: 'rank', field: 'change_pct', order: 'asc', limit: 3,
      });
      expect(result.records.length).toBe(3);
      // Verify sorted ascending
      for (let i = 1; i < result.records.length; i++) {
        expect(result.records[i].change_pct).toBeGreaterThanOrEqual(result.records[i - 1].change_pct);
      }
    });

    it('top-3 by change_pct', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      const last30 = applyTimeRange(enriched, 30);
      const result = applyRankTransform(last30, {
        id: 'test', type: 'rank', field: 'change_pct', order: 'desc', limit: 3,
      });
      expect(result.records.length).toBe(3);
      for (let i = 1; i < result.records.length; i++) {
        expect(result.records[i].change_pct).toBeLessThanOrEqual(result.records[i - 1].change_pct);
      }
    });

    it('top-5 by volume', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      const last30 = applyTimeRange(enriched, 30);
      const result = applyRankTransform(last30, {
        id: 'test', type: 'rank', field: 'volume', order: 'desc', limit: 5,
      });
      expect(result.records.length).toBe(5);
      for (let i = 1; i < result.records.length; i++) {
        expect(result.records[i].volume).toBeLessThanOrEqual(result.records[i - 1].volume);
      }
    });

    it('limit > data length returns all records', () => {
      const enriched = computeChangePct(MOCK_A_DATA);
      const last5 = applyTimeRange(enriched, 5);
      const result = applyRankTransform(last5, {
        id: 'test', type: 'rank', field: 'close', order: 'desc', limit: 10,
      });
      expect(result.records.length).toBe(5);
    });
  });

  describe('runAnalytics', () => {
    it('G1: returns 30-day series with worst_3_days transform', () => {
      const result = runAnalytics(GOLDEN_CASES[0].expectedSpec);
      expect(result.isEmpty).toBe(false);
      expect(result.series.length).toBe(30);
      const worst = result.transforms.get('worst_3_days');
      expect(worst).toBeDefined();
      expect(worst!.records.length).toBe(3);
    });

    it('G2: returns 20-day series with open and close', () => {
      const result = runAnalytics(GOLDEN_CASES[1].expectedSpec);
      expect(result.series.length).toBe(20);
      for (const r of result.series) {
        expect(Number.isFinite(r.open)).toBe(true);
        expect(Number.isFinite(r.close)).toBe(true);
      }
    });

    it('G3: returns 15-day series with best_3_days', () => {
      const result = runAnalytics(GOLDEN_CASES[2].expectedSpec);
      expect(result.series.length).toBe(15);
      const best = result.transforms.get('best_3_days');
      expect(best).toBeDefined();
      expect(best!.records.length).toBe(3);
    });

    it('G4: returns 30-day series with top_5_volume', () => {
      const result = runAnalytics(GOLDEN_CASES[3].expectedSpec);
      expect(result.series.length).toBe(30);
      const top5 = result.transforms.get('top_5_volume');
      expect(top5).toBeDefined();
      expect(top5!.records.length).toBe(5);
    });

    it('G5: returns 20-day series with high, low, close', () => {
      const result = runAnalytics(GOLDEN_CASES[4].expectedSpec);
      expect(result.series.length).toBe(20);
      for (const r of result.series) {
        expect(Number.isFinite(r.high)).toBe(true);
        expect(Number.isFinite(r.low)).toBe(true);
      }
    });
  });
});
