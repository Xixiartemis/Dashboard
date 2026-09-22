/**
 * Negative Cases — 9 cases that must all be rejected.
 */

import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import type { ErrorCode } from '../validation/errors';
import { MANIFEST } from '../data/manifest';

export interface NegativeCase {
  id: string;
  name: string;
  errorCode: ErrorCode;
  rawInput?: unknown;
  spec?: DashboardSpec;
  patch?: { spec: DashboardSpec; patch: DashboardPatch };
}

const BASE_SPEC: Omit<DashboardSpec, 'schemaVersion' | 'dataSource'> = {
  instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
  timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
  metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
  transforms: [],
  views: [{
    id: 'v1',
    title: 'Test',
    x: { field: 'date', type: 'ordinal' },
    series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
    annotations: [],
  }],
  insight: { intentSummary: 'test', facts: [] },
};

function makeSpec(overrides: Partial<DashboardSpec> = {}): DashboardSpec {
  return {
    schemaVersion: '1.0.0',
    dataSource: {
      preference: 'embedded_mock',
      resolved: 'embedded_mock',
      datasetId: MANIFEST.datasetId,
      asOf: MANIFEST.asOf,
      timezone: MANIFEST.timezone,
      priceAdjustment: 'raw',
    },
    ...BASE_SPEC,
    ...overrides,
  } as DashboardSpec;
}

export const NEGATIVE_CASES: NegativeCase[] = [
  // N1: Unknown instrument
  {
    id: 'N1',
    name: '未知股票',
    errorCode: 'UNKNOWN_INSTRUMENT',
    spec: makeSpec({ instrument: { symbol: 'UNKNOWN.X', displayName: '未知', assetType: 'equity' } }),
  },

  // N2: Unsupported metric
  {
    id: 'N2',
    name: '不支持的指标',
    errorCode: 'UNSUPPORTED_METRIC',
    spec: makeSpec({
      metrics: [{ id: 'pe_ratio', label: '市盈率', kind: 'raw', unit: 'CNY' }],
    }),
  },

  // N3: Invalid time range (0 days)
  {
    id: 'N3',
    name: '零天交易日范围',
    errorCode: 'INVALID_TIME_RANGE',
    rawInput: {
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 0, end: MANIFEST.asOf },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    },
  },

  // N4: Unsupported mark (structural)
  {
    id: 'N4',
    name: '不支持的图表类型',
    errorCode: 'INVALID_ENUM',
    rawInput: {
      schemaVersion: '1.0.0',
      instrument: { symbol: 'MOCK.A', displayName: 'A公司', assetType: 'equity' },
      timeRange: { mode: 'relative', basis: 'trading_day', count: 30, end: MANIFEST.asOf },
      metrics: [{ id: 'close', label: '收盘价', kind: 'raw', unit: 'CNY' }],
      dataSource: { preference: 'embedded_mock', resolved: 'embedded_mock', datasetId: MANIFEST.datasetId, asOf: MANIFEST.asOf, timezone: MANIFEST.timezone, priceAdjustment: 'raw' },
      transforms: [],
      views: [{ id: 'v1', title: 'T', x: { field: 'date', type: 'ordinal' }, series: [{ id: 's1', field: 'close', mark: 'pie', unit: 'CNY' }], annotations: [] }],
      insight: { intentSummary: 't', facts: [] },
    },
  },

  // N5: Series references non-existent metric
  {
    id: 'N5',
    name: 'series引用不存在的metric',
    errorCode: 'MISSING_SERIES_FIELD',
    spec: makeSpec({
      views: [{
        id: 'v1',
        title: 'Test',
        x: { field: 'date', type: 'ordinal' },
        series: [{ id: 's1', field: 'pe_ratio', mark: 'line', unit: 'CNY' }],
        annotations: [],
      }],
    }),
  },

  // N6: Annotation references non-existent transform
  {
    id: 'N6',
    name: 'annotation引用不存在的transform',
    errorCode: 'MISSING_TRANSFORM_REF',
    spec: makeSpec({
      views: [{
        id: 'v1',
        title: 'Test',
        x: { field: 'date', type: 'ordinal' },
        series: [{ id: 's1', field: 'close', mark: 'line', unit: 'CNY' }],
        annotations: [{ id: 'a1', type: 'highlight', transformRef: 'nonexistent', label: 'test' }],
      }],
    }),
  },

  // N7: Time range exceeds data capability
  {
    id: 'N7',
    name: '时间范围超出数据能力',
    errorCode: 'TIME_RANGE_EXCEEDS_DATA',
    spec: makeSpec({
      timeRange: { mode: 'relative', basis: 'trading_day', count: 100, end: MANIFEST.asOf },
    }),
  },

  // N8: Illegal patch — replace non-existent metric
  {
    id: 'N8',
    name: '非法Patch：替换不存在的指标',
    errorCode: 'PATCH_TARGET_NOT_FOUND',
    patch: {
      spec: makeSpec(),
      patch: { op: 'replace_metric', from: 'pe_ratio', to: 'volume' },
    },
  },

  // N9: add_metric to non-existent view
  {
    id: 'N9',
    name: 'Patch后生成非法Schema',
    errorCode: 'PATCH_TARGET_NOT_FOUND',
    patch: {
      spec: makeSpec(),
      patch: { op: 'add_metric', metric: 'close', viewId: 'nonexistent_view' },
    },
  },
];
