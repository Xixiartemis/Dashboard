/**
 * Instrument Registry — single source of truth for tradeable instruments.
 *
 * Invariants:
 * - Every symbol referenced in a DashboardSpec.instrument MUST exist here.
 * - aliases are used by the future Interpreter to resolve natural-language mentions.
 * - This registry is immutable at runtime (no dynamic adds).
 */

export interface InstrumentEntry {
  symbol: string;
  displayName: string;
  aliases: string[];
  assetType: 'equity' | 'etf' | 'index' | 'bond' | 'crypto';
}

const INSTRUMENTS: readonly InstrumentEntry[] = [
  {
    symbol: 'MOCK.A',
    displayName: 'A公司',
    aliases: ['A 公司', 'A公司', 'A 股票', 'MOCK.A'],
    assetType: 'equity',
  },
  {
    symbol: 'MOCK.B',
    displayName: 'B公司',
    aliases: ['B 公司', 'B公司', 'B 股票', 'MOCK.B'],
    assetType: 'equity',
  },
] as const;

const symbolMap = new Map<string, InstrumentEntry>(
  INSTRUMENTS.map((i) => [i.symbol, i]),
);

const aliasMap = new Map<string, InstrumentEntry>();
for (const entry of INSTRUMENTS) {
  for (const alias of entry.aliases) {
    aliasMap.set(alias, entry);
  }
}

/** Get instrument by exact symbol. Returns undefined if not found. */
export function getInstrument(symbol: string): InstrumentEntry | undefined {
  return symbolMap.get(symbol);
}

/** Resolve an alias (natural-language name) to an instrument. */
export function resolveInstrument(name: string): InstrumentEntry | undefined {
  return aliasMap.get(name) ?? symbolMap.get(name);
}

/** Check if a symbol exists in the registry. */
export function isKnownSymbol(symbol: string): boolean {
  return symbolMap.has(symbol);
}

/** List all registered instruments (read-only). */
export function listInstruments(): readonly InstrumentEntry[] {
  return INSTRUMENTS;
}
