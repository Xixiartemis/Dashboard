/**
 * Metric Resolver — maps natural-language metric references to canonical IDs.
 *
 * Uses the frozen Metric Registry as the single source of truth for metric metadata.
 * This module only handles the "name → ID" mapping, not the metadata itself.
 *
 * Interpreter-specific aliases (Chinese labels, abbreviations, synonyms) live here
 * as a thin mapping layer. They point to Registry IDs — they don't carry metadata.
 */

import { isKnownMetric } from '../../registries/metrics';
import { makeInterpreterError, type InterpreterError } from '../errors';

// ── Interpreter Alias Mapping ─────────────────────────────────────────────
// Maps natural-language references → canonical metric IDs.
// These are language-level aliases, NOT a second Registry.

const METRIC_ALIASES: Record<string, string> = {
  // 收盘价
  '收盘价': 'close',
  '收盘': 'close',
  'closing': 'close',
  'close': 'close',

  // 开盘价
  '开盘价': 'open',
  '开盘': 'open',
  'opening': 'open',
  'open': 'open',

  // 最高价
  '最高价': 'high',
  '最高': 'high',
  'high': 'high',

  // 最低价
  '最低价': 'low',
  '最低': 'low',
  'low': 'low',

  // 成交量
  '成交量': 'volume',
  '交易量': 'volume',
  '量': 'volume',
  'volume': 'volume',

  // 涨跌幅
  '涨跌幅': 'change_pct',
  '涨跌': 'change_pct',
  '涨跌幅变化': 'change_pct',
  'change_pct': 'change_pct',
};

export interface MetricResolution {
  ok: true;
  metricId: string;
}

export interface MetricResolutionFailure {
  ok: false;
  error: InterpreterError;
}

export type MetricResolutionResult = MetricResolution | MetricResolutionFailure;

/**
 * Resolve a natural-language metric reference to a canonical metric ID.
 *
 * @param input - e.g. '收盘价', '成交量', 'close', 'change_pct'
 */
export function resolveMetricId(input: string): MetricResolutionResult {
  const trimmed = input.trim();
  const canonicalId = METRIC_ALIASES[trimmed] ?? METRIC_ALIASES[trimmed.toLowerCase()];

  if (!canonicalId) {
    // Try direct Registry lookup
    if (isKnownMetric(trimmed)) {
      return { ok: true, metricId: trimmed };
    }
    return {
      ok: false,
      error: makeInterpreterError('UNKNOWN_METRIC', `input="${input}"`),
    };
  }

  // Double-check the resolved ID exists in Registry
  if (!isKnownMetric(canonicalId)) {
    return {
      ok: false,
      error: makeInterpreterError('UNKNOWN_METRIC', `resolved="${canonicalId}" not in Registry`),
    };
  }

  return { ok: true, metricId: canonicalId };
}

/**
 * Resolve multiple metric references at once.
 * Returns all successes or the first failure.
 */
export function resolveMetricIds(inputs: string[]): {
  ok: true;
  metricIds: string[];
} | {
  ok: false;
  error: InterpreterError;
} {
  const ids: string[] = [];
  for (const input of inputs) {
    const result = resolveMetricId(input);
    if (!result.ok) return result;
    ids.push(result.metricId);
  }
  return { ok: true, metricIds: ids };
}

/** Get the alias mapping for external use (e.g. tests, docs). */
export function getMetricAliases(): Record<string, string> {
  return { ...METRIC_ALIASES };
}
