/**
 * Tests: Golden Cases + Follow-up Patches + Negative Cases + Insight/Transform consistency.
 */

import { describe, it, expect } from 'vitest';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { applyPatch } from '../src/patch/apply-patch';
import { runAnalytics, computeInsight } from '../src/analytics/engine';
import { compileViewToEChartsOption, validateEChartsOption } from '../src/renderer/echarts-probe';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { NEGATIVE_CASES } from '../src/fixtures/negative-cases';
import { METAMORPHIC_PAIRS, METAMORPHIC_STATUS } from '../src/fixtures/metamorphic';

describe('Golden Cases - Structural + Semantic', () => {
  for (const gc of GOLDEN_CASES) {
    it(`${gc.id}: structural validation passes`, () => {
      expect(validateStructure(gc.expectedSpec).ok).toBe(true);
    });
    it(`${gc.id}: semantic validation passes`, () => {
      expect(validateSemantics(gc.expectedSpec).ok).toBe(true);
    });
  }
});

describe('Golden Cases - Follow-up Patches', () => {
  it('G1 follow-up: replace volume → change_pct', () => {
    const result = applyPatch(GOLDEN_CASES[0].expectedSpec, GOLDEN_CASES[0].patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.metrics.some((m) => m.id === 'change_pct')).toBe(true);
      expect(result.spec.metrics.some((m) => m.id === 'volume')).toBe(false);
      const ids = result.spec.metrics.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length); // no duplicates
    }
  });

  it('G2 follow-up: set time range to 10', () => {
    const result = applyPatch(GOLDEN_CASES[1].expectedSpec, GOLDEN_CASES[1].patch!);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.timeRange.count).toBe(10);
  });

  it('G3 follow-up: set mark to line', () => {
    const result = applyPatch(GOLDEN_CASES[2].expectedSpec, GOLDEN_CASES[2].patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.views.find((v) => v.id === 'change_bar')!.series[0].mark).toBe('line');
    }
  });

  it('G4 follow-up: set time range to 20', () => {
    const result = applyPatch(GOLDEN_CASES[3].expectedSpec, GOLDEN_CASES[3].patch!);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.timeRange.count).toBe(20);
  });

  it('G5 follow-up: add close to hl_view', () => {
    const result = applyPatch(GOLDEN_CASES[4].expectedSpec, GOLDEN_CASES[4].patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const view = result.spec.views.find((v) => v.id === 'hl_view')!;
      expect(view.series.length).toBe(3);
      expect(view.series[2].field).toBe('close');
      expect(result.spec.metrics.some((m) => m.id === 'close')).toBe(true);
    }
  });
});

describe('Golden Cases - Analytics + Renderer Probe', () => {
  for (const gc of GOLDEN_CASES) {
    it(`${gc.id}: analytics + renderer compile`, () => {
      const analytics = runAnalytics(gc.expectedSpec);
      expect(analytics.isEmpty).toBe(false);
      for (const view of gc.expectedSpec.views) {
        const result = compileViewToEChartsOption(view, analytics.series, analytics.transforms);
        expect(result.ok).toBe(true);
        if (result.ok) expect(validateEChartsOption(result.option)).toBe(true);
      }
    });
  }
});

describe('Insight/Transform Consistency (Issue #7)', () => {
  it('G1: ranking insight consumes same transform result as annotation', () => {
    const spec = GOLDEN_CASES[0].expectedSpec;
    const analytics = runAnalytics(spec);
    const insight = computeInsight(spec, analytics);

    // rank_summary should reference transformRef='worst_3_days'
    const rankResult = insight.rank_results?.get('worst_3_days');
    expect(rankResult).toBeDefined();
    expect(rankResult!.records.length).toBe(3);

    // Same records as the transform used by annotation
    const transformResult = analytics.transforms.get('worst_3_days')!;
    expect(rankResult!.records.length).toBe(transformResult.records.length);
    for (let i = 0; i < rankResult!.records.length; i++) {
      expect(rankResult!.records[i].date).toBe(transformResult.records[i].date);
    }
  });

  it('G3: best_3_days insight matches transform limit', () => {
    const spec = GOLDEN_CASES[2].expectedSpec;
    const analytics = runAnalytics(spec);
    const insight = computeInsight(spec, analytics);

    const rankResult = insight.rank_results?.get('best_3_days');
    expect(rankResult).toBeDefined();
    expect(rankResult!.records.length).toBe(3);

    const transformResult = analytics.transforms.get('best_3_days')!;
    expect(rankResult!.records.length).toBe(transformResult.records.length);
  });

  it('G4: top_5_volume insight matches transform limit', () => {
    const spec = GOLDEN_CASES[3].expectedSpec;
    const analytics = runAnalytics(spec);
    const insight = computeInsight(spec, analytics);

    const rankResult = insight.rank_results?.get('top_5_volume');
    expect(rankResult).toBeDefined();
    expect(rankResult!.records.length).toBe(5);
  });
});

describe('Negative Cases', () => {
  for (const nc of NEGATIVE_CASES) {
    it(`${nc.id}: ${nc.name} — ${nc.errorCode}`, () => {
      if (nc.rawInput) {
        const result = validateStructure(nc.rawInput);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.some((e) => e.code === nc.errorCode)).toBe(true);
      } else if (nc.patch) {
        const result = applyPatch(nc.patch.spec, nc.patch.patch);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.some((e) => e.code === nc.errorCode)).toBe(true);
      } else if (nc.spec) {
        const result = validateSemantics(nc.spec);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.errors.some((e) => e.code === nc.errorCode)).toBe(true);
      }
    });
  }
});

describe('Metamorphic Fixtures', () => {
  it('METAMORPHIC_FIXTURES=READY', () => {
    expect(METAMORPHIC_STATUS).toBe('METAMORPHIC_FIXTURES=READY');
  });

  it('all pairs have at least 2 variants', () => {
    for (const pair of METAMORPHIC_PAIRS) {
      expect(pair.variants.length).toBeGreaterThanOrEqual(2);
    }
  });
});
