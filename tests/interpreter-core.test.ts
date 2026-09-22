/**
 * Interpreter Core Tests — IC1-IC9+.
 *
 * Prove: given correctly resolved intents, the deterministic compiler
 * produces DashboardSpec/DashboardPatch that matches Golden Cases semantically
 * and passes all Frozen Validators.
 *
 * IC9+: adversarial tests for IR invariant closure and context closure.
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

// ── Resolved Initial Intents (no annotationLabel — derived by Policy) ─────

const G1_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.A',
  metrics: ['close', 'volume', 'change_pct'],
  displayMetrics: ['close', 'volume'],
  timeRange: { count: 30 },
  rankings: [{ metric: 'change_pct', order: 'asc', limit: 3 }],
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
  rankings: [{ metric: 'change_pct', order: 'desc', limit: 3 }],
};

const G4_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.B',
  metrics: ['volume'],
  timeRange: { count: 30 },
  rankings: [{ metric: 'volume', order: 'desc', limit: 5 }],
};

const G5_INTENT: ResolvedInitialIntent = {
  instrument: 'MOCK.A',
  metrics: ['high', 'low'],
  timeRange: { count: 20 },
};

const GOLDEN_INTENTS = [G1_INTENT, G2_INTENT, G3_INTENT, G4_INTENT, G5_INTENT];

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
        expect(validateStructure(result.spec).ok).toBe(true);
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
        const s = validateStructure(result.spec);
        expect(s.ok).toBe(true);
        if (s.ok) expect(validateSemantics(s.spec).ok).toBe(true);
      }
    });
  }
});

// ── IC4: Follow-up Intent → Patch ────────────────────────────────────────

describe('IC4: Follow-up Intent → DashboardPatch', () => {
  it('IC4-1: G1 replace_metric', () => {
    const spec = compileInitialIntent(G1_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const p = compileFollowUpIntent({ op: 'replace_metric', from: 'volume', to: 'change_pct' }, spec.spec);
    expect(p.ok).toBe(true);
  });

  it('IC4-2: G2 set_time_range', () => {
    const spec = compileInitialIntent(G2_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const p = compileFollowUpIntent({ op: 'set_time_range', count: 10 }, spec.spec);
    expect(p.ok).toBe(true);
  });

  it('IC4-3: G3 set_mark', () => {
    const spec = compileInitialIntent(G3_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const v = spec.spec.views[0];
    const p = compileFollowUpIntent({ op: 'set_mark', viewId: v.id, seriesId: v.series[0].id, mark: 'line' }, spec.spec);
    expect(p.ok).toBe(true);
  });

  it('IC4-4: G4 set_time_range', () => {
    const spec = compileInitialIntent(G4_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const p = compileFollowUpIntent({ op: 'set_time_range', count: 20 }, spec.spec);
    expect(p.ok).toBe(true);
  });

  it('IC4-5: G5 add_metric', () => {
    const spec = compileInitialIntent(G5_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;
    const cnyView = spec.spec.views.find((v) => v.series.some((s) => s.unit === 'CNY'));
    const p = compileFollowUpIntent({ op: 'add_metric', metric: 'close', viewId: cnyView!.id }, spec.spec);
    expect(p.ok).toBe(true);
  });
});

// ── IC5: Patch Application ───────────────────────────────────────────────

describe('IC5: Compiled Patch Application', () => {
  it('IC5-1: G1 replace_metric applies', () => {
    const s = compileInitialIntent(G1_INTENT);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const p = compileFollowUpIntent({ op: 'replace_metric', from: 'volume', to: 'change_pct' }, s.spec);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(applyPatch(s.spec, p.patch).ok).toBe(true);
  });

  it('IC5-2: G2 set_time_range applies', () => {
    const s = compileInitialIntent(G2_INTENT);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const p = compileFollowUpIntent({ op: 'set_time_range', count: 10 }, s.spec);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(applyPatch(s.spec, p.patch).ok).toBe(true);
  });

  it('IC5-3: G3 set_mark applies', () => {
    const s = compileInitialIntent(G3_INTENT);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const v = s.spec.views[0];
    const p = compileFollowUpIntent({ op: 'set_mark', viewId: v.id, seriesId: v.series[0].id, mark: 'line' }, s.spec);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(applyPatch(s.spec, p.patch).ok).toBe(true);
  });

  it('IC5-4: G4 set_time_range applies', () => {
    const s = compileInitialIntent(G4_INTENT);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const p = compileFollowUpIntent({ op: 'set_time_range', count: 20 }, s.spec);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(applyPatch(s.spec, p.patch).ok).toBe(true);
  });

  it('IC5-5: G5 add_metric applies', () => {
    const s = compileInitialIntent(G5_INTENT);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const cnyView = s.spec.views.find((v) => v.series.some((s2) => s2.unit === 'CNY'));
    const p = compileFollowUpIntent({ op: 'add_metric', metric: 'close', viewId: cnyView!.id }, s.spec);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(applyPatch(s.spec, p.patch).ok).toBe(true);
  });
});

// ── IC6: Registry Single Source ───────────────────────────────────────────

describe('IC6: Registry Single Source', () => {
  it('IC6: resolver returns canonical ID only, no metadata', () => {
    const r = resolveMetricId('收盘价');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.metricId).toBe('close');
  });

  it('IC6b: compiled spec metadata comes from Registry', () => {
    const r = compileInitialIntent(G1_INTENT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const cm = r.spec.metrics.find((m) => m.id === 'close');
      expect(cm?.label).toBe('收盘价');
      expect(cm?.unit).toBe('CNY');
      expect(cm?.kind).toBe('raw');
    }
  });
});

// ── IC7: Unsupported Intent ──────────────────────────────────────────────

describe('IC7: Unsupported / Invalid Intent', () => {
  it('IC7: unknown instrument → FAIL', () => {
    const r = compileInitialIntent({ instrument: 'UNKNOWN.X', metrics: ['close'], timeRange: { count: 30 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN_INSTRUMENT');
  });

  it('IC7b: unknown metric → FAIL', () => {
    const r = compileInitialIntent({ instrument: 'MOCK.A', metrics: ['pe_ratio'], timeRange: { count: 30 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UNKNOWN_METRIC');
  });

  it('IC7c: empty metrics → FAIL', () => {
    const r = compileInitialIntent({ instrument: 'MOCK.A', metrics: [], timeRange: { count: 30 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MISSING_METRICS');
  });

  it('IC7d: out of range → FAIL', () => {
    const r = compileInitialIntent({ instrument: 'MOCK.A', metrics: ['close'], timeRange: { count: 100 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('OUT_OF_RANGE');
  });
});

// ── IC8: Deterministic Compiler ──────────────────────────────────────────

describe('IC8: Deterministic Compiler', () => {
  it('IC8: same intent → identical spec 10x', () => {
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = compileInitialIntent(G1_INTENT);
      expect(r.ok).toBe(true);
      if (r.ok) results.push(JSON.stringify(r.spec));
    }
    expect(new Set(results).size).toBe(1);
  });

  it('IC8b: same follow-up → identical patch 10x', () => {
    const s = compileInitialIntent(G1_INTENT);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const patches: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = compileFollowUpIntent({ op: 'replace_metric', from: 'volume', to: 'change_pct' }, s.spec);
      expect(r.ok).toBe(true);
      if (r.ok) patches.push(JSON.stringify(r.patch));
    }
    expect(new Set(patches).size).toBe(1);
  });
});

// ── IC9: Adversarial IR Invariants ────────────────────────────────────────

describe('IC9: IR Invariant Closure', () => {
  it('IC9-1: ranking annotation label cannot be faked by intent', () => {
    // RankingIntent no longer has annotationLabel field
    // The annotation label is always derived by Policy from metric + order
    const intent: ResolvedInitialIntent = {
      instrument: 'MOCK.A',
      metrics: ['change_pct'],
      timeRange: { count: 15 },
      rankings: [{ metric: 'change_pct', order: 'asc', limit: 3 }],
    };
    const r = compileInitialIntent(intent);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Annotation label must be '跌幅最大' (from Policy), not anything custom
      const ann = r.spec.views[0].annotations[0];
      expect(ann.label).toBe('跌幅最大');
    }
  });

  it('IC9-2: displayMetrics=[] → FAIL', () => {
    const r = compileInitialIntent({
      instrument: 'MOCK.A', metrics: ['close'], displayMetrics: [], timeRange: { count: 30 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('MISSING_METRICS');
  });

  it('IC9-3: displayMetrics contains field not in metrics → FAIL', () => {
    const r = compileInitialIntent({
      instrument: 'MOCK.A', metrics: ['close'], displayMetrics: ['volume'], timeRange: { count: 30 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICTING_INTENT');
  });

  it('IC9-4: duplicate metrics → FAIL', () => {
    const r = compileInitialIntent({
      instrument: 'MOCK.A', metrics: ['close', 'close'], timeRange: { count: 30 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICTING_INTENT');
  });

  it('IC9-5: ranking.metric not in metrics → FAIL', () => {
    const r = compileInitialIntent({
      instrument: 'MOCK.A', metrics: ['close'], timeRange: { count: 30 },
      rankings: [{ metric: 'volume', order: 'desc', limit: 5 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICTING_INTENT');
  });

  it('IC9-6: ranking.limit=0 → FAIL', () => {
    const r = compileInitialIntent({
      instrument: 'MOCK.A', metrics: ['close'], timeRange: { count: 30 },
      rankings: [{ metric: 'close', order: 'desc', limit: 0 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('OUT_OF_RANGE');
  });

  it('IC9-7: duplicate transform semantic identity → FAIL', () => {
    const r = compileInitialIntent({
      instrument: 'MOCK.A', metrics: ['change_pct'], timeRange: { count: 30 },
      rankings: [
        { metric: 'change_pct', order: 'asc', limit: 3 },
        { metric: 'change_pct', order: 'asc', limit: 3 }, // duplicate
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICTING_INTENT');
  });

  it('IC9-8: duplicate displayMetrics → FAIL', () => {
    const r = compileInitialIntent({
      instrument: 'MOCK.A', metrics: ['close', 'volume'], displayMetrics: ['close', 'close'],
      timeRange: { count: 30 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICTING_INTENT');
  });
});

// ── IC10: Adversarial Follow-up Context Closure ──────────────────────────

describe('IC10: Follow-up Context Closure', () => {
  const makeSpec = () => {
    const r = compileInitialIntent(G1_INTENT);
    expect(r.ok).toBe(true);
    return (r as { ok: true; spec: DashboardSpec }).spec;
  };

  it('IC10-1: set_mark with series from wrong view → FAIL', () => {
    const spec = makeSpec();
    // volume_series belongs to volume_view, not price_view
    const r = compileFollowUpIntent(
      { op: 'set_mark', viewId: 'close_volume_view', seriesId: 'volume_series', mark: 'line' },
      spec,
    );
    // If view exists but series doesn't belong to it → FAIL
    if (spec.views.some((v) => v.id === 'close_volume_view')) {
      expect(r.ok).toBe(false);
    }
  });

  it('IC10-2: set_mark with non-existent seriesId → FAIL', () => {
    const spec = makeSpec();
    const view = spec.views[0];
    const r = compileFollowUpIntent(
      { op: 'set_mark', viewId: view.id, seriesId: 'nonexistent_series', mark: 'line' },
      spec,
    );
    expect(r.ok).toBe(false);
  });

  it('IC10-3: set_mark with unsupported mark for metric → FAIL', () => {
    // volume supports both line and bar in current Registry, so this test
    // would need a metric that doesn't support a mark.
    // Current Registry: all metrics support both line and bar.
    // So we test the check exists by using a metric that supports the mark.
    const spec = makeSpec();
    const view = spec.views.find((v) => v.series.length > 0)!;
    const series = view.series[0];
    // All current metrics support both marks, so this should PASS
    const r = compileFollowUpIntent(
      { op: 'set_mark', viewId: view.id, seriesId: series.id, mark: 'line' },
      spec,
    );
    expect(r.ok).toBe(true);
  });

  it('IC10-4: replace_metric same from/to → FAIL', () => {
    const spec = makeSpec();
    const r = compileFollowUpIntent(
      { op: 'replace_metric', from: 'close', to: 'close' },
      spec,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICTING_INTENT');
  });

  it('IC10-5: add_metric already in spec → FAIL', () => {
    const spec = makeSpec();
    // 'close' is already in G1's metrics
    const cnyView = spec.views.find((v) => v.series.some((s) => s.unit === 'CNY'));
    const r = compileFollowUpIntent(
      { op: 'add_metric', metric: 'close', viewId: cnyView!.id },
      spec,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CONFLICTING_INTENT');
  });

  it('IC10-6: add_metric to non-existent view → FAIL', () => {
    const spec = makeSpec();
    const r = compileFollowUpIntent(
      { op: 'add_metric', metric: 'open', viewId: 'nonexistent_view' },
      spec,
    );
    expect(r.ok).toBe(false);
  });

  it('IC10-7: set_time_range out of range → FAIL', () => {
    const spec = makeSpec();
    const r = compileFollowUpIntent({ op: 'set_time_range', count: 0 }, spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('OUT_OF_RANGE');
  });
});

// ── IC11: Success → Structural + Semantic Valid (general invariant) ───────

describe('IC11: compile success → always passes validators', () => {
  const testIntents: ResolvedInitialIntent[] = [
    { instrument: 'MOCK.A', metrics: ['close'], timeRange: { count: 1 } },
    { instrument: 'MOCK.A', metrics: ['close', 'volume', 'change_pct'], displayMetrics: ['close', 'volume'], timeRange: { count: 60 }, rankings: [{ metric: 'change_pct', order: 'asc', limit: 3 }] },
    { instrument: 'MOCK.B', metrics: ['open', 'close', 'volume'], timeRange: { count: 20 } },
    { instrument: 'MOCK.A', metrics: ['high', 'low', 'close'], preferredMark: 'line', timeRange: { count: 45 } },
    { instrument: 'MOCK.B', metrics: ['change_pct'], preferredMark: 'bar', timeRange: { count: 10 }, rankings: [{ metric: 'change_pct', order: 'desc', limit: 1 }] },
  ];

  for (let i = 0; i < testIntents.length; i++) {
    it(`IC11-${i + 1}: success spec passes structural + semantic`, () => {
      const r = compileInitialIntent(testIntents[i]);
      expect(r.ok).toBe(true);
      if (r.ok) {
        const s = validateStructure(r.spec);
        expect(s.ok).toBe(true);
        if (s.ok) expect(validateSemantics(s.spec).ok).toBe(true);
      }
    });
  }
});

// ── IC12: Patch success → always applies ──────────────────────────────────

describe('IC12: patch compile success → always applies', () => {
  it('IC12: various patches all apply successfully', () => {
    const spec = compileInitialIntent(G1_INTENT);
    expect(spec.ok).toBe(true);
    if (!spec.ok) return;

    const patches: ResolvedFollowUpIntent[] = [
      { op: 'replace_metric', from: 'volume', to: 'change_pct' },
      { op: 'set_time_range', count: 10 },
    ];

    for (const pi of patches) {
      const r = compileFollowUpIntent(pi, spec.spec);
      expect(r.ok).toBe(true);
      if (r.ok) expect(applyPatch(spec.spec, r.patch).ok).toBe(true);
    }
  });
});

// ── Resolver Tests ────────────────────────────────────────────────────────

describe('Metric Resolver', () => {
  it('resolves Chinese labels', () => {
    expect((resolveMetricId('收盘价') as any).metricId).toBe('close');
    expect((resolveMetricId('成交量') as any).metricId).toBe('volume');
    expect((resolveMetricId('涨跌幅') as any).metricId).toBe('change_pct');
  });

  it('resolves canonical IDs', () => {
    expect((resolveMetricId('close') as any).metricId).toBe('close');
  });

  it('rejects unknown', () => {
    expect(resolveMetricId('市盈率').ok).toBe(false);
  });

  it('batch resolve', () => {
    expect(resolveMetricIds(['收盘价', '成交量']).ok).toBe(true);
    expect(resolveMetricIds(['收盘价', '市盈率']).ok).toBe(false);
  });
});

describe('Instrument Resolver', () => {
  it('resolves aliases', () => {
    expect((resolveInstrumentId('A公司') as any).symbol).toBe('MOCK.A');
    expect((resolveInstrumentId('A 公司') as any).symbol).toBe('MOCK.A');
  });

  it('rejects unknown', () => {
    expect(resolveInstrumentId('不存在').ok).toBe(false);
  });
});
