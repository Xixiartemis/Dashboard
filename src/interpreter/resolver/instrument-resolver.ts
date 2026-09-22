/**
 * Instrument Resolver — maps natural-language instrument references to canonical symbols.
 *
 * Delegates to the frozen Instrument Registry's resolveInstrument().
 * Does NOT duplicate instrument metadata.
 *
 * Interpreter-specific aliases (e.g. Chinese stock names beyond Registry) can be
 * added here as a separate alias layer, but the canonical mapping always goes through Registry.
 */

import { resolveInstrument, getInstrument } from '../../registries/instruments';
import { makeInterpreterError, type InterpreterError } from '../errors';

export interface InstrumentResolution {
  ok: true;
  symbol: string;
}

export interface InstrumentResolutionFailure {
  ok: false;
  error: InterpreterError;
}

export type InstrumentResolutionResult = InstrumentResolution | InstrumentResolutionFailure;

/**
 * Resolve a natural-language instrument reference to a canonical symbol.
 *
 * @param input - e.g. 'A公司', 'A 公司', 'MOCK.A', 'A 股票'
 */
export function resolveInstrumentId(input: string): InstrumentResolutionResult {
  const entry = resolveInstrument(input.trim());
  if (!entry) {
    return {
      ok: false,
      error: makeInterpreterError('UNKNOWN_INSTRUMENT', `input="${input}"`),
    };
  }
  return { ok: true, symbol: entry.symbol };
}

/**
 * Validate that a canonical symbol exists in the Registry.
 */
export function validateInstrumentSymbol(symbol: string): boolean {
  return getInstrument(symbol) !== undefined;
}
