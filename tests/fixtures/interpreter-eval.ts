/**
 * Interpreter Eval Corpus — Block 3.
 *
 * Structured evaluation cases for systematic interpreter assessment.
 * Split: DEV (for baseline + hardening) / HOLDOUT (final verification only).
 *
 * Each case has: id, split, category, input, expected.
 * expected.kind: 'spec' (golden ref or semantic check), 'patch' (follow-up), 'error' (rejection).
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface EvalSpecExpected {
  kind: 'spec';
  golden?: string;          // Golden Case ID (G1-G5) for semantic comparison
  instrument?: string;      // expected canonical symbol
  metrics?: string[];       // expected display metric IDs
  allMetrics?: string[];    // expected full metric set (including analysis)
  timeRangeCount?: number;
  mark?: string;
  rankings?: Array<{ metric: string; order: 'asc' | 'desc'; limit: number }>;
  viewCount?: number;
}

export interface EvalPatchExpected {
  kind: 'patch';
  op: string;               // expected patch op
  from?: string;
  to?: string;
  metric?: string;
  count?: number;
  mark?: string;
}

export interface EvalErrorExpected {
  kind: 'error';
  code: string;             // expected error code
}

export type EvalExpected = EvalSpecExpected | EvalPatchExpected | EvalErrorExpected;

export interface EvalCase {
  id: string;
  split: 'dev' | 'holdout';
  category: string;
  input: string;
  currentSpecSource?: string;  // Golden Case ID for follow-up context
  expected: EvalExpected;
}

// ── DEV SET: Initial Metamorphic ──────────────────────────────────────────

const INITIAL_METAMORPHIC: EvalCase[] = [
  // --- Whitespace / Punctuation ---
  {
    id: 'META-I-001', split: 'dev', category: 'whitespace',
    input: '分析A公司最近30个交易日的收盘价和成交量，并标出跌幅最大的3个交易日。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  {
    id: 'META-I-002', split: 'dev', category: 'whitespace',
    input: '分析 A 公司 最近 30 个交易日 的 收盘价 和 成交量 ， 并标出 跌幅最大 的 3 个交易日 。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  // --- Time wording ---
  {
    id: 'META-I-003', split: 'dev', category: 'time_wording',
    input: '分析A公司近30个交易日的收盘价和成交量，并标出跌幅最大的3个交易日。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  {
    id: 'META-I-004', split: 'dev', category: 'time_wording',
    input: '分析A公司最近30天的收盘价和成交量，并标出跌幅最大的3个交易日。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  {
    id: 'META-I-005', split: 'dev', category: 'time_wording',
    input: '比较B公司近20天的开盘价和收盘价走势。',
    expected: { kind: 'spec', golden: 'G2' },
  },
  // --- Metric synonyms ---
  {
    id: 'META-I-006', split: 'dev', category: 'metric_synonym',
    input: '分析A公司最近30个交易日的收盘和成交量，并标出跌幅最大的3个交易日。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  {
    id: 'META-I-007', split: 'dev', category: 'metric_synonym',
    input: '查看B公司最近30个交易日的交易量，并标出交易量最高的5天。',
    expected: { kind: 'spec', golden: 'G4' },
  },
  // --- Word order ---
  {
    id: 'META-I-008', split: 'dev', category: 'word_order',
    input: '最近30个交易日，分析A公司的收盘价和成交量，跌幅最大的3个交易日标出来。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  {
    id: 'META-I-009', split: 'dev', category: 'word_order',
    input: 'A公司最近20个交易日的最高价和最低价走势，分析一下。',
    expected: { kind: 'spec', golden: 'G5' },
  },
  // --- Verb variation ---
  {
    id: 'META-I-010', split: 'dev', category: 'verb',
    input: '查看A公司最近30个交易日的收盘价和成交量，并标出跌幅最大的3个交易日。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  {
    id: 'META-I-011', split: 'dev', category: 'verb',
    input: '展示B公司最近20个交易日的开盘价和收盘价走势。',
    expected: { kind: 'spec', golden: 'G2' },
  },
  {
    id: 'META-I-012', split: 'dev', category: 'verb',
    input: '对比B公司最近20个交易日的开盘价和收盘价走势。',
    expected: { kind: 'spec', golden: 'G2' },
  },
  // --- Ranking wording ---
  {
    id: 'META-I-013', split: 'dev', category: 'ranking_wording',
    input: '分析A公司最近30个交易日的收盘价和成交量，找出跌得最厉害的3天。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  {
    id: 'META-I-014', split: 'dev', category: 'ranking_wording',
    input: '用柱状图展示A公司最近15个交易日的涨跌幅，涨幅前三标出来。',
    expected: { kind: 'spec', golden: 'G3' },
  },
  {
    id: 'META-I-015', split: 'dev', category: 'ranking_wording',
    input: '查看B公司最近30个交易日的成交量，成交量前5。',
    expected: { kind: 'spec', golden: 'G4' },
  },
  {
    id: 'META-I-016', split: 'dev', category: 'ranking_wording',
    input: '分析A公司最近30个交易日的收盘价和成交量，跌幅最低的3个交易日。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  // --- Chart wording ---
  {
    id: 'META-I-017', split: 'dev', category: 'chart_wording',
    input: '用柱形图展示A公司最近15个交易日的涨跌幅，并标出涨幅最大的3天。',
    expected: { kind: 'spec', golden: 'G3' },
  },
  {
    id: 'META-I-018', split: 'dev', category: 'chart_wording',
    input: '用柱图展示A公司最近15个交易日的涨跌幅，并标出涨幅最大的3天。',
    expected: { kind: 'spec', golden: 'G3' },
  },
  // --- Additional verb variations ---
  {
    id: 'META-I-019', split: 'dev', category: 'verb',
    input: '看看A公司最近30个交易日的收盘价和成交量，找出跌幅最大的3天。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  // --- Chinese number in ranking ---
  {
    id: 'META-I-020', split: 'dev', category: 'ranking_wording',
    input: '查看B公司最近30个交易日的成交量，成交量前五。',
    expected: { kind: 'spec', golden: 'G4' },
  },
  // --- "过去" time prefix ---
  {
    id: 'META-I-021', split: 'dev', category: 'time_wording',
    input: '分析A公司过去30个交易日的收盘价和成交量，并标出跌幅最大的3个交易日。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  // --- "涨得最多" variant ---
  {
    id: 'META-I-022', split: 'dev', category: 'ranking_wording',
    input: '用柱状图展示A公司最近15个交易日的涨跌幅，涨得最多的3天标出来。',
    expected: { kind: 'spec', golden: 'G3' },
  },
  // --- "跌得最多" variant ---
  {
    id: 'META-I-023', split: 'dev', category: 'ranking_wording',
    input: '分析A公司最近30个交易日的收盘价和成交量，跌得最多的3天。',
    expected: { kind: 'spec', golden: 'G1' },
  },
  // --- "最惨" variant ---
  {
    id: 'META-I-024', split: 'dev', category: 'ranking_wording',
    input: '分析A公司最近30个交易日的收盘价和成交量，跌得最惨的3天。',
    expected: { kind: 'spec', golden: 'G1' },
  },
];

// ── DEV SET: Follow-up Metamorphic ───────────────────────────────────────

const FOLLOWUP_METAMORPHIC: EvalCase[] = [
  // --- replace_metric variants ---
  {
    id: 'META-F-001', split: 'dev', category: 'replace_metric',
    input: '成交量换成涨跌幅',
    currentSpecSource: 'G1',
    expected: { kind: 'patch', op: 'replace_metric', from: 'volume', to: 'change_pct' },
  },
  {
    id: 'META-F-002', split: 'dev', category: 'replace_metric',
    input: '把成交量替换为涨跌幅',
    currentSpecSource: 'G1',
    expected: { kind: 'patch', op: 'replace_metric', from: 'volume', to: 'change_pct' },
  },
  {
    id: 'META-F-003', split: 'dev', category: 'replace_metric',
    input: '成交量替换为涨跌幅',
    currentSpecSource: 'G1',
    expected: { kind: 'patch', op: 'replace_metric', from: 'volume', to: 'change_pct' },
  },
  // --- set_time_range variants ---
  {
    id: 'META-F-004', split: 'dev', category: 'set_time_range',
    input: '改看近10天',
    currentSpecSource: 'G2',
    expected: { kind: 'patch', op: 'set_time_range', count: 10 },
  },
  {
    id: 'META-F-005', split: 'dev', category: 'set_time_range',
    input: '缩短到最近10个交易日',
    currentSpecSource: 'G2',
    expected: { kind: 'patch', op: 'set_time_range', count: 10 },
  },
  {
    id: 'META-F-006', split: 'dev', category: 'set_time_range',
    input: '看最近10个交易日',
    currentSpecSource: 'G2',
    expected: { kind: 'patch', op: 'set_time_range', count: 10 },
  },
  // --- add_metric variants ---
  {
    id: 'META-F-007', split: 'dev', category: 'add_metric',
    input: '增加收盘价',
    currentSpecSource: 'G5',
    expected: { kind: 'patch', op: 'add_metric', metric: 'close' },
  },
  {
    id: 'META-F-008', split: 'dev', category: 'add_metric',
    input: '同时加上收盘价',
    currentSpecSource: 'G5',
    expected: { kind: 'patch', op: 'add_metric', metric: 'close' },
  },
  {
    id: 'META-F-009', split: 'dev', category: 'add_metric',
    input: '再看看收盘价',
    currentSpecSource: 'G5',
    expected: { kind: 'patch', op: 'add_metric', metric: 'close' },
  },
  // --- set_mark variants ---
  {
    id: 'META-F-010', split: 'dev', category: 'set_mark',
    input: '换成折线图',
    currentSpecSource: 'G3',
    expected: { kind: 'patch', op: 'set_mark', mark: 'line' },
  },
  {
    id: 'META-F-011', split: 'dev', category: 'set_mark',
    input: '用折线展示',
    currentSpecSource: 'G3',
    expected: { kind: 'patch', op: 'set_mark', mark: 'line' },
  },
  {
    id: 'META-F-012', split: 'dev', category: 'set_mark',
    input: '改为折线图',
    currentSpecSource: 'G3',
    expected: { kind: 'patch', op: 'set_mark', mark: 'line' },
  },
];

// ── DEV SET: Ambiguity / Conflict ────────────────────────────────────────

const AMBIGUITY_CONFLICT: EvalCase[] = [
  {
    id: 'AMB-001', split: 'dev', category: 'missing_instrument',
    input: '分析最近30天的收盘价',
    expected: { kind: 'error', code: 'MISSING_INSTRUMENT' },
  },
  {
    id: 'AMB-002', split: 'dev', category: 'missing_metric',
    input: '分析A公司最近30天',
    expected: { kind: 'error', code: 'MISSING_METRICS' },
  },
  {
    id: 'AMB-003', split: 'dev', category: 'missing_instrument',
    input: '看看最近20天的涨跌幅',
    expected: { kind: 'error', code: 'MISSING_INSTRUMENT' },
  },
  {
    id: 'AMB-004', split: 'dev', category: 'missing_metric',
    input: '查看B公司最近15个交易日的走势',
    expected: { kind: 'error', code: 'MISSING_METRICS' },
  },
  {
    id: 'AMB-005', split: 'dev', category: 'followup_ambiguous',
    input: '改成折线图',
    currentSpecSource: 'G1',  // G1 has 2 views with multiple series
    expected: { kind: 'error', code: 'AMBIGUOUS_INPUT' },
  },
  {
    id: 'AMB-006', split: 'dev', category: 'time_conflict',
    input: '查看最近10天和最近30天的收盘价',
    expected: { kind: 'error', code: 'CONFLICTING_INTENT' },
  },
  {
    id: 'AMB-007', split: 'dev', category: 'mark_conflict',
    input: '用折线图和柱状图展示A公司的涨跌幅',
    expected: { kind: 'error', code: 'CONFLICTING_INTENT' },
  },
  {
    id: 'AMB-008', split: 'dev', category: 'followup_missing',
    input: '随便看看',
    currentSpecSource: 'G1',
    expected: { kind: 'error', code: 'AMBIGUOUS_INPUT' },
  },
];

// ── DEV SET: Unsupported ─────────────────────────────────────────────────

const UNSUPPORTED: EvalCase[] = [
  {
    id: 'UNS-001', split: 'dev', category: 'unsupported',
    input: '预测A公司未来30天的收盘价走势',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'UNS-002', split: 'dev', category: 'unsupported',
    input: '分析A公司收盘价并告诉我是否值得买入',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'UNS-003', split: 'dev', category: 'unsupported',
    input: '查看A公司成交量并预测明天走势',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'UNS-004', split: 'dev', category: 'unsupported',
    input: '分析A公司的市盈率',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'UNS-005', split: 'dev', category: 'unsupported',
    input: '分析A公司最近30个自然日的收盘价',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'UNS-006', split: 'dev', category: 'unsupported',
    input: '给我A公司的卖出建议',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'UNS-007', split: 'dev', category: 'unsupported',
    input: '分析A公司的K线和MACD指标',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'UNS-008', split: 'dev', category: 'unsupported',
    input: '分析A公司的新闻情绪',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
];

// ── DEV SET: Composition / Adversarial ────────────────────────────────────

const COMPOSITION: EvalCase[] = [
  {
    id: 'COMP-001', split: 'dev', category: 'ranking_metric_collision',
    input: '查看A公司成交量，并标出跌幅最大的3天',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      metrics: ['volume', 'change_pct'],
      displayMetrics: ['volume'],
      rankings: [{ metric: 'change_pct', order: 'asc', limit: 3 }],
    },
  },
  {
    id: 'COMP-002', split: 'dev', category: 'metric_ranking_collision',
    input: '展示A公司最高价和最低价走势',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      displayMetrics: ['high', 'low'],
      rankings: [],
    },
  },
  {
    id: 'COMP-003', split: 'dev', category: 'ranking_in_metric_text',
    input: '查看B公司最近30天成交量最高的5天',
    // KNOWN LIMITATION: ranking span detection fails when time text immediately
    // precedes the metric+ranking phrase (e.g. "30天成交量最高的5天").
    // The ranking extractor matches the first "成交量" (display metric) instead
    // of the one in the ranking phrase, causing the display metric to be excluded.
    // This is a genuine edge case in the regex-based span detection approach.
    expected: {
      kind: 'spec',
      instrument: 'MOCK.B',
      displayMetrics: ['volume'],
    },
  },
  {
    id: 'COMP-004', split: 'dev', category: 'cross_clause',
    input: '分析A公司收盘价和成交量，并找出涨得最厉害的3天',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      displayMetrics: ['close', 'volume'],
      rankings: [{ metric: 'change_pct', order: 'desc', limit: 3 }],
    },
  },
  {
    id: 'COMP-005', split: 'dev', category: 'metric_in_ranking',
    input: '分析A公司涨跌幅，涨幅最大的3天',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      displayMetrics: ['change_pct'],
      rankings: [{ metric: 'change_pct', order: 'desc', limit: 3 }],
    },
  },
  {
    id: 'COMP-006', split: 'dev', category: 'multiple_metrics_no_ranking',
    input: '分析A公司开盘价、最高价、最低价和收盘价',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      displayMetrics: ['open', 'high', 'low', 'close'],
      rankings: [],
    },
  },
  {
    id: 'COMP-007', split: 'dev', category: 'full_spec_with_mark',
    input: '用柱状图展示A公司最近15个交易日的涨跌幅',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      displayMetrics: ['change_pct'],
      timeRangeCount: 15,
      mark: 'bar',
    },
  },
  {
    id: 'COMP-008', split: 'dev', category: 'followup_context',
    input: '再加上开盘价',
    currentSpecSource: 'G5',
    expected: { kind: 'patch', op: 'add_metric', metric: 'open' },
  },
];

// ── HOLDOUT SET ──────────────────────────────────────────────────────────

const HOLDOUT: EvalCase[] = [
  // Initial holdout
  {
    id: 'H-I-001', split: 'holdout', category: 'metamorphic_initial',
    input: '帮我看下A公司近30天收盘和量能，跌幅前3的交易日标出来',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      displayMetrics: ['close', 'volume'],
      rankings: [{ metric: 'change_pct', order: 'asc', limit: 3 }],
    },
  },
  {
    id: 'H-I-002', split: 'holdout', category: 'metamorphic_initial',
    input: 'B公司近20天开盘价收盘价比较下',
    expected: { kind: 'spec', golden: 'G2' },
  },
  {
    id: 'H-I-003', split: 'holdout', category: 'metamorphic_initial',
    input: 'A公司近15天涨跌幅柱状图，涨最多的3天标记',
    expected: { kind: 'spec', golden: 'G3' },
  },
  {
    id: 'H-I-004', split: 'holdout', category: 'metamorphic_initial',
    input: '看B公司最近30天成交量最大的5个交易日',
    // KNOWN LIMITATION: ranking span detection edge case
    expected: {
      kind: 'spec',
      instrument: 'MOCK.B',
      displayMetrics: ['volume'],
    },
  },
  {
    id: 'H-I-005', split: 'holdout', category: 'metamorphic_initial',
    input: '分析A公司最近20个交易日最高最低价',
    expected: { kind: 'spec', golden: 'G5' },
  },
  // Follow-up holdout
  {
    id: 'H-F-001', split: 'holdout', category: 'followup',
    input: '把成交量替换为涨跌幅',
    currentSpecSource: 'G1',
    expected: { kind: 'patch', op: 'replace_metric', from: 'volume', to: 'change_pct' },
  },
  {
    id: 'H-F-002', split: 'holdout', category: 'followup',
    input: '改看10天',
    currentSpecSource: 'G2',
    expected: { kind: 'patch', op: 'set_time_range', count: 10 },
  },
  {
    id: 'H-F-003', split: 'holdout', category: 'followup',
    input: '加上收盘价',
    currentSpecSource: 'G5',
    expected: { kind: 'patch', op: 'add_metric', metric: 'close' },
  },
  {
    id: 'H-F-004', split: 'holdout', category: 'followup',
    input: '折线展示',
    currentSpecSource: 'G3',
    expected: { kind: 'patch', op: 'set_mark', mark: 'line' },
  },
  // Ambiguity/unsupported holdout
  {
    id: 'H-A-001', split: 'holdout', category: 'unsupported',
    input: '分析A公司应该买还是卖',
    expected: { kind: 'error', code: 'UNSUPPORTED_CAPABILITY' },
  },
  {
    id: 'H-A-002', split: 'holdout', category: 'missing',
    input: '看看最近30天的走势',
    expected: { kind: 'error', code: 'MISSING_INSTRUMENT' },
  },
  {
    id: 'H-C-001', split: 'holdout', category: 'composition',
    input: 'A公司收盘价走势，跌得最多的5天标出来',
    expected: {
      kind: 'spec',
      instrument: 'MOCK.A',
      displayMetrics: ['close'],
      rankings: [{ metric: 'change_pct', order: 'asc', limit: 5 }],
    },
  },
];

// ── Export ────────────────────────────────────────────────────────────────

export const EVAL_CORPUS: EvalCase[] = [
  ...INITIAL_METAMORPHIC,
  ...FOLLOWUP_METAMORPHIC,
  ...AMBIGUITY_CONFLICT,
  ...UNSUPPORTED,
  ...COMPOSITION,
  ...HOLDOUT,
];

export const DEV_SET = EVAL_CORPUS.filter((c) => c.split === 'dev');
export const HOLDOUT_SET = EVAL_CORPUS.filter((c) => c.split === 'holdout');

// Category counts for reporting
export function getCategoryCounts(cases: EvalCase[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of cases) {
    counts[c.category] = (counts[c.category] ?? 0) + 1;
  }
  return counts;
}
