/**
 * Block 2 Tests — Natural Language Understanding.
 *
 * NL1-NL8: Prove the full NL pipeline works correctly.
 * Tests go through: NL → normalize → extract → resolve → compile → Spec/Patch
 * NOT through exact string mapping.
 */

import { describe, it, expect } from 'vitest';
import { normalizeInput } from '../src/interpreter/normalize/normalize-input';
import { extractInitialIntent } from '../src/interpreter/extract/initial-extractor';
import { extractFollowUpIntent } from '../src/interpreter/extract/followup-extractor';
import { parseNumber, parseChineseNumber } from '../src/interpreter/extract/number-parser';
import { resolveInitialIntent } from '../src/interpreter/resolver/initial-resolver';
import { resolveFollowUpIntent } from '../src/interpreter/resolver/followup-context-resolver';
import { compileInitialIntent } from '../src/interpreter/compiler/spec-compiler';
import { compileFollowUpIntent } from '../src/interpreter/compiler/patch-compiler';
import { compareSpecSemantics } from '../src/interpreter/comparison';
import { DeterministicInterpreter } from '../src/interpreter/deterministic-interpreter';
import { validateStructure } from '../src/validation/structural';
import { validateSemantics } from '../src/validation/semantic';
import { applyPatch } from '../src/patch/apply-patch';
import { GOLDEN_CASES } from '../src/fixtures/golden-cases';
import type { DashboardSpec } from '../src/schema/dashboard-spec';

// ── Helper: full NL pipeline ──────────────────────────────────────────────

function runInitialPipeline(input: string) {
  const normalized = normalizeInput(input);
  const extracted = extractInitialIntent(normalized);
  if (!extracted.ok) return extracted;
  const resolved = resolveInitialIntent(extracted.intent);
  if (!resolved.ok) return resolved;
  const compiled = compileInitialIntent(resolved.intent);
  return compiled;
}

function runFollowUpPipeline(currentSpec: DashboardSpec, input: string) {
  const normalized = normalizeInput(input);
  const extracted = extractFollowUpIntent(normalized);
  if (!extracted.ok) return extracted;
  const resolved = resolveFollowUpIntent(extracted.intent, currentSpec);
  if (!resolved.ok) return resolved;
  const compiled = compileFollowUpIntent(resolved.intent, currentSpec);
  return compiled;
}

// ── NL1: Golden Initial ───────────────────────────────────────────────────

describe('NL1: Golden Initial — full NL pipeline', () => {
  const inputs = [
    GOLDEN_CASES[0].input, // G1
    GOLDEN_CASES[1].input, // G2
    GOLDEN_CASES[2].input, // G3
    GOLDEN_CASES[3].input, // G4
    GOLDEN_CASES[4].input, // G5
  ];

  for (let i = 0; i < 5; i++) {
    it(`NL1-${i + 1}: G${i + 1} NL → semantic-equivalent spec`, () => {
      const result = runInitialPipeline(inputs[i]);
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

// ── NL2: Golden Follow-up ────────────────────────────────────────────────

describe('NL2: Golden Follow-up — full NL pipeline', () => {
  const interpreter = new DeterministicInterpreter();

  it('NL2-1: G1 follow-up "把成交量改成涨跌幅" → replace_metric', async () => {
    const spec = (await interpreter.interpretInitial(GOLDEN_CASES[0].input)) as DashboardSpec;
    const patch = await interpreter.interpretFollowUp(spec, '把成交量改成涨跌幅。');
    expect(patch.op).toBe('replace_metric');
    expect((patch as any).from).toBe('volume');
    expect((patch as any).to).toBe('change_pct');
  });

  it('NL2-2: G2 follow-up "改为最近10个交易日" → set_time_range', async () => {
    const spec = (await interpreter.interpretInitial(GOLDEN_CASES[1].input)) as DashboardSpec;
    const patch = await interpreter.interpretFollowUp(spec, '改为最近10个交易日。');
    expect(patch.op).toBe('set_time_range');
    expect((patch as any).count).toBe(10);
  });

  it('NL2-3: G3 follow-up "改成折线图" → set_mark line', async () => {
    const spec = (await interpreter.interpretInitial(GOLDEN_CASES[2].input)) as DashboardSpec;
    const patch = await interpreter.interpretFollowUp(spec, '改成折线图。');
    expect(patch.op).toBe('set_mark');
    expect((patch as any).mark).toBe('line');
  });

  it('NL2-4: G4 follow-up "改为最近20个交易日" → set_time_range', async () => {
    const spec = (await interpreter.interpretInitial(GOLDEN_CASES[3].input)) as DashboardSpec;
    const patch = await interpreter.interpretFollowUp(spec, '改为最近20个交易日。');
    expect(patch.op).toBe('set_time_range');
    expect((patch as any).count).toBe(20);
  });

  it('NL2-5: G5 follow-up "再加上收盘价" → add_metric close', async () => {
    const spec = (await interpreter.interpretInitial(GOLDEN_CASES[4].input)) as DashboardSpec;
    const patch = await interpreter.interpretFollowUp(spec, '再加上收盘价。');
    expect(patch.op).toBe('add_metric');
    expect((patch as any).metric).toBe('close');
  });
});

// ── NL3: Basic Variants ──────────────────────────────────────────────────

describe('NL3: Basic Initial Variants', () => {
  const variants: Array<{ input: string; expectedSpec: DashboardSpec }> = [
    {
      input: '看看A公司近30天的收盘和成交量，找出跌得最厉害的3天',
      expectedSpec: GOLDEN_CASES[0].expectedSpec,
    },
    {
      input: '对比B公司近20天开盘价收盘价走势',
      expectedSpec: GOLDEN_CASES[1].expectedSpec,
    },
    {
      input: '用柱状图看A公司近15天涨跌幅，找涨幅前三',
      expectedSpec: GOLDEN_CASES[2].expectedSpec,
    },
    {
      input: '查看B公司近30天成交量，成交量前5',
      expectedSpec: GOLDEN_CASES[3].expectedSpec,
    },
    {
      input: '看看A公司最近20天的最高价和最低价走势',
      expectedSpec: GOLDEN_CASES[4].expectedSpec,
    },
  ];

  for (let i = 0; i < variants.length; i++) {
    it(`NL3-${i + 1}: variant ${i + 1} → semantic-equivalent spec`, () => {
      const result = runInitialPipeline(variants[i].input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const comparison = compareSpecSemantics(result.spec, variants[i].expectedSpec);
        if (!comparison.equal) {
          console.log(`Variant ${i + 1} differences:`, comparison.differences);
        }
        expect(comparison.equal).toBe(true);
      }
    });
  }
});

// ── NL3b: Basic Follow-up Variants ───────────────────────────────────────

describe('NL3b: Follow-up Variants', () => {
  it('NL3b-1: "成交量换成涨跌幅" → replace_metric', () => {
    const r = runInitialPipeline(GOLDEN_CASES[0].input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = runFollowUpPipeline(r.spec, '成交量换成涨跌幅');
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.patch.op).toBe('replace_metric');
  });

  it('NL3b-2: "看最近10天" → set_time_range 10', () => {
    const r = runInitialPipeline(GOLDEN_CASES[1].input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = runFollowUpPipeline(r.spec, '看最近10天');
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.patch.op).toBe('set_time_range');
      expect((p.patch as any).count).toBe(10);
    }
  });

  it('NL3b-3: "增加开盘价" → add_metric open', () => {
    const r = runInitialPipeline(GOLDEN_CASES[4].input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const p = runFollowUpPipeline(r.spec, '增加开盘价');
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.patch.op).toBe('add_metric');
  });
});

// ── NL4: Surface Normalization ────────────────────────────────────────────

describe('NL4: Surface Normalization', () => {
  it('NL4-1: fullwidth digits → halfwidth', () => {
    expect(normalizeInput('最近３０天')).toContain('30');
  });

  it('NL4-2: spaces around CJK removed', () => {
    const result = normalizeInput('A 公司最近 30 天');
    expect(result).toBe('A公司最近30天');
  });

  it('NL4-3: 柱形图 → 柱状图', () => {
    expect(normalizeInput('柱形图')).toBe('柱状图');
  });

  it('NL4-4: synonym normalization preserves semantics', () => {
    const a = runInitialPipeline('分析A公司最近30个交易日的收盘价');
    const b = runInitialPipeline('分析 A 公司 最近 30 个交易日 的 收盘价');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(compareSpecSemantics(a.spec, b.spec).equal).toBe(true);
    }
  });
});

// ── NL5: Analysis-only Dependency ─────────────────────────────────────────

describe('NL5: Analysis-only Dependency', () => {
  it('NL5: G1 change_pct is analysis-only, not displayed in own view', () => {
    const result = runInitialPipeline(GOLDEN_CASES[0].input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // change_pct should be in metrics (dependency closure)
      expect(result.spec.metrics.some((m) => m.id === 'change_pct')).toBe(true);
      // But NOT in any view's series
      const allSeriesFields = result.spec.views.flatMap((v) => v.series.map((s) => s.field));
      expect(allSeriesFields.includes('change_pct')).toBe(false);
      // And there should be exactly 2 views (close + volume)
      expect(result.spec.views.length).toBe(2);
    }
  });
});

// ── NL6: Missing / Unsupported Smoke ──────────────────────────────────────

describe('NL6: Missing / Unsupported Smoke', () => {
  it('NL6-1: missing instrument → fail', () => {
    const result = runInitialPipeline('分析最近30天的收盘价');
    expect(result.ok).toBe(false);
  });

  it('NL6-2: missing metrics → fail', () => {
    const result = runInitialPipeline('分析A公司最近30天');
    expect(result.ok).toBe(false);
  });

  it('NL6-3: 预测 → UNSUPPORTED_CAPABILITY', () => {
    const result = runInitialPipeline('预测明天股价');
    expect(result.ok).toBe(false);
  });

  it('NL6-4: 买卖建议 → UNSUPPORTED_CAPABILITY', () => {
    const result = runInitialPipeline('给我买入建议');
    expect(result.ok).toBe(false);
  });

  it('NL6-5: 市盈率 → fail', () => {
    const result = runInitialPipeline('分析A公司市盈率');
    expect(result.ok).toBe(false);
  });
});

// ── NL7: Ambiguity Smoke ──────────────────────────────────────────────────

describe('NL7: Ambiguity Smoke', () => {
  it('NL7-1: 自然日 → UNSUPPORTED_CAPABILITY', () => {
    const result = runInitialPipeline('分析A公司最近30个自然日的收盘价');
    expect(result.ok).toBe(false);
  });
});

// ── NL8: Deterministic Parsing ────────────────────────────────────────────

describe('NL8: Deterministic Parsing', () => {
  it('NL8: same NL input → identical spec 10x', () => {
    const input = GOLDEN_CASES[0].input;
    const results: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = runInitialPipeline(input);
      expect(r.ok).toBe(true);
      if (r.ok) results.push(JSON.stringify(r.spec));
    }
    expect(new Set(results).size).toBe(1);
  });

  it('NL8b: same follow-up NL → identical patch 10x', () => {
    const r = runInitialPipeline(GOLDEN_CASES[0].input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const patches: string[] = [];
    for (let i = 0; i < 10; i++) {
      const p = runFollowUpPipeline(r.spec, '把成交量改成涨跌幅。');
      expect(p.ok).toBe(true);
      if (p.ok) patches.push(JSON.stringify(p.patch));
    }
    expect(new Set(patches).size).toBe(1);
  });
});

// ── NL9: DeterministicInterpreter Integration ─────────────────────────────

describe('NL9: DeterministicInterpreter', () => {
  const interpreter = new DeterministicInterpreter();

  it('NL9: interpretInitial produces valid spec', async () => {
    const spec = await interpreter.interpretInitial(GOLDEN_CASES[0].input);
    const s = validateStructure(spec);
    expect(s.ok).toBe(true);
    if (s.ok) expect(validateSemantics(s.spec).ok).toBe(true);
  });

  it('NL9b: interpretFollowUp produces valid patch', async () => {
    const spec = await interpreter.interpretInitial(GOLDEN_CASES[0].input);
    const patch = await interpreter.interpretFollowUp(spec, '把成交量改成涨跌幅。');
    const result = applyPatch(spec, patch);
    expect(result.ok).toBe(true);
  });

  it('NL9c: full pipeline for all 5 golden cases', async () => {
    for (let i = 0; i < 5; i++) {
      const spec = await interpreter.interpretInitial(GOLDEN_CASES[i].input);
      const comparison = compareSpecSemantics(spec, GOLDEN_CASES[i].expectedSpec);
      expect(comparison.equal).toBe(true);
    }
  });
});

// ── Number Parser ─────────────────────────────────────────────────────────

describe('Number Parser', () => {
  it('parses Arabic numbers', () => {
    expect(parseNumber('30')).toBe(30);
    expect(parseNumber('最近30天')).toBe(30);
  });

  it('parses Chinese numbers', () => {
    expect(parseChineseNumber('三')).toBe(3);
    expect(parseChineseNumber('五')).toBe(5);
    expect(parseChineseNumber('十')).toBe(10);
    expect(parseChineseNumber('十五')).toBe(15);
    expect(parseChineseNumber('二十')).toBe(20);
    expect(parseChineseNumber('三十')).toBe(30);
  });

  it('parses mixed text', () => {
    expect(parseNumber('最近十五天')).toBe(15);
    expect(parseNumber('涨幅前三')).toBe(3);
    expect(parseNumber('前5')).toBe(5);
  });
});
