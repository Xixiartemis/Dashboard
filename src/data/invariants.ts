/**
 * Dataset Invariants — deterministic validation of raw stock data.
 *
 * Every invariant here is a hard assertion. If any fails, the dataset is corrupted.
 */

import type { RawStockRecord } from './mock-dataset';
import { MANIFEST } from './manifest';

export interface InvariantViolation {
  rule: string;
  details: string;
}

export function validateDataset(
  records: readonly RawStockRecord[],
  symbol: string,
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const tag = (rule: string) => `[${symbol}] ${rule}`;

  if (records.length === 0) {
    violations.push({ rule: tag('NON_EMPTY'), details: 'Dataset is empty' });
    return violations;
  }

  // Date uniqueness
  const dates = new Set<string>();
  for (const r of records) {
    if (dates.has(r.date)) {
      violations.push({ rule: tag('DATE_UNIQUE'), details: `Duplicate date: ${r.date}` });
    }
    dates.add(r.date);
  }

  // Date strict ascending
  for (let i = 1; i < records.length; i++) {
    if (records[i].date <= records[i - 1].date) {
      violations.push({
        rule: tag('DATE_ASCENDING'),
        details: `Dates not ascending at index ${i}: ${records[i - 1].date} → ${records[i].date}`,
      });
    }
  }

  // Numeric validity and OHLC constraints
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const prefix = `index=${i} date=${r.date}`;

    for (const field of ['open', 'high', 'low', 'close', 'volume'] as const) {
      if (!Number.isFinite(r[field])) {
        violations.push({ rule: tag('FINITE_NUMBER'), details: `${prefix} ${field}=${r[field]} is not finite` });
      }
    }

    if (r.open <= 0) violations.push({ rule: tag('OPEN_POSITIVE'), details: `${prefix} open=${r.open}` });
    if (r.high <= 0) violations.push({ rule: tag('HIGH_POSITIVE'), details: `${prefix} high=${r.high}` });
    if (r.low <= 0) violations.push({ rule: tag('LOW_POSITIVE'), details: `${prefix} low=${r.low}` });
    if (r.close <= 0) violations.push({ rule: tag('CLOSE_POSITIVE'), details: `${prefix} close=${r.close}` });
    if (r.volume < 0) violations.push({ rule: tag('VOLUME_NON_NEGATIVE'), details: `${prefix} volume=${r.volume}` });

    if (r.high < r.open) violations.push({ rule: tag('HIGH_GE_OPEN'), details: `${prefix} high=${r.high} < open=${r.open}` });
    if (r.high < r.close) violations.push({ rule: tag('HIGH_GE_CLOSE'), details: `${prefix} high=${r.high} < close=${r.close}` });
    if (r.low > r.open) violations.push({ rule: tag('LOW_LE_OPEN'), details: `${prefix} low=${r.low} > open=${r.open}` });
    if (r.low > r.close) violations.push({ rule: tag('LOW_LE_CLOSE'), details: `${prefix} low=${r.low} > close=${r.close}` });
    if (r.high < r.low) violations.push({ rule: tag('HIGH_GE_LOW'), details: `${prefix} high=${r.high} < low=${r.low}` });
  }

  // Coverage: must have at least enough days for max query (60) + lookback (1)
  const minRequired = 61;
  if (records.length < minRequired) {
    violations.push({
      rule: tag('COVERAGE'),
      details: `Only ${records.length} records, need at least ${minRequired}`,
    });
  }

  // asOf consistency
  const lastDate = records[records.length - 1].date;
  if (lastDate !== MANIFEST.asOf) {
    violations.push({
      rule: tag('ASOF_CONSISTENCY'),
      details: `Last date ${lastDate} !== manifest.asOf ${MANIFEST.asOf}`,
    });
  }

  return violations;
}

/** Assert all datasets pass invariants. Throws on failure. */
export function assertAllDatasetsValid(
  datasets: Record<string, readonly RawStockRecord[]>,
): void {
  const allViolations: InvariantViolation[] = [];
  for (const [symbol, records] of Object.entries(datasets)) {
    allViolations.push(...validateDataset(records, symbol));
  }
  if (allViolations.length > 0) {
    const msg = allViolations.map((v) => `${v.rule}: ${v.details}`).join('\n');
    throw new Error(`Dataset invariant violations:\n${msg}`);
  }
}
