/**
 * Tests: Golden Cases — end-to-end validation + patch application + re-validation.
 */

import { describe, it, expect } from 'vitest';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { applyPatch } from '../src/patch/apply-patch';
import { runAnalytics } from '../src/analytics/engine';
import { compileViewToEChartsOption, validateEChartsOption } from '../src/renderer/echarts-probe';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import { NEGATIVE_CASES } from '../src/fixtures/negative-cases';
import { METAMORPHIC_PAIRS, METAMORPHIC_STATUS } from '../src/fixtures/metamorphic';

// ── Golden Cases: Validation ───────────────────────────────────────────────

describe('Golden Cases - Structural + Semantic', () => {
  for (const gc of GOLDEN_CASES) {
    it(`${gc.id}: ${gc.name} — structural validation passes`, () => {
      const result = validateStructure(gc.expectedSpec);
      expect(result.ok).toBe(true);
    });

    it(`${gc.id}: ${gc.name} — semantic validation passes`, () => {
      const result = validateSemantics(gc.expectedSpec);
      expect(result.ok).toBe(true);
    });
  }
});

// ── Golden Cases: Patch + Re-validation ────────────────────────────────────

describe('Golden Cases - Follow-up Patches', () => {
  it('G1 follow-up: replace volume → change_pct', () => {
    const gc = GOLDEN_CASES[0];
    const result = applyPatch(gc.expectedSpec, gc.patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // volume should be removed; change_pct was already present (for transforms)
      expect(result.spec.metrics.some((m) => m.id === 'change_pct')).toBe(true);
      expect(result.spec.metrics.some((m) => m.id === 'volume')).toBe(false);
      // metrics should have no duplicates
      const ids = result.spec.metrics.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      // volume_view series should now reference change_pct
      const volumeView = result.spec.views.find((v) => v.id === 'volume_view');
      expect(volumeView).toBeDefined();
      expect(volumeView!.series[0].field).toBe('change_pct');
    }
  });

  it('G2 follow-up: set time range to 10', () => {
    const gc = GOLDEN_CASES[1];
    const result = applyPatch(gc.expectedSpec, gc.patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.timeRange.count).toBe(10);
      // Other parts should remain unchanged
      expect(result.spec.instrument.symbol).toBe('MOCK.B');
      expect(result.spec.views[0].series.length).toBe(2);
    }
  });

  it('G3 follow-up: set mark to line', () => {
    const gc = GOLDEN_CASES[2];
    const result = applyPatch(gc.expectedSpec, gc.patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const view = result.spec.views.find((v) => v.id === 'change_bar');
      expect(view).toBeDefined();
      expect(view!.series[0].mark).toBe('line');
    }
  });

  it('G4 follow-up: set time range to 20', () => {
    const gc = GOLDEN_CASES[3];
    const result = applyPatch(gc.expectedSpec, gc.patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.timeRange.count).toBe(20);
    }
  });

  it('G5 follow-up: add close to hl_view', () => {
    const gc = GOLDEN_CASES[4];
    const result = applyPatch(gc.expectedSpec, gc.patch!);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const view = result.spec.views.find((v) => v.id === 'hl_view');
      expect(view).toBeDefined();
      expect(view!.series.length).toBe(3); // high, low, close
      expect(view!.series[2].field).toBe('close');
      // metrics should now include close
      expect(result.spec.metrics.some((m) => m.id === 'close')).toBe(true);
    }
  });
});

// ── Golden Cases: Analytics + Renderer Probe ───────────────────────────────

describe('Golden Cases - Analytics + Renderer Probe', () => {
  for (const gc of GOLDEN_CASES) {
    it(`${gc.id}: analytics produces data, renderer compiles option`, () => {
      const analytics = runAnalytics(gc.expectedSpec);
      expect(analytics.isEmpty).toBe(false);

      for (const view of gc.expectedSpec.views) {
        const compileResult = compileViewToEChartsOption(view, analytics.series, analytics.transforms);
        expect(compileResult.ok).toBe(true);
        if (compileResult.ok) {
          expect(validateEChartsOption(compileResult.option)).toBe(true);
        }
      }
    });
  }
});

// ── Negative Cases: End-to-end ─────────────────────────────────────────────

describe('Negative Cases - All rejected', () => {
  for (const nc of NEGATIVE_CASES) {
    it(`${nc.id}: ${nc.name} — error code ${nc.errorCode}`, () => {
      if (nc.rawInput) {
        // Structural validation should fail
        const result = validateStructure(nc.rawInput);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.some((e) => e.code === nc.errorCode)).toBe(true);
        }
      } else if (nc.patch) {
        // Patch application should fail
        const result = applyPatch(nc.patch.spec, nc.patch.patch);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.some((e) => e.code === nc.errorCode)).toBe(true);
        }
      } else if (nc.spec) {
        // Semantic validation should fail
        const result = validateSemantics(nc.spec);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.errors.some((e) => e.code === nc.errorCode)).toBe(true);
        }
      }
    });
  }
});

// ── Metamorphic Fixtures ───────────────────────────────────────────────────

describe('Metamorphic Fixtures', () => {
  it('METAMORPHIC_FIXTURES=READY', () => {
    expect(METAMORPHIC_STATUS).toBe('METAMORPHIC_FIXTURES=READY');
  });

  it('all pairs have at least 2 variants', () => {
    for (const pair of METAMORPHIC_PAIRS) {
      expect(pair.variants.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('all pairs have expected normalized structure', () => {
    for (const pair of METAMORPHIC_PAIRS) {
      expect(pair.expectedNormalized.instrument).toBeDefined();
      expect(pair.expectedNormalized.metrics.length).toBeGreaterThan(0);
      expect(pair.expectedNormalized.timeRangeCount).toBeGreaterThan(0);
    }
  });
});
