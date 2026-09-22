/**
 * Metric Registry — single source of truth for all metric definitions.
 *
 * Invariants:
 * - Every metric referenced in DashboardSpec.metrics MUST exist here.
 * - kind = 'raw' means directly available in the dataset.
 * - kind = 'derived' means computed from raw data.
 * - supportedMarks constrains which visual marks a metric can use.
 * - unit is authoritative; no other module may hardcode units.
 */

export type MetricKind = 'raw' | 'derived';
export type MetricUnit = 'CNY' | 'share' | '%';
export type MarkType = 'line' | 'bar';

export interface MetricEntry {
  id: string;
  label: string;           // 中文名称
  kind: MetricKind;
  unit: MetricUnit;
  supportedMarks: MarkType[];
  description?: string;
}

const METRICS: readonly MetricEntry[] = [
  {
    id: 'open',
    label: '开盘价',
    kind: 'raw',
    unit: 'CNY',
    supportedMarks: ['line', 'bar'],
    description: '当日第一笔成交价格',
  },
  {
    id: 'high',
    label: '最高价',
    kind: 'raw',
    unit: 'CNY',
    supportedMarks: ['line', 'bar'],
    description: '当日成交最高价格',
  },
  {
    id: 'low',
    label: '最低价',
    kind: 'raw',
    unit: 'CNY',
    supportedMarks: ['line', 'bar'],
    description: '当日成交最低价格',
  },
  {
    id: 'close',
    label: '收盘价',
    kind: 'raw',
    unit: 'CNY',
    supportedMarks: ['line', 'bar'],
    description: '当日最后一笔成交价格',
  },
  {
    id: 'volume',
    label: '成交量',
    kind: 'raw',
    unit: 'share',
    supportedMarks: ['line', 'bar'],
    description: '当日成交股数',
  },
  {
    id: 'change_pct',
    label: '涨跌幅',
    kind: 'derived',
    unit: '%',
    supportedMarks: ['line', 'bar'],
    description: '相对前一交易日收盘价的百分比变化',
  },
] as const;

const metricMap = new Map<string, MetricEntry>(
  METRICS.map((m) => [m.id, m]),
);

/** Get metric definition by id. Returns undefined if not found. */
export function getMetric(id: string): MetricEntry | undefined {
  return metricMap.get(id);
}

/** Check if a metric id exists in the registry. */
export function isKnownMetric(id: string): boolean {
  return metricMap.has(id);
}

/** Check if a metric supports a given mark type. */
export function metricSupportsMark(metricId: string, mark: MarkType): boolean {
  const entry = metricMap.get(metricId);
  return entry?.supportedMarks.includes(mark) ?? false;
}

/** List all metrics (read-only). */
export function listMetrics(): readonly MetricEntry[] {
  return METRICS;
}

/** List raw metric ids only. */
export function rawMetricIds(): string[] {
  return METRICS.filter((m) => m.kind === 'raw').map((m) => m.id);
}

/** List derived metric ids only. */
export function derivedMetricIds(): string[] {
  return METRICS.filter((m) => m.kind === 'derived').map((m) => m.id);
}
