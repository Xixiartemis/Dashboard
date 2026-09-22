/**
 * Golden Cases — 5 success cases + 5 follow-up patch cases.
 *
 * Updated for v1.0.0 contract tightening:
 * - schemaVersion = '1.0.0' (literal)
 * - insight.intentSummary (not summary)
 * - insight facts use rank_summary with transformRef
 * - x = { field: 'date', type: 'ordinal' } (literal)
 * - dataSource.resolved = 'embedded_mock', priceAdjustment = 'raw'
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import { MANIFEST } from '../data/manifest';

const DS = (spec: Omit<DashboardSpec, 'schemaVersion' | 'dataSource'>): DashboardSpec => ({
  schemaVersion: '1.0.0',
  dataSource: {
    preference: 'embedded_mock',
    resolved: 'embedded_mock',
    datasetId: MANIFEST.datasetId,
    asOf: MANIFEST.asOf,
    timezone: MANIFEST.timezone,
    priceAdjustment: 'raw',
  },
  ...spec,
});

// ── G1: 收盘价+成交量+跌幅最大3天 ──────────────────────────────────────────

export const G1_SPEC: DashboardSpec = DS({
  instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
  timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
  metrics: [
    { id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' },
    { id: 'volume', label: '成交量', kind: 'raw', unit: 'share' },
    { id: 'change_pct', label: '涨跌幅', kind: 'derived', unit: '%' },
  ],
  transforms: [
    { id: 'worst_3_days', type: 'rank', field: 'change_pct', order: 'asc', limit: 3 },
  ],
  views: [
    {
      id: 'price_view',
      title: 'A公司最近30个交易日收盘价',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 'close_series', field: 'close', mark: 'line', unit: 'CNY' }],
      annotations: [{ id: 'worst_ann', type: 'highlight', transformRef: 'worst_3_days', label: '跌幅最大' }],
    },
    {
      id: 'volume_view',
      title: 'A公司最近30个交易日成交量',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 'volume_series', field: 'volume', mark: 'bar', unit: 'share' }],
      annotations: [],
    },
  ],
  insight: {
    intentSummary: '分析A公司最近30个交易日的收盘价和成交量变化',
    facts: [
      { kind: 'rank_summary', metric: 'change_pct', label: '跌幅最大的3个交易日', transformRef: 'worst_3_days' },
    ],
  },
});

export const G1_INPUT = '分析 A 公司最近 30 个交易日的收盘价和成交量，并标出跌幅最大的 3 个交易日。';

export const G1_PATCH: DashboardPatch = {
  op: 'replace_metric',
  from: 'volume',
  to: 'change_pct',
};

// ── G2: 开盘价vs收盘价 + set_time_range ────────────────────────────────────

export const G2_SPEC: DashboardSpec = DS({
  instrument: { symbol: 'MOCK.B', displayName: 'B公司', assetType: 'equity' },
  timeRange: { mode: 'relative', basis: 'trading_day', count: 20, end: MANIFEST.asOf },
  metrics: [
    { id: 'open', label: '开盘价', kind: 'raw', unit: 'CNY' },
    { id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' },
  ],
  transforms: [],
  views: [
    {
      id: 'price_compare',
      title: 'B公司最近20个交易日开盘价与收盘价',
      x: { field: 'date', type: 'ordinal' },
      series: [
        { id: 'open_series', field: 'open', mark: 'line', unit: 'CNY' },
        { id: 'close_series', field: 'close', mark: 'line', unit: 'CNY' },
      ],
      annotations: [],
    },
  ],
  insight: {
    intentSummary: '比较B公司最近20个交易日的开盘价和收盘价走势',
    facts: [],
  },
});

export const G2_INPUT = '比较 B 公司最近 20 个交易日的开盘价和收盘价走势。';

export const G2_PATCH: DashboardPatch = {
  op: 'set_time_range',
  count: 10,
};

// ── G3: 涨跌幅柱状图 + 涨幅最大3天 + set_mark ──────────────────────────────

export const G3_SPEC: DashboardSpec = DS({
  instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
  timeRange: { mode: 'relative', basis: 'trading_day', count: 15, end: MANIFEST.asOf },
  metrics: [
    { id: 'change_pct', label: '涨跌幅', kind: 'derived', unit: '%' },
  ],
  transforms: [
    { id: 'best_3_days', type: 'rank', field: 'change_pct', order: 'desc', limit: 3 },
  ],
  views: [
    {
      id: 'change_bar',
      title: 'A公司最近15个交易日涨跌幅',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 'change_pct_series', field: 'change_pct', mark: 'bar', unit: '%' }],
      annotations: [{ id: 'best_ann', type: 'highlight', transformRef: 'best_3_days', label: '涨幅最大' }],
    },
  ],
  insight: {
    intentSummary: '展示A公司最近15个交易日的涨跌幅',
    facts: [
      { kind: 'rank_summary', metric: 'change_pct', label: '涨幅最大的3天', transformRef: 'best_3_days' },
    ],
  },
});

export const G3_INPUT = '用柱状图展示 A 公司最近 15 个交易日的涨跌幅，并标出涨幅最大的 3 天。';

export const G3_PATCH: DashboardPatch = {
  op: 'set_mark',
  viewId: 'change_bar',
  seriesId: 'change_pct_series',
  mark: 'line',
};

// ── G4: 成交量 + 最高5天 + set_time_range ──────────────────────────────────

export const G4_SPEC: DashboardSpec = DS({
  instrument: { symbol: 'MOCK.B', displayName: 'B公司', assetType: 'equity' },
  timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
  metrics: [
    { id: 'volume', label: '成交量', kind: 'raw', unit: 'share' },
  ],
  transforms: [
    { id: 'top_5_volume', type: 'rank', field: 'volume', order: 'desc', limit: 5 },
  ],
  views: [
    {
      id: 'volume_view',
      title: 'B公司最近30个交易日成交量',
      x: { field: 'date', type: 'ordinal' },
      series: [{ id: 'volume_series', field: 'volume', mark: 'bar', unit: 'share' }],
      annotations: [{ id: 'vol_ann', type: 'highlight', transformRef: 'top_5_volume', label: '成交量最高' }],
    },
  ],
  insight: {
    intentSummary: '查看B公司最近30个交易日的成交量',
    facts: [
      { kind: 'rank_summary', metric: 'volume', label: '成交量最高的5天', transformRef: 'top_5_volume' },
    ],
  },
});

export const G4_INPUT = '查看 B 公司最近 30 个交易日的成交量，并标出成交量最高的 5 天。';

export const G4_PATCH: DashboardPatch = {
  op: 'set_time_range',
  count: 20,
};

// ── G5: 最高价+最低价 + add_metric(close) ──────────────────────────────────

export const G5_SPEC: DashboardSpec = DS({
  instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
  timeRange: { mode: 'relative', basis: 'trading_day', count: 20, end: MANIFEST.asOf },
  metrics: [
    { id: 'high', label: '最高价', kind: 'raw', unit: 'CNY' },
    { id: 'low', label: '最低价', kind: 'raw', unit: 'CNY' },
  ],
  transforms: [],
  views: [
    {
      id: 'hl_view',
      title: 'A公司最近20个交易日最高价和最低价走势',
      x: { field: 'date', type: 'ordinal' },
      series: [
        { id: 'high_series', field: 'high', mark: 'line', unit: 'CNY' },
        { id: 'low_series', field: 'low', mark: 'line', unit: 'CNY' },
      ],
      annotations: [],
    },
  ],
  insight: {
    intentSummary: '分析A公司最近20个交易日的最高价和最低价走势',
    facts: [],
  },
});

export const G5_INPUT = '分析 A 公司最近 20 个交易日的最高价和最低价走势。';

export const G5_PATCH: DashboardPatch = {
  op: 'add_metric',
  metric: 'close',
  viewId: 'hl_view',
};

// ── All golden cases ───────────────────────────────────────────────────────

export interface GoldenCase {
  id: string;
  name: string;
  input: string;
  expectedSpec: DashboardSpec;
  patch?: DashboardPatch;
  patchInput?: string;
}

export const GOLDEN_CASES: GoldenCase[] = [
  { id: 'G1', name: '收盘价+成交量+跌幅排名+替换指标', input: G1_INPUT, expectedSpec: G1_SPEC, patch: G1_PATCH, patchInput: '把成交量改成涨跌幅。' },
  { id: 'G2', name: '多序列比较+修改时间', input: G2_INPUT, expectedSpec: G2_SPEC, patch: G2_PATCH, patchInput: '改为最近 10 个交易日。' },
  { id: 'G3', name: '涨跌幅柱状图+改折线', input: G3_INPUT, expectedSpec: G3_SPEC, patch: G3_PATCH, patchInput: '改成折线图。' },
  { id: 'G4', name: '成交量+最高排名+改时间', input: G4_INPUT, expectedSpec: G4_SPEC, patch: G4_PATCH, patchInput: '改成最近 20 个交易日。' },
  { id: 'G5', name: '最高最低+加收盘价', input: G5_INPUT, expectedSpec: G5_SPEC, patch: G5_PATCH, patchInput: '再加上收盘价。' },
];
