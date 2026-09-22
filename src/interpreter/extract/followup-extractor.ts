/**
 * Follow-up Extractor — extract structured follow-up operations from normalized text.
 */

import { parseNumber } from './number-parser';
import { detectUnsupported } from './initial-extractor';

// ── Draft Follow-up Intent ────────────────────────────────────────────────

export interface DraftReplaceMetric {
  op: 'replace_metric';
  from: string;
  to: string;
}

export interface DraftAddMetric {
  op: 'add_metric';
  metric: string;
}

export interface DraftSetTimeRange {
  op: 'set_time_range';
  count: number;
}

export interface DraftSetMark {
  op: 'set_mark';
  mark: 'line' | 'bar';
  targetMetric?: string;
}

export type DraftFollowUpIntent =
  | DraftReplaceMetric
  | DraftAddMetric
  | DraftSetTimeRange
  | DraftSetMark;

// ── Helpers ───────────────────────────────────────────────────────────────

function extractMark(text: string): 'line' | 'bar' | undefined {
  if (/折线图|折线/.test(text)) return 'line';
  if (/柱状图|柱形图|柱图/.test(text)) return 'bar';
  return undefined;
}

const METRIC_PATTERNS: Array<{ pattern: RegExp; raw: string }> = [
  { pattern: /涨跌幅/, raw: '涨跌幅' },
  { pattern: /成交量/, raw: '成交量' },
  { pattern: /收盘价/, raw: '收盘价' },
  { pattern: /开盘价/, raw: '开盘价' },
  { pattern: /最高价/, raw: '最高价' },
  { pattern: /最低价/, raw: '最低价' },
  { pattern: /收盘/, raw: '收盘价' },
  { pattern: /开盘/, raw: '开盘价' },
  { pattern: /最高/, raw: '最高价' },
  { pattern: /最低/, raw: '最低价' },
];

function extractMetric(text: string): string | undefined {
  for (const { pattern, raw } of METRIC_PATTERNS) {
    if (pattern.test(text)) return raw;
  }
  return undefined;
}

// ── Main Follow-up Extractor ──────────────────────────────────────────────

export function extractFollowUpIntent(text: string): {
  ok: true;
  intent: DraftFollowUpIntent;
} | {
  ok: false;
  code: string;
  details: string;
} {
  const unsupported = detectUnsupported(text);
  if (unsupported) return { ok: false, code: 'UNSUPPORTED_CAPABILITY', details: `detected: ${unsupported}` };

  // Order matters: check specific patterns first, then generic ones.

  // ── 1. set_time_range: "改为最近N天" / "改成最近N个交易日" ──
  // Must check BEFORE replace_metric because "改为最近10天" starts with "改为"
  const timeRangeMatch = text.match(/(?:改为|改成|缩短到|调整为|设为)?\s*(?:最近|近)\s*(\d+|[一二三四五六七八九十]+)\s*(?:个交易日|个?天|日)/);
  if (timeRangeMatch) {
    const count = parseNumber(timeRangeMatch[1]);
    if (count) return { ok: true, intent: { op: 'set_time_range', count } };
  }

  // ── 2. set_mark: "改成折线图" / "把涨跌幅改成柱状图" ──
  // Must check BEFORE replace_metric because "改成折线图" contains "改成"
  const mark = extractMark(text);
  if (mark) {
    const metricMatch = text.match(/(?:把)?(.+?)(?:改为|改成)/);
    const targetMetric = metricMatch ? extractMetric(metricMatch[1].trim()) : undefined;
    return { ok: true, intent: { op: 'set_mark', mark, targetMetric } };
  }

  // ── 3. replace_metric: "把成交量改成涨跌幅" / "成交量改为涨跌幅" / "成交量换成涨跌幅" ──
  const replaceMatch = text.match(/(?:把)?(.+?)(?:改为|改成|换成)(.+?)(?:。|$)/);
  if (replaceMatch) {
    const fromText = replaceMatch[1].trim();
    const toText = replaceMatch[2].trim();
    const fromMetric = extractMetric(fromText);
    const toMetric = extractMetric(toText);
    if (fromMetric && toMetric) {
      return { ok: true, intent: { op: 'replace_metric', from: fromMetric, to: toMetric } };
    }
  }

  // ── 4. add_metric: "再加上收盘价" / "增加开盘价" / "再看看成交量" ──
  const addMatch = text.match(/(?:再加上|增加|再看看|加上|添加)\s*(.+?)(?:。|$)/);
  if (addMatch) {
    const metric = extractMetric(addMatch[1].trim());
    if (metric) return { ok: true, intent: { op: 'add_metric', metric } };
  }

  return { ok: false, code: 'AMBIGUOUS_INPUT', details: '无法识别follow-up操作类型' };
}
