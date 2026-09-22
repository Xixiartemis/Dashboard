/**
 * DashboardSpec — Zod strict schema, single source of truth.
 *
 * This is the central data contract. All validation, rendering, and analytics
 * derive from this schema. TypeScript types are inferred from it.
 *
 * Key design decisions:
 * - metrics = analysis dependencies (may include metrics not directly shown)
 * - views[].series[] = what's actually rendered
 * - strict mode: unknown properties are rejected
 * - schemaVersion = literal '1.0.0' (frozen)
 * - x-axis locked to date/ordinal (v1 only)
 * - insight.intentSummary = user intent, NOT computed result
 */

import { z } from 'zod';

// ── Enums ──────────────────────────────────────────────────────────────────

export const MarkSchema = z.enum(['line', 'bar']);
export type Mark = z.infer<typeof MarkSchema>;

export const TimeRangeModeSchema = z.enum(['relative']);
export const TimeRangeBasisSchema = z.enum(['trading_day']);

// ── TimeRange ──────────────────────────────────────────────────────────────

export const TimeRangeSchema = z
  .object({
    mode: TimeRangeModeSchema,
    basis: TimeRangeBasisSchema,
    count: z.number().int().min(1).max(60),
    end: z.string(), // resolved to manifest.asOf at validation time
  })
  .strict();
export type TimeRange = z.infer<typeof TimeRangeSchema>;

// ── Instrument ─────────────────────────────────────────────────────────────

export const InstrumentSpecSchema = z
  .object({
    symbol: z.string(),
    displayName: z.string(),
    assetType: z.enum(['equity', 'etf', 'index', 'bond', 'crypto']),
  })
  .strict();
export type InstrumentSpec = z.infer<typeof InstrumentSpecSchema>;

// ── DataSource ─────────────────────────────────────────────────────────────
// v1: resolved only allows 'embedded_mock' until WenCai provider is integrated.
// Semantic validator checks datasetId/asOf/timezone/priceAdjustment match MANIFEST.

export const DataSourceSchema = z
  .object({
    preference: z.enum(['embedded_mock', 'wencai', 'auto']),
    resolved: z.literal('embedded_mock'),
    datasetId: z.string(),
    asOf: z.string(),
    timezone: z.string(),
    priceAdjustment: z.literal('raw'),
  })
  .strict();
export type DataSource = z.infer<typeof DataSourceSchema>;

// ── MetricRef ──────────────────────────────────────────────────────────────

export const MetricRefSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    kind: z.enum(['raw', 'derived']),
    unit: z.enum(['CNY', 'share', '%']),
  })
  .strict();
export type MetricRef = z.infer<typeof MetricRefSchema>;

// ── Transform ──────────────────────────────────────────────────────────────

export const TransformSchema = z
  .object({
    id: z.string(),
    type: z.literal('rank'),
    field: z.string(),
    order: z.enum(['asc', 'desc']),
    limit: z.number().int().min(1),
  })
  .strict();
export type Transform = z.infer<typeof TransformSchema>;

// ── Series ─────────────────────────────────────────────────────────────────

export const SeriesSchema = z
  .object({
    id: z.string(),
    field: z.string(),
    mark: MarkSchema,
    unit: z.enum(['CNY', 'share', '%']),
  })
  .strict();
export type Series = z.infer<typeof SeriesSchema>;

// ── Axis (locked to date/ordinal for v1) ───────────────────────────────────

export const AxisSchema = z
  .object({
    field: z.literal('date'),
    type: z.literal('ordinal'),
  })
  .strict();
export type Axis = z.infer<typeof AxisSchema>;

// ── Annotation ─────────────────────────────────────────────────────────────

export const AnnotationSchema = z
  .object({
    id: z.string(),
    type: z.literal('highlight'),
    transformRef: z.string(),
    label: z.string(),
  })
  .strict();
export type Annotation = z.infer<typeof AnnotationSchema>;

// ── View ───────────────────────────────────────────────────────────────────

export const ViewSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    x: AxisSchema,
    series: z.array(SeriesSchema).min(1),
    annotations: z.array(AnnotationSchema),
  })
  .strict();
export type View = z.infer<typeof ViewSchema>;

// ── Insight ────────────────────────────────────────────────────────────────
// v1: removed min_volume_days (no implementation)
// v1: ranking facts reference transforms via transformRef (single source of truth)

export const InsightFactKindSchema = z.enum([
  'period_change',
  'rank_summary',    // replaces worst_days/best_days/max_volume_days — references transform
]);

export const InsightFactSchema = z
  .object({
    kind: InsightFactKindSchema,
    metric: z.string(),
    label: z.string(),
    transformRef: z.string().optional(), // required for rank_summary
  })
  .strict();
export type InsightFact = z.infer<typeof InsightFactSchema>;

export const InsightSchema = z
  .object({
    intentSummary: z.string(), // user intent, NOT computed result
    facts: z.array(InsightFactSchema),
  })
  .strict();
export type Insight = z.infer<typeof InsightSchema>;

// ── DashboardSpec (top-level) ──────────────────────────────────────────────

export const DashboardSpecSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    instrument: InstrumentSpecSchema,
    timeRange: TimeRangeSchema,
    metrics: z.array(MetricRefSchema).min(1),
    dataSource: DataSourceSchema,
    transforms: z.array(TransformSchema),
    views: z.array(ViewSchema).min(1),
    insight: InsightSchema,
  })
  .strict();

export type DashboardSpec = z.infer<typeof DashboardSpecSchema>;

// ── Safe parse ─────────────────────────────────────────────────────────────

export function parseDashboardSpec(input: unknown) {
  return DashboardSpecSchema.safeParse(input);
}

// ── JSON Schema export (derived from Zod, single source of truth) ─────────

export function getDashboardSpecJsonSchema() {
  // Zod v4 supports .jsonSchema() on schemas
  try {
    const jsonSchema = (DashboardSpecSchema as any).jsonSchema?.();
    if (jsonSchema) {
      return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'DashboardSpec',
        description: 'Structured stock analysis dashboard specification v1.0.0',
        ...jsonSchema,
      };
    }
  } catch {
    // fallback if jsonSchema not available
  }
  // Minimal fallback: we still have Zod as the real validator
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'DashboardSpec',
    description: 'Structured stock analysis dashboard specification v1.0.0',
    note: 'Zod schema is the source of truth. This JSON Schema is informational only.',
    _sourceOfTruth: 'DashboardSpecSchema (Zod)',
  };
}
