import { Rules } from '../../vendor/unicode-linebreak.js';
import { tokenize, isWeakEnding } from './typeset';
import type { Token } from './typeset';
import { languageOf, latinTag } from './language';
import { extendedCoverage } from './coverage';
import type { Coverage } from './coverage';
export { languageOf };

export const UNICODE_VERSION = '17.0.0';
const profiles: Record<string, ReadonlySet<string>> = {
  fr: new Set('le la les un une des de du au aux et ou en pour avec sans sur sous'.split(' ')),
  de: new Set('der die das den dem des ein eine einer einem einen und oder mit von zu im am an auf'.split(' ')),
  es: new Set('el la los las un una unos unas de del al y o en por para con sin'.split(' ')),
};
// Segmenters are stateless; one per language is created on first use.
const segmenters = new Map<string, Intl.Segmenter>();
function graphemeSegmenter(language: string): Intl.Segmenter {
  let segmenter = segmenters.get(language);
  if (!segmenter) segmenters.set(language, segmenter = new Intl.Segmenter(language, { granularity: 'grapheme' }));
  return segmenter;
}
export interface BreakUnit { text: string; index: number; hyphen: boolean }
export interface BreakAnalysis {
  unicode: string;
  language: string;
  outcome: 'supported' | 'native:language' | 'native:script' | 'native:soft-hyphen' | 'native:author-breaks';
  units: BreakUnit[];
  opportunities: number[];
}
/**
 * The most code points (collapsible white space aside) a paragraph may hold
 * between two line-break opportunities. Measuring reads each word's boxes,
 * and WebKit's Range.getClientRects() takes time in proportion to the length
 * of the line a range is on, so a longer unbreakable run costs the square of
 * its length: 11,000 closing quotes and a letter took about 37 s in
 * typeset() in WebKit, 11,000 letters, a hyphen and a letter about 15 s.
 * Prose has no such runs; untrusted text (a comment, a profile) can. A block
 * with one is declined as native:run-budget before anything is measured.
 */
export const RUN_BUDGET = 500;
// A letter or digit, spaces, then a letter is always an opportunity (UAX #14
// LB18: break after spaces; no earlier rule applies to these classes).
const certainBreak = /(?<=[\p{L}\p{N}] +)(?=\p{L})/u;
/** Code points that render: collapsible white space does not. */
function runLength(text: string): number {
  let length = 0;
  for (const char of text) if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r' && char !== '\f') length++;
  return length;
}
/** Whether some stretch of `source` between two line-break opportunities
 * holds more than RUN_BUDGET code points. Linear, and nearly free for
 * prose: the Unicode rules run only where the text goes more than
 * RUN_BUDGET characters without a space between letters. */
export function exceedsRunBudget(source: string): boolean {
  if (source.length <= RUN_BUDGET || !source.split(certainBreak).some(piece => piece.length > RUN_BUDGET)) return false;
  let start = 0;
  for (const { position } of new Rules().breaks(source.replace(/[\t\r\n]/g, ' '))) {
    if (runLength(source.slice(start, position)) > RUN_BUDGET) return true;
    start = position;
  }
  return runLength(source.slice(start)) > RUN_BUDGET;
}

export function languageWeakEnding(word: string, language: string): boolean {
  if (language === 'en') return isWeakEnding(word);
  if (!profiles[language]) return false;
  const normalized = word.normalize('NFC').toLocaleLowerCase(language === 'und' ? undefined : language)
    .replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');
  return profiles[language]?.has(normalized) ?? false;
}

const latinOrShared = /[\p{Script_Extensions=Latin}\p{Script=Common}\p{Script=Inherited}]/u;
const borrowed = /[\p{Script=Greek}\p{Script=Cyrillic}]/u;
/** Latin-script text: every character Latin, shared (digits, punctuation,
 * spaces) or a combining mark, except that Greek and Cyrillic letters may
 * appear in runs of at most three in text with Latin letters: a unit (5 μg),
 * a variant (α-synuclein), a constant (Δ). A Greek or Cyrillic word or
 * sentence still leaves the block native (native:script); 4.3 declined the
 * block for a single such letter. */
function latinText(source: string): boolean {
  let run = 0, any = false;
  for (const char of source) {
    if (borrowed.test(char)) {
      if (/\p{L}/u.test(char) && ++run > 3) return false;
      any = true;
    } else if (!latinOrShared.test(char)) return false;
    else if (!/\p{M}/u.test(char)) run = 0;
  }
  return !any || /\p{Script=Latin}/u.test(source);
}

/** Unicode opportunities, conservatively tailored to horizontal Latin-script CSS.
 * This never inserts hyphens or treats a word boundary as a legal line break. */
export function analyzeBreaks(source: string, options: { language?: string | null; hyphens?: string; outcomeOnly?: boolean; coverage?: Coverage } = {}): BreakAnalysis {
  const declared = languageOf(options.language);
  // English, French, German and Spanish have preferences; untagged text is
  // neutral. With extended coverage, any other language written in Latin
  // script is neutral too, and an unreadable tag counts as none.
  const extended = extendedCoverage(options.coverage);
  const language = extended && declared === 'invalid' ? 'und' : declared;
  const result: BreakAnalysis = { unicode: UNICODE_VERSION, language, outcome: 'supported', units: [], opportunities: [] };
  if (!['und', 'en', 'fr', 'de', 'es'].includes(language) && !(extended && latinTag(options.language))) { result.outcome = 'native:language'; return result; }
  if (!latinText(source) || /[\u202a-\u202e\u2066-\u2069]/u.test(source)) {
    result.outcome = 'native:script'; return result;
  }
  if (source.includes('\u00ad')) { result.outcome = 'native:soft-hyphen'; return result; }
  if (/[\u000b\u000c\u0085\u2028\u2029]/u.test(source)) { result.outcome = 'native:author-breaks'; return result; }
  // The outcome alone (a block that already fits on one line needs no units).
  if (options.outcomeOnly) return result;
  // Normal CSS collapses ASCII segment whitespace; preserve UTF-16 offsets.
  const normalized = source.replace(/[\t\r\n]/g, ' ');
  const graphemes = new Set([source.length, ...Array.from(graphemeSegmenter(language).segment(source), g => g.index)]);
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
