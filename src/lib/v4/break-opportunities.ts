import { Rules } from '../../vendor/unicode-linebreak.js';
import { tokenize, isWeakEnding } from './typeset';
import type { Token } from './typeset';

export const UNICODE_VERSION = '17.0.0';
const profiles: Record<string, ReadonlySet<string>> = {
  fr: new Set('le la les un une des de du au aux et ou en pour avec sans sur sous'.split(' ')),
  de: new Set('der die das den dem des ein eine einer einem einen und oder mit von zu im am an auf'.split(' ')),
  es: new Set('el la los las un una unos unas de del al y o en por para con sin'.split(' ')),
};
export interface BreakUnit { text: string; index: number; hyphen: boolean }
export interface BreakAnalysis {
  unicode: string;
  language: string;
  outcome: 'supported' | 'native:language' | 'native:script' | 'native:soft-hyphen' | 'native:author-breaks';
  units: BreakUnit[];
  opportunities: number[];
}
export function languageOf(tag: string | null | undefined): string {
  if (!tag?.trim()) return 'und';
  try {
    const locale = new Intl.Locale(tag);
    return locale.script && locale.script !== 'Latn' ? 'unsupported' : locale.language || 'und';
  } catch { return 'invalid'; }
}
export function languageWeakEnding(word: string, language: string): boolean {
  if (language === 'en') return isWeakEnding(word);
  if (!profiles[language]) return false;
  const normalized = word.normalize('NFC').toLocaleLowerCase(language === 'und' ? undefined : language)
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  return profiles[language]?.has(normalized) ?? false;
}

/** Unicode opportunities, conservatively tailored to horizontal Latin-script CSS.
 * This never inserts hyphens or treats a word boundary as a legal line break. */
export function analyzeBreaks(source: string, options: { language?: string | null; hyphens?: string } = {}): BreakAnalysis {
  const language = languageOf(options.language);
  const result: BreakAnalysis = { unicode: UNICODE_VERSION, language, outcome: 'supported', units: [], opportunities: [] };
  if (!['und', 'en', 'fr', 'de', 'es'].includes(language)) { result.outcome = 'native:language'; return result; }
  if ([...source].some(c => !/[\p{Script_Extensions=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(c)) || /[\u202a-\u202e\u2066-\u2069]/u.test(source)) {
    result.outcome = 'native:script'; return result;
  }
  if (source.includes('\u00ad')) { result.outcome = 'native:soft-hyphen'; return result; }
  if (/[\u000b\u000c\u0085\u2028\u2029]/u.test(source)) { result.outcome = 'native:author-breaks'; return result; }
  // Normal CSS collapses ASCII segment whitespace; preserve UTF-16 offsets.
  const normalized = source.replace(/[\t\r\n]/g, ' ');
  const graphemes = new Set([source.length, ...Array.from(new Intl.Segmenter(language, { granularity: 'grapheme' }).segment(source), g => g.index)]);
  const positions = [...new Rules().breaks(normalized)].map(b => b.position).filter(pos => {
    if (!graphemes.has(pos)) return false;
    if (pos < source.length && /[\u00a0\u202f\u2060\ufeff\u2011]/u.test(source[pos - 1] + source[pos])) return false;
    if (options.hyphens === 'none' && /[-\u2010]$/.test(source.slice(0, pos))) return false;
    return true;
  });
  let start = 0;
  for (const end of positions) {
    const slice = source.slice(start, end);
    const leading = slice.match(/^[ \t\r\n]*/u)![0].length;
    const text = slice.slice(leading).replace(/[ \t\r\n]+$/u, '');
    // Carry an isolated typographic-space run into the next real unit.
    // It has measurable width, but cannot be a lexical line by itself.
    if (text && /^\s+$/u.test(text)) continue;
    if (text) result.units.push({ text, index: start + leading, hyphen: /[-\u2010]$/u.test(text) });
    start = end;
  }
  result.opportunities = result.units.slice(1).map(unit => unit.index);
  return result;
}

export function tokenForUnit(unit: BreakUnit, language: string): Token {
  const parts = tokenize(unit.text, () => 0).filter(t => t.kind !== 'space');
  const first = parts[0];
  const last = parts.at(-1)!;
  return { ...first, text: unit.text, width: 0,
    kind: /[\p{L}\p{N}]/u.test(unit.text) ? 'word' : first.kind,
    stickyPrev: first.stickyPrev, stickyNext: last.stickyNext,
    // The audit vocabulary includes auxiliaries, but the compositor charges
    // those separately. Unicode eligibility must not promote them to weak words.
    weakEnd: language === 'en' ? last.weakEnd : languageWeakEnding(last.text, language),
    bindOpener: language === 'en' ? last.bindOpener : undefined,
    protectedCompound: unit.hyphen ? false : first.protectedCompound };
}
