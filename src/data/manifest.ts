/**
 * Dataset Manifest — metadata for the embedded mock dataset.
 *
 * Invariant: manifest.asOf === last trading day in the canonical dataset.
 * This value is static and must not depend on runtime date.
 *
 * calendar = MOCK_WEEKDAY: excludes weekends only, does NOT model
 * Chinese public holidays or SSE closures. For deterministic demo use only.
 */

export interface DatasetManifest {
  datasetId: string;
  schemaVersion: string;
  asOf: string;           // YYYY-MM-DD, last trading day
  timezone: string;
  calendar: string;
  currency: string;
  volumeUnit: string;
  priceAdjustment: string;
  tradingDaysPerInstrument: number;
}

export const MANIFEST: DatasetManifest = {
  datasetId: 'mock-embedded-v1',
  schemaVersion: '1.0.0',
  asOf: '2025-12-31',
  timezone: 'Asia/Shanghai',
  calendar: 'MOCK_WEEKDAY',  // weekdays only, not real SSE calendar
  currency: 'CNY',
  volumeUnit: 'share',
  priceAdjustment: 'raw',    // no dividend/split adjustment
  tradingDaysPerInstrument: 80,
};
