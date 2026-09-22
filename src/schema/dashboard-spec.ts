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

export const DataSourceSchema = z
  .object({
    preference: z.enum(['embedded_mock', 'wencai', 'auto']),
    resolved: z.enum(['embedded_mock', 'wencai']),
    datasetId: z.string(),
    asOf: z.string(),
    timezone: z.string(),
    priceAdjustment: z.enum(['raw', 'adjusted']),
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

// ── Axis ───────────────────────────────────────────────────────────────────

export const AxisSchema = z
  .object({
    field: z.string(),
    type: z.enum(['ordinal', 'linear']),
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

export const InsightFactKindSchema = z.enum([
  'period_change',
  'worst_days',
  'best_days',
  'max_volume_days',
  'min_volume_days',
]);

export const InsightFactSchema = z
  .object({
    kind: InsightFactKindSchema,
    metric: z.string(),
    label: z.string(),
  })
  .strict();
export type InsightFact = z.infer<typeof InsightFactSchema>;

export const InsightSchema = z
  .object({
    summary: z.string(),
    facts: z.array(InsightFactSchema),
  })
  .strict();
export type Insight = z.infer<typeof InsightSchema>;

// ── DashboardSpec (top-level) ──────────────────────────────────────────────

export const DashboardSpecSchema = z
  .object({
    schemaVersion: z.string(),
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

// ── JSON Schema export ─────────────────────────────────────────────────────

export function getDashboardSpecJsonSchema() {
  // Use zod-to-json-schema if available, otherwise manual
  // For now, return a manual representation that captures the structure
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'DashboardSpec',
    description: 'Structured stock analysis dashboard specification',
    type: 'object',
    required: [
      'schemaVersion', 'instrument', 'timeRange', 'metrics',
      'dataSource', 'transforms', 'views', 'insight',
    ],
    additionalProperties: false,
    properties: {
      schemaVersion: { type: 'string' },
      instrument: {
        type: 'object',
        required: ['symbol', 'displayName', 'assetType'],
        additionalProperties: false,
        properties: {
          symbol: { type: 'string' },
          displayName: { type: 'string' },
          assetType: { type: 'string', enum: ['equity', 'etf', 'index', 'bond', 'crypto'] },
        },
      },
      timeRange: {
        type: 'object',
        required: ['mode', 'basis', 'count', 'end'],
        additionalProperties: false,
        properties: {
          mode: { type: 'string', enum: ['relative'] },
          basis: { type: 'string', enum: ['trading_day'] },
          count: { type: 'integer', minimum: 1, maximum: 60 },
          end: { type: 'string' },
        },
      },
      metrics: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'label', 'kind', 'unit'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            label: { type: 'string' },
            kind: { type: 'string', enum: ['raw', 'derived'] },
            unit: { type: 'string', enum: ['CNY', 'share', '%'] },
          },
        },
      },
      dataSource: {
        type: 'object',
        required: ['preference', 'resolved', 'datasetId', 'asOf', 'timezone', 'priceAdjustment'],
        additionalProperties: false,
        properties: {
          preference: { type: 'string', enum: ['embedded_mock', 'wencai', 'auto'] },
          resolved: { type: 'string', enum: ['embedded_mock', 'wencai'] },
          datasetId: { type: 'string' },
          asOf: { type: 'string' },
          timezone: { type: 'string' },
          priceAdjustment: { type: 'string', enum: ['raw', 'adjusted'] },
        },
      },
      transforms: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'type', 'field', 'order', 'limit'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['rank'] },
            field: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] },
            limit: { type: 'integer', minimum: 1 },
          },
        },
      },
      views: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['id', 'title', 'x', 'series', 'annotations'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            x: {
              type: 'object',
              required: ['field', 'type'],
              additionalProperties: false,
              properties: {
                field: { type: 'string' },
                type: { type: 'string', enum: ['ordinal', 'linear'] },
              },
            },
            series: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['id', 'field', 'mark', 'unit'],
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  field: { type: 'string' },
                  mark: { type: 'string', enum: ['line', 'bar'] },
                  unit: { type: 'string', enum: ['CNY', 'share', '%'] },
                },
              },
            },
            annotations: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'type', 'transformRef', 'label'],
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string', enum: ['highlight'] },
                  transformRef: { type: 'string' },
                  label: { type: 'string' },
                },
              },
            },
          },
        },
      },
      insight: {
        type: 'object',
        required: ['summary', 'facts'],
        additionalProperties: false,
        properties: {
          summary: { type: 'string' },
          facts: {
            type: 'array',
            items: {
              type: 'object',
              required: ['kind', 'metric', 'label'],
              additionalProperties: false,
              properties: {
                kind: { type: 'string', enum: ['period_change', 'worst_days', 'best_days', 'max_volume_days', 'min_volume_days'] },
                metric: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}
