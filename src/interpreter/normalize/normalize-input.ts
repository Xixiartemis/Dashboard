/**
 * Input Normalizer — surface text normalization only.
 *
 * Handles: fullwidth/halfwidth, whitespace, punctuation, common synonym unification.
 * Does NOT make semantic decisions (that's Extractor/Resolver).
 */

// ── Fullwidth → Halfwidth (digits and letters) ───────────────────────────

function normalizeFullwidth(text: string): string {
  return text.replace(/[\uff01-\uff5e]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

// ── Normalize whitespace around numbers and CJK ───────────────────────────

function normalizeWhitespace(text: string): string {
  return text
    // Remove space between letter and CJK
    .replace(/([A-Za-z])\s+([\u4e00-\u9fff])/g, '$1$2')
    // Remove spaces between CJK and digits
    .replace(/([\u4e00-\u9fff])\s+(\d)/g, '$1$2')
    .replace(/(\d)\s+([\u4e00-\u9fff])/g, '$1$2')
    // Remove spaces between CJK characters
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
    // Normalize multiple spaces to single
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Normalize punctuation ─────────────────────────────────────────────────

function normalizePunctuation(text: string): string {
  return text
    .replace(/[，]/g, '，')
    .replace(/[。！？]/g, '。')
    .replace(/[,]/g, '，')
    .replace(/[.!?]/g, '。');
}

// ── Synonym unification (surface only) ────────────────────────────────────

const SYNONYM_MAP: [RegExp, string][] = [
  // Chart types
  [/柱形图/g, '柱状图'],
  [/柱图/g, '柱状图'],

  // Common verb forms
  [/看看/g, '查看'],

  // Mark verbs
  [/改成/g, '改为'],
  [/变成/g, '改为'],
  [/换成/g, '改为'],
];

/**
 * Normalize input text for consistent downstream parsing.
 *
 * This is the first stage of the Interpreter pipeline.
 * Safe normalization only — no semantic decisions.
 */
export function normalizeInput(input: string): string {
  let text = input;
  text = normalizeFullwidth(text);
  text = normalizePunctuation(text);
  for (const [pattern, replacement] of SYNONYM_MAP) {
    text = text.replace(pattern, replacement);
  }
  text = normalizeWhitespace(text);
  return text;
}
