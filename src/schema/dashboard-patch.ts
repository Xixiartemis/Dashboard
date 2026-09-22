/**
 * DashboardPatch — domain-specific patch operations for follow-up queries.
 *
 * NOT RFC 6902. These are semantic patch operations that preserve business
 * invariants. Each patch is validated before application, and the resulting
 * DashboardSpec is re-validated after application.
 */

import { z } from 'zod';
import { MarkSchema } from './dashboard-spec';

// ── ReplaceMetricPatch ─────────────────────────────────────────────────────

export const ReplaceMetricPatchSchema = z
  .object({
    op: z.literal('replace_metric'),
    from: z.string(),  // existing metric id in current spec
    to: z.string(),    // new metric id from registry
  })
  .strict();
export type ReplaceMetricPatch = z.infer<typeof ReplaceMetricPatchSchema>;

// ── AddMetricPatch ─────────────────────────────────────────────────────────

export const AddMetricPatchSchema = z
  .object({
    op: z.literal('add_metric'),
    metric: z.string(),     // metric id to add
    viewId: z.string(),     // target view to add series to
  })
  .strict();
export type AddMetricPatch = z.infer<typeof AddMetricPatchSchema>;

// ── SetTimeRangePatch ──────────────────────────────────────────────────────

export const SetTimeRangePatchSchema = z
  .object({
    op: z.literal('set_time_range'),
    count: z.number().int().min(1).max(60),
  })
  .strict();
export type SetTimeRangePatch = z.infer<typeof SetTimeRangePatchSchema>;

// ── SetMarkPatch ───────────────────────────────────────────────────────────

export const SetMarkPatchSchema = z
  .object({
    op: z.literal('set_mark'),
    viewId: z.string(),
    seriesId: z.string(),
    mark: MarkSchema,
  })
  .strict();
export type SetMarkPatch = z.infer<typeof SetMarkPatchSchema>;

// ── Union ──────────────────────────────────────────────────────────────────

export const DashboardPatchSchema = z.discriminatedUnion('op', [
  ReplaceMetricPatchSchema,
  AddMetricPatchSchema,
  SetTimeRangePatchSchema,
  SetMarkPatchSchema,
]);
export type DashboardPatch = z.infer<typeof DashboardPatchSchema>;

export function parseDashboardPatch(input: unknown) {
  return DashboardPatchSchema.safeParse(input);
}
