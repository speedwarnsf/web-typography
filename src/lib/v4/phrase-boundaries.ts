/** Conservative English attachments, not a general syntactic parser. */
import type { LayoutMetrics } from './layout-metrics';
export interface PhraseGroup { start: number; end: number; kind: 'nominal' | 'infinitive' | 'name' }
const determiners = new Set(['a', 'an', 'the', 'my', 'your', 'our', 'their', 'his', 'her', 'its']);
const stops = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'as', 'than', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'after', 'before', 'through', 'into', 'over', 'under', 'between', 'without', 'about', 'around', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'which', 'who', 'how', 'we', 'you', 'they', 'it']);
const modifiers = new Set(['new', 'old', 'first', 'last', 'next', 'previous', 'second', 'third', 'small', 'large', 'little', 'long', 'short', 'different', 'same', 'other', 'final', 'whole', 'single']);
const nameHeads = new Set(['street', 'avenue', 'boulevard', 'road', 'lane', 'drive', 'court', 'square', 'parkway', 'terrace',
  'cinema', 'cinemas', 'theater', 'theaters', 'theatre', 'theatres', 'gallery', 'galleries', 'museum', 'library', 'university', 'college', 'hospital', 'hotel']);
const capitalized = (text: string) => /^[('"\u2018\u201c]*\p{Lu}[\p{L}'\u2019-]*[.,;:!?!)"'\u201d\u2019]*$/u.test(text);
const word = (text: string) => text.toLowerCase().replace(/^[("'“‘]+|[.,;:!?!)"'”’]+$/gu, '');
const ends = (text: string) => /[.,;:!?)]["'”’]*$/u.test(text);
let sentenceSegmenter: Intl.Segmenter | undefined;
/** English sentence boundaries. Created on first use and shared. */
export const sentences = (): Intl.Segmenter => sentenceSegmenter ??= new Intl.Segmenter('en', { granularity: 'sentence' });

/** A colon can introduce a thought without introducing a new sentence. */
export const proseBoundary = (text: string): boolean => /[.!?:]["'\u201D\u2019)\]]*$/u.test(text);

const leading = (text: string) => text.replace(/^[("'\u201C\u2018[{]+/u, '');
const trailing = (text: string) => text.replace(/[.,;:!?"'\u201D\u2019)\]}]+$/u, '');

/**
 * Where author `keep` phrases occur in a run of break units: [start, end)
 * unit ranges spanning at least one break. Matching ignores case, treats
 * NBSP and runs of spaces as one space, ignores punctuation around the
 * phrase, and joins a unit that ends in a hyphen or dash to the next.
 */
export function keptPhrases(texts: readonly string[], keep: readonly string[] | undefined): { start: number; end: number }[] {
  const normalize = (text: string) => text.toLowerCase().replace(/[\s\u00A0\u202F]+/gu, ' ').trim();
  const phrases = [...new Set((keep || []).map(phrase => trailing(leading(normalize(phrase))))
    .filter(phrase => phrase.includes(' ') || /[-\u2010\u2013\u2014/]./u.test(phrase)))];
  const found: { start: number; end: number }[] = [];
  if (!phrases.length) return found;
  const longest = Math.max(...phrases.map(phrase => phrase.length));
  for (let start = 0; start < texts.length; start++) {
    let joined = '';
    for (let end = start + 1; end <= texts.length; end++) {
      const unit = normalize(texts[end - 1]);
      joined += (end === start + 1 || /[-\u2010\u2013\u2014/]$/u.test(joined) ? '' : ' ') + unit;
      const bare = trailing(leading(joined));
      if (bare.length > longest) break;
      if (end - start > 1 && phrases.includes(bare)) found.push({ start, end });
    }
  }
  return found;
}
export function strandedOpener(line: string): boolean {
  const words = line.trim().split(/\s+/u);
  return words.length > 1 && proseBoundary(words.at(-2)!)
    && /^["'\u201C\u2018(\[]*[A-Za-z][A-Za-z'\u2019-]*$/u.test(words.at(-1)!);
}

/** Retain naturally aligned sentences only when there is no geometric defect. */
export function retainSentenceLayout(source: string, before: LayoutMetrics, chosenEnds: readonly number[]): boolean {
  if (before.overflow > .5 || before.lines.length < 2 || before.lines.some(l => l.words < 2)
    || before.lines.some((l, i) => l.width / before.width < (i === before.lines.length - 1 ? .35 : .65))) return false;
  const boundaries = Array.from(sentences().segment(source), s => s.index + s.segment.trimEnd().length);
  if (boundaries.length < 2) return false;
  const lineEnds = new Set(before.lines.map(l => l.sourceEnd));
  return boundaries.every(end => lineEnds.has(end)) && boundaries.some(end => !chosenEnds.includes(end));
}

export function englishPhraseGroups(texts: readonly string[], width: number, measure: (start: number, end: number) => number): PhraseGroup[] {
  const words = texts.map(word);
  const lexical = (index: number) => /^[a-z]+(?:['’-][a-z]+)*$/u.test(words[index] || '') && !stops.has(words[index]);
  const modifier = (index: number) => modifiers.has(words[index]) || /(?:ed|ive|ous|ful|less)$/u.test(words[index] || '');
  const groups: PhraseGroup[] = [];
  for (let start = 0; start < words.length - 1; start++) {
    if (lexical(start) && !ends(texts[start]) && capitalized(texts[start]) && capitalized(texts[start + 1])
      && nameHeads.has(words[start + 1]) && measure(start, start + 2) <= width) {
      groups.push({ start, end: start + 2, kind: 'name' });
    }
  }
  for (let start = 0; start < words.length - 1; start++) {
    if (!determiners.has(words[start]) || ends(texts[start]) || !lexical(start + 1)) continue;
    let end = start + 2;
    if (!ends(texts[start + 1]) && modifier(start + 1) && lexical(start + 2)) end++;
    if (measure(start, end) <= width) groups.push({ start, end, kind: 'nominal' });
    // A compact infinitive and its determiner-led object can form one line.
    if (start >= 2 && words[start - 2] === 'to' && lexical(start - 1)
      && !ends(texts[start - 2]) && !ends(texts[start - 1]) && measure(start - 2, end) <= width) {
      groups.push({ start: start - 2, end, kind: 'infinitive' });
    }
  }
  return groups;
}

export function phraseBreakCosts(texts: readonly string[], groups: readonly PhraseGroup[], title: boolean): number[] {
  const costs = Array<number>(texts.length + 1).fill(0);
  for (const group of groups) {
    if (group.kind === 'name') costs[group.start + 1] = Math.max(costs[group.start + 1], title ? 1800 : 7000);
    if (title && group.kind === 'nominal') costs[group.start + 1] = 480;
    if (!title && group.kind === 'infinitive' && group.end === texts.length) {
      for (let end = group.start + 1; end < group.end; end++) costs[end] = Math.max(costs[end], 7000);
    }
  }
  return costs;
}
