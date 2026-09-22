/**
 * DeterministicInterpreter — full NL → Spec/Patch pipeline.
 *
 * Implements DashboardInterpreterPort:
 *   interpretInitial(input) → DashboardSpec
 *   interpretFollowUp(currentSpec, input) → DashboardPatch
 *
 * Pipeline:
 *   normalize → extract → resolve → compile
 */

import type { DashboardInterpreterPort } from '../application/contracts';
import type { DashboardSpec } from '../schema/dashboard-spec';
import type { DashboardPatch } from '../schema/dashboard-patch';
import { normalizeInput } from './normalize/normalize-input';
import { extractInitialIntent } from './extract/initial-extractor';
import { extractFollowUpIntent } from './extract/followup-extractor';
import { resolveInitialIntent } from './resolver/initial-resolver';
import { resolveFollowUpIntent } from './resolver/followup-context-resolver';
import { compileInitialIntent } from './compiler/spec-compiler';
import { compileFollowUpIntent } from './compiler/patch-compiler';
import { makeInterpreterError } from './errors';

export class DeterministicInterpreter implements DashboardInterpreterPort {
  async interpretInitial(input: string): Promise<DashboardSpec> {
    const normalized = normalizeInput(input);
    const extracted = extractInitialIntent(normalized);
    if (!extracted.ok) {
      throw makeInterpreterError(extracted.code as any, extracted.details);
    }
    const resolved = resolveInitialIntent(extracted.intent);
    if (!resolved.ok) throw resolved.error;
    const compiled = compileInitialIntent(resolved.intent);
    if (!compiled.ok) throw compiled.error;
    return compiled.spec;
  }

  async interpretFollowUp(currentSpec: DashboardSpec, input: string): Promise<DashboardPatch> {
    const normalized = normalizeInput(input);
    const extracted = extractFollowUpIntent(normalized);
    if (!extracted.ok) {
      throw makeInterpreterError(extracted.code as any, extracted.details);
    }
    const resolved = resolveFollowUpIntent(extracted.intent, currentSpec);
    if (!resolved.ok) throw resolved.error;
    const compiled = compileFollowUpIntent(resolved.intent, currentSpec);
    if (!compiled.ok) throw compiled.error;
    return compiled.patch;
  }
}
