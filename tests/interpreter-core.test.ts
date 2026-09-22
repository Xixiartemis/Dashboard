/**
 * Interpreter Core Tests — IC1-IC8.
 *
 * Prove: given correctly resolved intents, the deterministic compiler
 * produces DashboardSpec/DashboardPatch that matches Golden Cases semantically
 * and passes all Frozen Validators.
 */

import { describe, it, expect } from 'vitest';
import { compileInitialIntent } from '../src/interpreter/compiler/spec-compiler';
import { compileFollowUpIntent } from '../src/interpreter/compiler/patch-compiler';
import { compareSpecSemantics } from '../src/interpreter/comparison';
import { resolveInstrumentId } from '../src/interpreter/resolver/instrument-resolver';
import { resolveMetricId, resolveMetricIds } from '../src/interpreter/resolver/metric-resolver';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { applyPatch } from '../src/patch/apply-patch';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import type { ResolvedInitialIntent, ResolvedFollowUpIntent } from '../src/interpreter/intent';
import type { DashboardSpec } from '../src/schema/dashboard-spec';

// ── Resolved Initial Intents (manually constructed for G1-G5) ─────────────

const G1_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.A',
  metrics: ['close', 'volume', 'change_pct'],
  displayMetrics: ['close', 'volume'],  // change_pct is analysis-only (used by ranking)
  timeRange: { count: 30 },
  rankings: [{
    metric: 'change_pct',
    order: 'asc',
    limit: 3,
    annotationLabel: '跌幅最大',
  }],
};

const G2_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.B',
  metrics: ['open', 'close'],
  timeRange: { count: 20 },
};

const G3_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.A',
  metrics: ['change_pct'],
  timeRange: { count: 15 },
  preferredMark: 'bar',
  rankings: [{
    metric: 'change_pct',
    order: 'desc',
    limit: 3,
    annotationLabel: '涨幅最大',
  }],
};

const G4_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.B',
  metrics: ['volume'],
  timeRange: { count: 30 },
  rankings: [{
    metric: 'volume',
    order: 'desc',
    limit: 5,
    annotationLabel: '成交量最高',
  }],
};

const G5_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.A',
  metrics: ['high', 'low'],
  timeRange: { count: 20 },
};

const GOLDEN_INTENTS = [G1_INTENT, G2_INTENT, G3_INTENT, G4_INTENT, G5_INTENT];

// ── Resolved Follow-up Intents ────────────────────────────────────────────

const FOLLOWUP_INTENTS: ResolvedFollowUpIntent[] = [
  { op: 'replace_metric', from: 'volume', to: 'change_pct' },  // G1
  { op: 'set_time_range', count: 10 },                          // G2
  { op: 'set_mark', viewId: 'change_pct_view', seriesId: 'change_pct_series', mark: 'line' }, // G3
  { op: 'set_time_range', count: 20 },                          // G4
  { op: 'add_metric', metric: 'close', viewId: 'high_low_view' }, // G5
];

// ── IC1: Initial Intent → Golden ──────────────────────────────────────────

describe('IC1: Initial Intent → Golden Spec', () => {
  for (let i = 0; i < 5; i++) {
    it(`IC1-${i + 1}: G${i + 1} intent compiles to semantic-equivalent spec`, () => {
      const result = compileInitialIntent(GOLDEN_INTENTS[i]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const comparison = compareSpecSemantics(result.spec, GOLDEN_CASES[i].expectedSpec);
        if (!comparison.equal) {
          console.log(`G${i + 1} differences:`, comparison.differences);
        }
        expect(comparison.equal).toBe(true);
      }
    });
  }
});

// ── IC2: Compiled Spec Structural Valid ───────────────────────────────────

describe('IC2: Compiled Spec Structural Validation', () => {
  for (let i = 0; i < 5; i++) {
    it(`IC2-${i + 1}: G${i + 1} compiled spec passes structural validation`, () => {
      const result = compileInitialIntent(GOLDEN_INTENTS[i]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const validation = validateStructure(result.spec);
        expect(validation.ok).toBe(true);
      }
    });
  }
});

// ── IC3: Compiled Spec Semantic Valid ─────────────────────────────────────

describe('IC3: Compiled Spec Semantic Validation', () => {
  for (let i = 0; i < 5; i++) {
    it(`IC3-${i + 1}: G${i + 1} compiled spec passes semantic validation`, () => {
      const result = compileInitialIntent(GOLDEN_INTENTS[i]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const structResult = validateStructure(result.spec);
        expect(structResult.ok).toBe(true);
        if (structResult.ok) {
          const semResult = validateSemantics(structResult.spec);
          expect(semResult.ok).toBe(true);
        }
      }
    });
  }
});

// ── IC4: Follow-up Intent → Patch ────────────────────────────────────────

describe('IC4: Follow-up Intent → DashboardPatch', () => {
  it('IC4-1: G1 replace_metric compiles to correct patch', () => {
    const spec = compileInitialIntent(G1_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const patch = compileFollowUpIntent({ op: 'replace_metric', from: 'volume', to: 'change_pct' }, spec.spec);
    expect(patch.ok).toBe(true);
    if (patch.ok) {
      expect(patch.patch.op).toBe('replace_metric');
      expect((patch.patch as any).from).toBe('volume');
      expect((patch.patch as any).to).toBe('change_pct');
    }
  });

  it('IC4-2: G2 set_time_range compiles to correct patch', () => {
    const spec = compileInitialIntent(G2_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const patch = compileFollowUpIntent({ op: 'set_time_range', count: 10 }, spec.spec);
    expect(patch.ok).toBe(true);
    if (patch.ok) {
      expect(patch.patch.op).toBe('set_time_range');
      expect((patch.patch as any).count).toBe(10);
    }
  });

  it('IC4-3: G3 set_mark compiles to correct patch', () => {
    const spec = compileInitialIntent(G3_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    // Use the view/series IDs from the compiled spec
    const view = spec.spec.views[0];
    const series = view.series[0];
    const patch = compileFollowUpIntent(
      { op: 'set_mark', viewId: view.id, seriesId: series.id, mark: 'line' },
      spec.spec,
    );
    expect(patch.ok).toBe(true);
    if (patch.ok) {
      expect(patch.patch.op).toBe('set_mark');
      expect((patch.patch as any).mark).toBe('line');
    }
  });

  it('IC4-4: G4 set_time_range compiles to correct patch', () => {
    const spec = compileInitialIntent(G4_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const patch = compileFollowUpIntent({ op: 'set_time_range', count: 20 }, spec.spec);
    expect(patch.ok).toBe(true);
    if (patch.ok) {
      expect((patch.patch as any).count).toBe(20);
    }
  });

  it('IC4-5: G5 add_metric compiles to correct patch', () => {
    const spec = compileInitialIntent(G5_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    // Find the view that has CNY metrics (high + low → CNY group)
    const cnyView = spec.spec.views.find((v) =>
      v.series.some((s) => s.unit === 'CNY'),
    );
    expect(cnyView).toBeDefined();
    const patch = compileFollowUpIntent(
      { op: 'add_metric', metric: 'close', viewId: cnyView!.id },
      spec.spec,
    );
    expect(patch.ok).toBe(true);
    if (patch.ok) {
      expect(patch.patch.op).toBe('add_metric');
      expect((patch.patch as any).metric).toBe('close');
    }
  });
});

// ── IC5: Patch Application ───────────────────────────────────────────────

describe('IC5: Compiled Patch Application', () => {
  it('IC5-1: G1 replace_metric applies successfully', () => {
    const spec = compileInitialIntent(G1_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const patch = compileFollowUpIntent({ op: 'replace_metric', from: 'volume', to: 'change_pct' }, spec.spec);
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(applyPatch(spec.spec, patch.patch).ok).toBe(true);
  });

  it('IC5-2: G2 set_time_range applies successfully', () => {
    const spec = compileInitialIntent(G2_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const patch = compileFollowUpIntent({ op: 'set_time_range', count: 10 }, spec.spec);
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(applyPatch(spec.spec, patch.patch).ok).toBe(true);
  });

  it('IC5-3: G3 set_mark applies successfully', () => {
    const spec = compileInitialIntent(G3_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const view = spec.spec.views[0];
    const patch = compileFollowUpIntent(
      { op: 'set_mark', viewId: view.id, seriesId: view.series[0].id, mark: 'line' },
      spec.spec,
    );
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(applyPatch(spec.spec, patch.patch).ok).toBe(true);
  });

  it('IC5-4: G4 set_time_range applies successfully', () => {
    const spec = compileInitialIntent(G4_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const patch = compileFollowUpIntent({ op: 'set_time_range', count: 20 }, spec.spec);
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(applyPatch(spec.spec, patch.patch).ok).toBe(true);
  });

  it('IC5-5: G5 add_metric applies successfully', () => {
    const spec = compileInitialIntent(G5_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const cnyView = spec.spec.views.find((v) => v.series.some((s) => s.unit === 'CNY'));
    const patch = compileFollowUpIntent(
      { op: 'add_metric', metric: 'close', viewId: cnyView!.id },
      spec.spec,
    );
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;
    expect(applyPatch(spec.spec, patch.patch).ok).toBe(true);
  });
});

// ── IC6: Registry Single Source ───────────────────────────────────────────

describe('IC6: Registry Single Source', () => {
  it('IC6: resolver uses Registry, does not duplicate metadata', () => {
    // resolveMetricId returns only canonical ID
    const result = resolveMetricId('收盘价');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metricId).toBe('close');
      // The resolver does NOT carry label/unit/kind — those come from Registry
    }
  });

  it('IC6b: instrument resolver uses Registry', () => {
    const result = resolveInstrumentId('A公司');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.symbol).toBe('MOCK.A');
      // No displayName/assetType in the resolution result
    }
  });

  it('IC6c: compiled spec metadata comes from Registry, not from intent', () => {
    const result = compileInitialIntent(G1_INTENT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Metric labels/units come from Registry
      const closeMetric = result.spec.metrics.find((m) => m.id === 'close');
      expect(closeMetric?.label).toBe('收盘价'); // from Registry
      expect(closeMetric?.unit).toBe('CNY');     // from Registry
      expect(closeMetric?.kind).toBe('raw');     // from Registry
    }
  });
});

// ── IC7: Unsupported Intent ──────────────────────────────────────────────

describe('IC7: Unsupported / Invalid Intent', () => {
  it('IC7: unknown instrument → compile failure', () => {
    const badIntent: ResolvedInitialIntent = {
      instrument: 'UNKNOWN.X',
      metrics: ['close'],
      timeRange: { count: 30 },
    };
    const result = compileInitialIntent(badIntent);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_INSTRUMENT');
    }
  });

  it('IC7b: unknown metric → compile failure', () => {
    const badIntent: ResolvedInitialIntent = {
      instrument: 'MOCK.A',
      metrics: ['pe_ratio'],
      timeRange: { count: 30 },
    };
    const result = compileInitialIntent(badIntent);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_METRIC');
    }
  });

  it('IC7c: empty metrics → compile failure', () => {
    const badIntent: ResolvedInitialIntent = {
      instrument: 'MOCK.A',
      metrics: [],
      timeRange: { count: 30 },
    };
    const result = compileInitialIntent(badIntent);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_METRICS');
    }
  });

  it('IC7d: out of range time → compile failure', () => {
    const badIntent: ResolvedInitialIntent = {
      instrument: 'MOCK.A',
      metrics: ['close'],
      timeRange: { count: 100 },
    };
    const result = compileInitialIntent(badIntent);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('OUT_OF_RANGE');
    }
  });

  it('IC7e: replace_metric with unknown target → patch compile failure', () => {
    const specResult = compileInitialIntent(G1_INTENT);
    expect(specResult.ok).toBe(true);
    if (!specResult.ok) return;

    const badPatch: ResolvedFollowUpIntent = { op: 'replace_metric', from: 'volume', to: 'pe_ratio' };
    const result = compileFollowUpIntent(badPatch, specResult.spec);
    expect(result.ok).toBe(false);
  });
});

// ── IC8: Deterministic Compiler ──────────────────────────────────────────

describe('IC8: Deterministic Compiler', () => {
  it('IC8: same intent compiles to identical spec every time', () => {
    const results: DashboardSpec[] = [];
    for (let i = 0; i < 10; i++) {
      const result = compileInitialIntent(G1_INTENT);
      expect(result.ok).toBe(true);
      if (result.ok) results.push(result.spec);
    }
    // All results must be deeply equal
    for (let i = 1; i < results.length; i++) {
      expect(JSON.stringify(results[i])).toBe(JSON.stringify(results[0]));
    }
  });

  it('IC8b: same follow-up intent compiles to identical patch every time', () => {
    const specResult = compileInitialIntent(G1_INTENT);
    expect(specResult.ok).toBe(true);
    if (!specResult.ok) return;

    const patches: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = compileFollowUpIntent(FOLLOWUP_INTENTS[0], specResult.spec);
      expect(result.ok).toBe(true);
      if (result.ok) patches.push(JSON.stringify(result.patch));
    }
    expect(new Set(patches).size).toBe(1);
  });
});

// ── Resolver Tests ────────────────────────────────────────────────────────

describe('Metric Resolver', () => {
  it('resolves Chinese labels to canonical IDs', () => {
    expect(resolveMetricId('收盘价').ok).toBe(true);
    expect((resolveMetricId('收盘价') as any).metricId).toBe('close');
    expect(resolveMetricId('成交量').ok).toBe(true);
    expect((resolveMetricId('成交量') as any).metricId).toBe('volume');
    expect(resolveMetricId('涨跌幅').ok).toBe(true);
    expect((resolveMetricId('涨跌幅') as any).metricId).toBe('change_pct');
  });

  it('resolves canonical IDs directly', () => {
    expect((resolveMetricId('close') as any).metricId).toBe('close');
    expect((resolveMetricId('volume') as any).metricId).toBe('volume');
  });

  it('rejects unknown metrics', () => {
    expect(resolveMetricId('市盈率').ok).toBe(false);
    expect(resolveMetricId('pe_ratio').ok).toBe(false);
  });

  it('batch resolve returns all or first failure', () => {
    const good = resolveMetricIds(['收盘价', '成交量']);
    expect(good.ok).toBe(true);

    const bad = resolveMetricIds(['收盘价', '市盈率']);
    expect(bad.ok).toBe(false);
  });
});

describe('Instrument Resolver', () => {
  it('resolves aliases to canonical symbols', () => {
    expect((resolveInstrumentId('A公司') as any).symbol).toBe('MOCK.A');
    expect((resolveInstrumentId('A 公司') as any).symbol).toBe('MOCK.A');
    expect((resolveInstrumentId('MOCK.B') as any).symbol).toBe('MOCK.B');
  });

  it('rejects unknown instruments', () => {
    expect(resolveInstrumentId('不存在的公司').ok).toBe(false);
  });
});
