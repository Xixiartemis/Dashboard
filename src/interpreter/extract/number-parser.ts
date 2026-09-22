/**
 * Number Parser — deterministic Chinese + Arabic number extraction.
 *
 * Only handles numbers that appear in the current Domain (1-60 range).
 * Not a general-purpose Chinese number library.
 */

const CHINESE_DIGITS: Record<string, number> = {
  '零': 0, '〇': 0,
  '一': 1, '壹': 1,
  '二': 2, '两': 2, '贰': 2,
  '三': 3, '叁': 3,
  '四': 4, '肆': 4,
  '五': 5, '伍': 5,
  '六': 6, '陆': 6,
  '七': 7, '柒': 7,
  '八': 8, '捌': 8,
  '九': 9, '玖': 9,
  '十': 10, '拾': 10,
  '二十': 20, '廿': 20,
  '三十': 30, '卅': 30,
  '四十': 40,
  '五十': 50,
  '六十': 60,
};

/**
 * Parse a number from text. Supports Arabic numerals and common Chinese numbers.
 *
 * Returns the first number found, or undefined.
 */
export function parseNumber(text: string): number | undefined {
  // Try Arabic numeral first
  const arabicMatch = text.match(/(\d+)/);
  if (arabicMatch) {
    return parseInt(arabicMatch[1], 10);
  }

  // Try compound Chinese numbers (e.g. 十五, 二十三)
  const compoundMatch = text.match(/([一二三四五六七八九二十两三十]+)[\u4e00-\u9fff]*/);
  if (compoundMatch) {
    return parseChineseNumber(compoundMatch[1]);
  }

  return undefined;
}

/**
 * Parse a Chinese number string into an integer.
 * Handles: 单字 (三), 整十 (二十), 复合 (十五, 二十三).
 */
export function parseChineseNumber(text: string): number | undefined {
  // Direct lookup
  if (text in CHINESE_DIGITS) {
    return CHINESE_DIGITS[text];
  }

  // Compound: e.g. "十五" = 10 + 5, "二十三" = 20 + 3
  let result = 0;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    // Check for two-char prefixes first (二十, 三十, etc.)
    if (i + 1 < text.length) {
      const twoChar = text.substring(i, i + 2);
      if (twoChar in CHINESE_DIGITS) {
        result += CHINESE_DIGITS[twoChar];
        i += 2;
        continue;
      }
    }

    // Single char
    if (ch in CHINESE_DIGITS) {
      const val = CHINESE_DIGITS[ch];
      // If this is 十 and result > 0, it's a tens multiplier
      if (val === 10 && result > 0) {
        result = result * 10; // e.g. 二十 → 2 * 10
      } else if (val === 10 && result === 0) {
        result = 10;
      } else if (result >= 10) {
        result += val; // e.g. 十五 → 10 + 5
      } else {
        result += val;
      }
      i++;
    } else {
      i++;
    }
  }

  return result > 0 ? result : undefined;
}

/**
 * Extract all numbers from text (Arabic + Chinese).
 * Returns array of { value, index, raw }.
 */
export function extractNumbers(text: string): Array<{ value: number; index: number; raw: string }> {
  const results: Array<{ value: number; index: number; raw: string }> = [];

  // Arabic numbers
  const arabicRegex = /\d+/g;
  let match;
  while ((match = arabicRegex.exec(text)) !== null) {
    results.push({
      value: parseInt(match[0], 10),
      index: match.index,
      raw: match[0],
    });
  }

  // Chinese numbers
  const chineseRegex = /[一二三四五六七八九二十两十三四五六七八九十]+/g;
  while ((match = chineseRegex.exec(text)) !== null) {
    const val = parseChineseNumber(match[0]);
    if (val !== undefined) {
      results.push({
        value: val,
        index: match.index,
        raw: match[0],
      });
    }
  }

  // Sort by position
  results.sort((a, b) => a.index - b.index);
  return results;
}
