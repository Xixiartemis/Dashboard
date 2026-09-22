/**
 * Pure display formatters for financial numbers.
 * STRICT RULE: Does not re-calculate, re-rank, or alter domain facts.
 */

export function formatMetricValue(value: number, unit?: string): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  // Percentage
  if (unit === '%') {
    const formatted = value.toFixed(2);
    return value > 0 ? `+${formatted}%` : `${formatted}%`;
  }

  // Volume / Share counts
  if (unit === 'share' || unit === '股') {
    const absVal = Math.abs(value);
    if (absVal >= 100_000_000) {
      return `${(value / 100_000_000).toFixed(2)} 亿股`;
    }
    if (absVal >= 10_000) {
      return `${(value / 10_000).toFixed(2)} 万股`;
    }
    return `${value.toLocaleString('zh-CN')} 股`;
  }

  // Currency / Price
  if (unit === 'CNY' || unit === '元') {
    return `¥${value.toFixed(2)}`;
  }

  // Standard numeric fallback
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return `${value.toFixed(2)}${unit ? ` ${unit}` : ''}`;
}

export function formatNumber(value: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return value.toLocaleString('zh-CN');
}

export function formatPercent(value: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const formatted = value.toFixed(2);
  return value > 0 ? `+${formatted}%` : `${formatted}%`;
}

export function formatShortDate(dateStr: string): string {
  // If '2025-12-31' -> '12/31'
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr.slice(5).replace('-', '/');
  }
  return dateStr;
}
