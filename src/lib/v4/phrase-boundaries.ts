/** Conservative English attachments, not a general syntactic parser. */
import type { LayoutMetrics } from './layout-metrics';
export interface PhraseGroup { start: number; end: number; kind: 'nominal' | 'infinitive' | 'name' }
const determiners = new Set(['a', 'an', 'the', 'my', 'your', 'our', 'their', 'his', 'her', 'its']);
const stops = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'as', 'than', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'after', 'before', 'through', 'into', 'over', 'under', 'between', 'without', 'about', 'around', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'which', 'who', 'how', 'we', 'you', 'they', 'it']);
const modifiers = new Set(['new', 'old', 'first', 'last', 'next', 'previous', 'second', 'third', 'small', 'large', 'little', 'long', 'short', 'different', 'same', 'other', 'final', 'whole', 'single']);
const nameHeads = new Set(['street', 'avenue', 'boulevard', 'road', 'lane', 'drive', 'court', 'square', 'parkway', 'terrace',
  'cinema', 'cinemas', 'theater', 'theaters', 'theatre', 'theatres', 'gallery', 'galleries', 'museum', 'library', 'university', 'college', 'hospital', 'hotel']);
const capitalized = (text: string) => /^[('"\u2018\u201c]*\p{Lu}[\p{L}'\u2019-]*[.,;:!?!)"'\u201d\u2019]*$/u.test(text);
/** `text` without the run of `chars` it ends with, as /[…]+$/u would
 * remove it, read backwards: that unanchored pattern retries from every
 * position of a long punctuation run, which costs the run's length squared. */
export const stripEnd = (text: string, chars: string): string => {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end--;
  return end === text.length ? text : text.slice(0, end);
};
const word = (text: string) => stripEnd(text.toLowerCase().replace(/^[("'“‘]+/u, ''), '.,;:!?)"\'”’');
const ends = (text: string) => /[.,;:!?)]["'”’]*$/u.test(text);
// Created on first use: a module-level Intl.Segmenter throws at import
// where the API is missing, taking the host application down with it.
let sentenceSegmenter: Intl.Segmenter | undefined;
/** English sentence boundaries. Created on first use and shared. */
export const sentences = (): Intl.Segmenter => sentenceSegmenter ??= new Intl.Segmenter('en', { granularity: 'sentence' });

// ─── Abbreviations and bound pairs (English) ───
//
// A period after an abbreviation does not end a sentence, and some pairs read
// as one unit: a number and its unit ("1,200 m"), an honorific and a name
// ("Dr. Jones"), a label and its number ("Fig. 3", "type 2"), and a word and
// its letter designator ("hepatitis C", "World War I"). The compositor charges
// for splitting them and audit() reports the splits; both use these lists.
// Chicago (7.62, 10.4) and the SI brochure (5.4.3) keep these units together.
const abbreviations = new Set(['Mr', 'Mrs', 'Ms', 'Mx', 'Dr', 'Prof', 'Rev', 'St', 'Mt', 'Jr', 'Sr', 'vs', 'etc', 'e.g', 'i.e', 'E.g', 'I.e',
  'a.m', 'p.m', 'p', 'pp', 'Fig', 'fig', 'No', 'Vol', 'Ch', 'Inc', 'Ltd', 'Co']);
// "St." and "Mt." also abbreviate Street and Mount after a name, so they bind
// only to the closed toponym list in typeset.ts.
const honorifics = new Set(['Mr', 'Mrs', 'Ms', 'Mx', 'Dr', 'Prof', 'Rev']);
const abbreviatedLabels = new Set(['Fig', 'fig', 'p', 'pp', 'No', 'Vol', 'Ch']);
const labelWords = new Set(['table', 'figure', 'chapter', 'section', 'page', 'part', 'step', 'room', 'level', 'grade', 'stage', 'phase',
  'type', 'class', 'category', 'tier', 'zone', 'appendix', 'exhibit', 'schedule', 'version']);
// Words that take a capital-letter designator ("type A"). Other capitals are
// designators after any word; "A" is also the article, so it needs a head.
const designatorHeads = new Set(['type', 'grade', 'class', 'size', 'plan', 'part', 'vitamin', 'hepatitis', 'blood', 'group', 'section',
  'model', 'exhibit', 'appendix', 'schedule', 'title', 'category', 'level', 'phase', 'stage', 'tier', 'zone', 'option', 'list', 'team']);
// "I" is also the pronoun, which follows any capitalized word ("In March I",
// "At Kaiser I"). It is a roman numeral only after a capitalized head that
// takes one ("World War I", "Phase I", "Title I", "Super Bowl I"), or after a
// name that follows a regnal title ("King Henry I").
const romanHeads = new Set(['war', 'part', 'title', 'phase', 'stage', 'type', 'class', 'grade', 'level', 'tier', 'chapter', 'book', 'act',
  'volume', 'section', 'schedule', 'appendix', 'bowl']);
const regnalTitles = new Set(['king', 'queen', 'pope', 'emperor', 'empress', 'tsar', 'czar', 'tsarina', 'pharaoh', 'kaiser', 'prince',
  'princess', 'duke', 'sultan', 'shah']);
const units = new Set(['%', '‰', '°', '°C', '°F', 'K', 'm', 'km', 'cm', 'mm', 'µm', 'μm', 'nm', 'g', 'kg', 'mg', 'µg', 'μg', 'mcg', 'ng', 'l', 'L', 'ml', 'mL',
  'dl', 'dL', 's', 'ms', 'min', 'h', 'hr', 'hrs', 'Hz', 'kHz', 'MHz', 'GHz', 'W', 'kW', 'MW', 'kWh', 'V', 'mA', 'J', 'kJ', 'cal', 'kcal',
  'Pa', 'kPa', 'mmHg', 'dB', 'lb', 'lbs', 'oz', 'ft', 'yd', 'mi', 'mph', 'km/h', 'kph', 'gal', 'IU', 'mol', 'mmol', 'bpm', 'KB', 'MB', 'GB',
  'TB', 'px', 'pt', 'a.m', 'p.m', 'am', 'pm', 'AM', 'PM', 'A.M', 'P.M', 'million', 'billion', 'trillion', 'percent']);
const leading = (text: string) => text.replace(/^[("'\u201C\u2018[{]+/u, '');
const outer = (text: string) => stripEnd(leading(text), '"\'\u201D\u2019)]}');
/** What `leading` removes from the start of a word and `trailing` from its end. */
const openingMarks = '("\'\u201C\u2018[{';
const closingMarks = '.,;:!?"\'\u201D\u2019)]}\u2013\u2014';
const trailing = (text: string) => stripEnd(text, closingMarks);

/** "Dr.", "Fig.", "a.m.", "U.S." and initials such as "J." end no sentence.
 * Capital "I." and "A." are left as sentence ends ("so did I."). */
export function isAbbreviation(text: string): boolean {
  const core = outer(text);
  if (!core.endsWith('.')) return false;
  const stem = core.slice(0, -1);
  return abbreviations.has(stem) || /^(?:\p{Lu}\.){2,}$/u.test(core) || (/^\p{Lu}$/u.test(stem) && stem !== 'I' && stem !== 'A');
}

/** A colon can introduce a thought without introducing a new sentence.
 * The period of an abbreviation ends no sentence (see boundaryBefore). */
export const proseBoundary = (text: string): boolean => /[.!?:]["'\u201D\u2019)\]]*$/u.test(text) && !isAbbreviation(text);

// Capitalized words that open sentences and are not names. After "U.S.",
// "p.m.", "etc.", "Co.", "No." or "hepatitis C." one starts a new sentence
// ("…in the U.S. The results"); a name or other capitalized word continues it
// ("the U.S. Army", "J. Smith").
const openers = new Set(['the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its', 'he', 'she', 'we', 'they', 'you', 'i', 'his',
  'her', 'our', 'their', 'your', 'my', 'there', 'here', 'then', 'now', 'today', 'in', 'on', 'at', 'for', 'as', 'by', 'with', 'from', 'but',
  'and', 'or', 'so', 'yet', 'if', 'when', 'while', 'after', 'before', 'once', 'since', 'because', 'although', 'though', 'what', 'why',
  'how', 'where', 'who', 'which', 'most', 'many', 'more', 'some', 'all', 'both', 'each', 'every', 'one', 'no', 'nobody', 'none',
  'everyone', 'everything', 'nothing', 'someone', 'something', 'anyone', 'also', 'even', 'only', 'still', 'please', 'ask', 'call', 'take',
  'talk', 'bring', 'keep', 'try', 'do', 'don\'t', 'don\u2019t', 'it\'s', 'it\u2019s']);
// After "a.m." or "p.m." these continue the sentence ("9 a.m. Monday", "5 p.m.
// Eastern"); any other capitalized word starts a new one.
const timeContext = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'mon', 'tue', 'tues', 'wed',
  'thu', 'thur', 'thurs', 'fri', 'sat', 'sun', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'et', 'est',
  'edt', 'ct', 'cst', 'cdt', 'mt', 'mst', 'mdt', 'pt', 'pst', 'pdt', 'akst', 'akdt', 'hst', 'gmt', 'utc', 'bst', 'cet', 'cest', 'eastern',
  'central', 'mountain', 'pacific', 'local', 'daylight', 'standard', 'time']);
/** proseBoundary with the next word as context: an abbreviation that is not
 * an honorific also ends its sentence when a capitalized common sentence
 * opener follows it. "etc." ends one before any capitalized word, "a.m." and
 * "p.m." before any but a day, a month or a time zone, and "No." before any
 * but a roman numeral (a label takes a number, "No. 5"); the opener list
 * stays for the ambiguous rest (initials, "St.", "U.S."). */
export function boundaryBefore(text: string, next: string | undefined): boolean {
  if (proseBoundary(text)) return true;
  const stem = outer(text).slice(0, -1);
  if (next === undefined || !isAbbreviation(text) || honorifics.has(stem)) return false;
  const opener = stripEnd(outer(next), '.,;:!?');
  if (!/^\p{Lu}/u.test(opener)) return false;
  if (stem === 'etc') return true;
  if (/^[ap]\.m$/iu.test(stem)) return !timeContext.has(opener.toLowerCase());
  if (stem === 'No') return !/^[IVXLC]+$/u.test(opener);
  return openers.has(opener.toLowerCase());
}

export type BoundPair = 'unit' | 'honorific' | 'label' | 'designator';
/**
 * The kind of unit `next` forms with `previous`, if a line break between them
 * would split it. `before` is the word ahead of `previous`, if any: a capital
 * "I" is a designator only after a capitalized head that takes a roman
 * numeral ("World War I") or a name after a regnal title ("King Henry I");
 * elsewhere it is the pronoun ("When I", "In March I").
 */
export function boundPair(previous: string, next: string, before?: string): BoundPair | null {
  const tail = trailing(next);
  if (/^[$€£¥]?\d[\d,.]*(?:[–-]\d[\d,.]*)?$/u.test(previous) && units.has(tail)) return 'unit';
  const head = outer(previous);
  if (head.endsWith('.') && honorifics.has(head.slice(0, -1)) && /^["'\u201C\u2018(]*\p{Lu}/u.test(next)) return 'honorific';
  if (((head.endsWith('.') && abbreviatedLabels.has(head.slice(0, -1))) || labelWords.has(head.toLowerCase()))
    && /^(?:\d[\p{L}\d.,–-]*|[IVX]{2,})$/u.test(tail)) return 'label';
  if (/^\p{L}+$/u.test(previous) && /^\p{Lu}$/u.test(tail)) {
    if (tail === 'A') return designatorHeads.has(previous.toLowerCase()) ? 'designator' : null;
    if (tail === 'I') return /^\p{Lu}/u.test(previous) && (romanHeads.has(previous.toLowerCase())
      || (before !== undefined && regnalTitles.has(outer(before).toLowerCase()))) ? 'designator' : null;
    return 'designator';
  }
  // A capital letter after a function word modifies the word that follows
  // ("and B students", "the X chromosome", "an F grade"): the letter and that
  // word are one unit too, so the letter does not end a line cut off from it.
  if (/^[B-HJ-Z]$/u.test(previous) && before !== undefined && stops.has(word(before)) && /^\p{Ll}/u.test(next)) return 'designator';
  return null;
}

interface KeepNode { next: Map<number, KeepNode>; phrase: boolean }
/** A hyphen, dash or slash joins a unit to the next without a space. */
const joins = (code: number) => code === 0x2d || code === 0x2010 || code === 0x2013 || code === 0x2014 || code === 0x2f;
/**
 * Where author `keep` phrases occur in a run of break units: [start, end)
 * unit ranges spanning at least one break. Matching ignores case, treats
 * NBSP and runs of spaces as one space, ignores punctuation around the
 * phrase, and joins a unit that ends in a hyphen or dash to the next.
 *
 * From each start, units are joined (with a space, or none after a hyphen,
 * dash or slash) and the joined text, less its opening and closing marks,
 * is compared with the phrases. That text only ever grows at its end as
 * units are added, and it takes in the closing marks it passed over (an en
 * dash run, say) once any other character follows them, so it is walked
 * down a trie of the phrases character by character instead of being
 * rebuilt: the walk from a start ends as soon as no phrase can be reached.
 * Rebuilding and rescanning the joined text at every unit cost the cube of
 * a run of dash units, which strip to nothing and so never ended the
 * search: 1,000 em dash units took 4.6 s.
 */
export function keptPhrases(texts: readonly string[], keep: readonly string[] | undefined): { start: number; end: number }[] {
  const normalize = (text: string) => text.toLowerCase().replace(/[\s\u00A0\u202F]+/gu, ' ').trim();
  // Invalid values (a string, non-string items) keep 4.2's behaviour: no
  // phrase is kept, and nothing throws; development builds warn (validate.ts).
  const list = Array.isArray(keep) ? keep.filter((phrase): phrase is string => typeof phrase === 'string') : [];
  const phrases = [...new Set(list.map(phrase => trailing(leading(normalize(phrase))))
    .filter(phrase => phrase.includes(' ') || /[-\u2010\u2013\u2014/]./u.test(phrase)))];
  const found: { start: number; end: number }[] = [];
  if (!phrases.length) return found;
  const root: KeepNode = { next: new Map(), phrase: false };
  for (const phrase of phrases) {
    let node = root;
    for (let i = 0; i < phrase.length; i++) {
      let child = node.next.get(phrase.charCodeAt(i));
      if (!child) node.next.set(phrase.charCodeAt(i), child = { next: new Map(), phrase: false });
      node = child;
    }
    node.phrase = true;
  }
  const walk = (node: KeepNode | null, text: string, from: number, to: number): KeepNode | null => {
    for (let i = from; node && i < to; i++) node = node.next.get(text.charCodeAt(i)) ?? null;
    return node;
  };
  // Each unit once: its normal form, where its opening marks end, and where
  // its closing marks begin (0 when it is nothing but closing marks).
  const units = texts.map(text => {
    const unit = normalize(text);
    let open = 0, close = unit.length;
    while (open < unit.length && openingMarks.includes(unit[open])) open++;
    while (close > 0 && closingMarks.includes(unit[close - 1])) close--;
    return { unit, open, close };
  });
  for (let start = 0; start < units.length; start++) {
    // The joined text is `lead` (opening marks only, until `opened`), then
    // `bare` (what is compared), then closing marks. `at` is bare's place in
    // the trie, `ahead` the place of bare and the closing marks after it,
    // through which any longer bare passes; `last` is the joined text's last
    // UTF-16 unit (-1 while it is empty).
    let opened = false, at: KeepNode | null = root, ahead: KeepNode | null = root, last = -1;
    for (let end = start + 1; end <= units.length; end++) {
      const { unit, open, close } = units[end - 1];
      if (end > start + 1 && !joins(last)) {
        // A space, which is neither mark, then the unit.
        opened = true;
        at = walk(walk(ahead, ' ', 0, 1), unit, 0, close);
        ahead = walk(at, unit, close, unit.length);
        last = unit.length ? unit.charCodeAt(unit.length - 1) : 0x20;
      } else {
        let from = 0;
        if (!opened) { from = open; opened = open < unit.length; }
        if (close > from) { at = walk(ahead, unit, from, close); ahead = walk(at, unit, close, unit.length); }
        else ahead = walk(ahead, unit, from, unit.length);
        if (unit.length) last = unit.charCodeAt(unit.length - 1);
      }
      if (end - start > 1 && at?.phrase) found.push({ start, end });
      // No phrase is reachable, and bare, unchanged from here, is none.
      if (!ahead && !at?.phrase) break;
    }
  }
  return found;
}
export function strandedOpener(line: string): boolean {
  const words = line.trim().split(/\s+/u);
  return words.length > 1 && boundaryBefore(words.at(-2)!, words.at(-1))
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
