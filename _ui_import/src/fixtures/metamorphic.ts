/**
 * Metamorphic Fixtures — semantic equivalence pairs for future Interpreter testing.
 *
 * These pairs should produce the same normalized DashboardSpec when the
 * Interpreter is implemented. For Phase 0, we only establish the fixtures;
 * actual metamorphic testing awaits the Interpreter.
 *
 * Status: METAMORPHIC_FIXTURES=READY
 */

export interface MetamorphicPair {
  id: string;
  description: string;
  variants: string[];
  /** The expected normalized spec (shared across all variants) */
  expectedNormalized: {
    instrument: string;
    metrics: string[];
    timeRangeCount: number;
    viewCount: number;
  };
}

export const METAMORPHIC_PAIRS: MetamorphicPair[] = [
  {
    id: 'MM1',
    description: '收盘价+成交量，不同表述方式',
    variants: [
      '分析A公司最近30个交易日的收盘价和成交量',
      '分析 A 公司最近 30 个交易日的收盘价和成交量',
      '看看 A 公司近 30 个交易日收盘价、成交量',
      '查看A公司近30天收盘价和成交量',
      '分析A公司最近30个交易日的收盘价和成交量。',
    ],
    expectedNormalized: {
      instrument: 'MOCK.A',
      metrics: ['close', 'volume'],
      timeRangeCount: 30,
      viewCount: 2,
    },
  },
  {
    id: 'MM2',
    description: '开盘价vs收盘价比较',
    variants: [
      '比较 B 公司最近 20 个交易日的开盘价和收盘价走势',
      '比较B公司最近20个交易日的开盘价和收盘价走势',
      '对比 B 公司近 20 天开盘价与收盘价',
      '看看B公司近20个交易日开盘价收盘价对比',
    ],
    expectedNormalized: {
      instrument: 'MOCK.B',
      metrics: ['open', 'close'],
      timeRangeCount: 20,
      viewCount: 1,
    },
  },
  {
    id: 'MM3',
    description: '涨跌幅柱状图',
    variants: [
      '用柱状图展示 A 公司最近 15 个交易日的涨跌幅',
      '用柱状图展示A公司最近15个交易日的涨跌幅',
      '以柱状图形式展示 A 公司近 15 天涨跌幅',
    ],
    expectedNormalized: {
      instrument: 'MOCK.A',
      metrics: ['change_pct'],
      timeRangeCount: 15,
      viewCount: 1,
    },
  },
];

export const METAMORPHIC_STATUS = 'METAMORPHIC_FIXTURES=READY';
