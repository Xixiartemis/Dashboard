/**
 * Initial Extractor — extract structured slots from normalized Chinese text.
 *
 * Output: DraftInitialIntent (allows raw Chinese strings, not yet canonicalized).
 * The Resolver will map these to canonical IDs.
 */

import { parseNumber } from './number-parser';

// ── Draft Intent Types ────────────────────────────────────────────────────

export interface DraftRanking {
  metric: string;
  order: 'asc' | 'desc';
  limit: number;
}

export interface DraftInitialIntent {
  instrument?: string;
  displayMetrics: string[];
  timeRange?: { count: number };
  preferredMark?: 'line' | 'bar';
  rankings?: DraftRanking[];
}

// ── Unsupported Capability Detection ──────────────────────────────────────

const UNSUPPORTED_PATTERNS = [
  /预测/, /买入/, /卖出/, /建议/, /新闻/, /财报/,
  /情绪/, /K线/, /MACD/, /RSI/, /市盈率/, /PE/,
  /止损/, /收益/, /盈利/, /亏损/,
];

export function detectUnsupported(text: string): string | null {
  for (const pattern of UNSUPPORTED_PATTERNS) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}

export function detectNaturalDayConflict(text: string): boolean {
  return /自然日/.test(text);
}

// ── Instrument Extraction ─────────────────────────────────────────────────

export function extractInstrument(text: string): string | undefined {
  const companyMatch = text.match(/([A-Z])\s*公司/);
  if (companyMatch) return `${companyMatch[1]}公司`;
  const mockMatch = text.match(/MOCK\.[A-Z]/);
  if (mockMatch) return mockMatch[0];
  return undefined;
}

// ── Metric Extraction ─────────────────────────────────────────────────────

// NO global flag — each pattern is tested once per call.
const METRIC_PATTERNS: Array<{ pattern: RegExp; raw: string }> = [
  { pattern: /涨跌幅/, raw: '涨跌幅' },
  { pattern: /成交量/, raw: '成交量' },
  { pattern: /交易量/, raw: '成交量' },
  { pattern: /收盘价/, raw: '收盘价' },
  { pattern: /开盘价/, raw: '开盘价' },
  { pattern: /最高价/, raw: '最高价' },
  { pattern: /最低价/, raw: '最低价' },
  { pattern: /收盘/, raw: '收盘价' },
  { pattern: /开盘/, raw: '开盘价' },
  { pattern: /最高/, raw: '最高价' },
  { pattern: /最低/, raw: '最低价' },
];

export function extractMetrics(text: string): string[] {
  // First, identify ranking phrase spans to exclude from metric extraction
  const rankingSpans: Array<{ start: number; end: number }> = [];
  for (const { re } of RANKING_PATTERNS) {
    const match = re.exec(text);
    if (match) {
      rankingSpans.push({ start: match.index, end: match.index + match[0].length });
    }
  }

  // Find metric mentions, excluding those inside ranking phrases
  const found: Array<{ raw: string; pos: number }> = [];
  const seen = new Set<string>();

  for (const { pattern, raw } of METRIC_PATTERNS) {
    if (!seen.has(raw)) {
      const match = pattern.exec(text);
      if (match) {
        const pos = match.index;
        // Check if this match is inside a ranking phrase
        const inRanking = rankingSpans.some((s) => pos >= s.start && pos < s.end);
        if (!inRanking) {
          found.push({ raw, pos });
          seen.add(raw);
        }
      }
    }
  }

  // Sort by position in text (order of appearance)
  found.sort((a, b) => a.pos - b.pos);
  return found.map((f) => f.raw);
}

// ── Time Range Extraction ─────────────────────────────────────────────────

export function extractTimeRange(text: string): number | undefined {
  // Pattern: (最近|近)(N)(个交易日|天|日)
  const match = text.match(/(?:最近|近)\s*(\d+|[一二三四五六七八九十两二十]+)\s*(?:个交易日|个?天|日)/);
  if (match) return parseNumber(match[1]);

  const match2 = text.match(/(\d+|[一二三四五六七八九十两二十]+)\s*个交易日/);
  if (match2) return parseNumber(match2[1]);

  return undefined;
}

// ── Mark Extraction ───────────────────────────────────────────────────────

export function extractMark(text: string): 'line' | 'bar' | undefined {
  if (/折线图|折线/.test(text)) return 'line';
  if (/柱状图|柱形图|柱图/.test(text)) return 'bar';
  return undefined;
}

// ── Ranking Extraction ────────────────────────────────────────────────────

const RANKING_PATTERNS: Array<{ re: RegExp; metric: string; order: 'asc' | 'desc'; group: number }> = [
  // Pattern: keyword + magnitude(最大/最高) + 的 + N + time_unit
  // Restriction: only punctuation/whitespace between keyword and magnitude (no CJK text)
  { re: /涨幅[\s，。、]*(?:最大|最高|涨得最厉害)的\s*(\d+|[一二三四五六七八九十]+)\s*(?:个交易日|个?天|日)/, metric: '涨跌幅', order: 'desc', group: 1 },
  { re: /跌幅[\s，。、]*(?:最大|最高|跌得最厉害)的\s*(\d+|[一二三四五六七八九十]+)\s*(?:个交易日|个?天|日)/, metric: '涨跌幅', order: 'asc', group: 1 },
  { re: /成交量[\s，。、]*(?:最大|最高)的\s*(\d+|[一二三四五六七八九十]+)\s*(?:个交易日|个?天|日)/, metric: '成交量', order: 'desc', group: 1 },
  { re: /成交量[\s，。、]*最低的\s*(\d+|[一二三四五六七八九十]+)\s*(?:个交易日|个?天|日)/, metric: '成交量', order: 'asc', group: 1 },
  // Standalone "涨得最厉害" / "跌得最厉害" without "涨幅/跌幅" prefix
  { re: /涨得最厉害的\s*(\d+|[一二三四五六七八九十]+)\s*(?:个交易日|个?天|日)/, metric: '涨跌幅', order: 'desc', group: 1 },
  { re: /跌得最厉害的\s*(\d+|[一二三四五六七八九十]+)\s*(?:个交易日|个?天|日)/, metric: '涨跌幅', order: 'asc', group: 1 },
  // 涨幅前N / 跌幅前N / 成交量前N
  { re: /涨幅前\s*(\d+|[一二三四五六七八九十]+)/, metric: '涨跌幅', order: 'desc', group: 1 },
  { re: /跌幅前\s*(\d+|[一二三四五六七八九十]+)/, metric: '涨跌幅', order: 'asc', group: 1 },
  { re: /成交量前\s*(\d+|[一二三四五六七八九十]+)/, metric: '成交量', order: 'desc', group: 1 },
];

export function extractRankings(text: string): DraftRanking[] {
  const rankings: DraftRanking[] = [];
  const seen = new Set<string>();

  for (const { re, metric, order, group } of RANKING_PATTERNS) {
    const match = re.exec(text);
    if (match) {
      const limit = parseNumber(match[group]);
      if (limit && limit > 0) {
        const key = `${metric}:${order}:${limit}`;
        if (!seen.has(key)) {
          seen.add(key);
          rankings.push({ metric, order, limit });
        }
      }
    }
  }
  return rankings;
}

// ── Main Extractor ────────────────────────────────────────────────────────

export function extractInitialIntent(text: string): {
  ok: true;
  intent: DraftInitialIntent;
} | {
  ok: false;
  code: string;
  details: string;
} {
  const unsupported = detectUnsupported(text);
  if (unsupported) return { ok: false, code: 'UNSUPPORTED_CAPABILITY', details: `detected: ${unsupported}` };

  if (detectNaturalDayConflict(text)) {
    return { ok: false, code: 'UNSUPPORTED_CAPABILITY', details: '自然日不支持，当前仅支持交易日' };
  }

  const instrument = extractInstrument(text);
  const displayMetrics = extractMetrics(text);
  const timeRangeCount = extractTimeRange(text);
  const mark = extractMark(text);
  const rankings = extractRankings(text);

  const intent: DraftInitialIntent = { displayMetrics };
  if (instrument) intent.instrument = instrument;
  if (timeRangeCount) intent.timeRange = { count: timeRangeCount };
  if (mark) intent.preferredMark = mark;
  if (rankings.length > 0) intent.rankings = rankings;

  return { ok: true, intent };
}
