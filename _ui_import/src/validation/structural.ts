/**
 * Structural Validation — validates raw unknown JSON against DashboardSpec schema.
 *
 * Input: unknown (raw JSON from any source)
 * Output: either a typed DashboardSpec or a list of structural errors.
 *
 * This is the FIRST gate. Nothing proceeds without structural validity.
 */

import { parseDashboardSpec, type DashboardSpec } from '../schema/dashboard-spec';
import { parseDashboardPatch, type DashboardPatch } from '../schema/dashboard-patch';
import { type ValidationError, makeError } from './errors';

export interface StructuralResult {
  ok: true;
  spec: DashboardSpec;
}

export interface StructuralFailure {
  ok: false;
  errors: ValidationError[];
}

export type StructuralValidation = StructuralResult | StructuralFailure;

export function validateStructure(input: unknown): StructuralValidation {
  const result = parseDashboardSpec(input);

  if (result.success) {
    return { ok: true, spec: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => {
    const path = issue.path.join('.');

    // Map Zod v4 error codes to our error codes
    if (issue.code === 'unrecognized_keys') {
      return makeError('UNKNOWN_PROPERTY', path, issue.message);
    }
    if (issue.code === 'invalid_type') {
      return makeError('TYPE_ERROR', path, issue.message);
    }
    if (issue.code === 'invalid_value') {
      return makeError('INVALID_ENUM', path, issue.message);
    }
    if (issue.code === 'too_small' || issue.code === 'too_big') {
      return makeError('INVALID_TIME_RANGE', path, issue.message);
    }
    if (issue.code === 'invalid_key' || issue.code === 'invalid_element') {
      return makeError('TYPE_ERROR', path, issue.message);
    }

    return makeError('STRUCTURAL_VALIDATION_FAILED', path, issue.message);
  });

  return { ok: false, errors };
}

// ── Patch structural validation ────────────────────────────────────────────

export interface PatchStructuralResult {
  ok: true;
  patch: DashboardPatch;
}

export interface PatchStructuralFailure {
  ok: false;
  errors: ValidationError[];
}

export type PatchStructuralValidation = PatchStructuralResult | PatchStructuralFailure;

export function validatePatchStructure(input: unknown): PatchStructuralValidation {
  const result = parseDashboardPatch(input);

  if (result.success) {
    return { ok: true, patch: result.data };
  }

  const errors: ValidationError[] = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    if (issue.code === 'invalid_type') {
      return makeError('TYPE_ERROR', path, issue.message);
    }
    if (issue.code === 'invalid_value') {
      return makeError('INVALID_ENUM', path, issue.message);
    }
    return makeError('STRUCTURAL_VALIDATION_FAILED', path, issue.message);
  });

  return { ok: false, errors };
}
