import { languageOf } from './language';

/** Leading elisions: an apostrophe that opens a word stands for dropped
 * letters, not an opening quote ('90s, 'tis, 'em, 'cause). */
const elision = /^(?:\d{2}s\b|tis\b|twas\b|em\b|cause\b|til\b)/iu;
/** Also elisions, but also words a quotation can open ("the 'round robin'
 * plan"): only when no closing single quote follows in the sentence. */
const loose = /^(?:bout|round|nuff)\b/iu;
/** 'n' is "and" only inside these pairs (rock 'n' roll, fish 'n' chips); a
 * quoted key letter ("Type 'n' to cancel") opens a quotation. */
const nPairs = new Set(['rock', 'rhythm', 'fish', 'salt', 'pick', 'shake', 'surf', 'drag', 'grab', 'meet', 'stop', 'park', 'cash', 'wash',
  'rip', 'plug', 'spick', 'bump', 'nip', 'scratch', 'peel', 'lock', 'snack', 'bread', 'mix']);
const nPairLongest = Math.max(...[...nPairs].map(word => word.length));
/** Whether the run of letters before `index`, across any whitespace, is a
 * pair word: what /(\p{L}+)\s*$/u finds in text.slice(0, index), read
 * backwards and no further than a pair word reaches. That pattern searched
 * the whole text before each quote, from every start, so a long run of
 * letters before many 'n tokens took seconds to educate. */
function pairWordBefore(text: string, index: number): boolean {
  let end = index;
  while (end > 0 && /\s/u.test(text[end - 1])) end--;
  let start = end;
  while (start > 0 && end - start <= nPairLongest) {
    const low = text.charCodeAt(start - 1);
    // A letter outside the BMP is a surrogate pair; no pair word has one.
    if (low >= 0xdc00 && low <= 0xdfff && start > 1 && /^\p{L}$/u.test(text.slice(start - 2, start))) start -= 2;
    else if (/\p{L}/u.test(text[start - 1])) start--;
    else break;
  }
  return start < end && end - start <= nPairLongest && nPairs.has(text.slice(start, end).toLowerCase());
}
/** A sentence end, and a closing single quote after a word. */
const sentenceEnd = /[.!?](?:\s|$)/gu;
const closer = /[\p{L}\p{N}.,!?]['\u2019](?![\p{L}\p{N}])/gu;
/**
 * Whether a closing single quote ends a later word of the same sentence:
 * for the quote at `index`, whether `closer` matches the text after it up to
 * the first sentence end. Searching the rest of the text for each 'round,
 * 'bout or 'nuff cost the square of a text with no sentence end, so each
 * call resumes where the last left off: quotes are educated left to right,
 * and neither the next sentence end nor the next closing quote from a later
 * start can come before the last ones.
 */
function laterCloser(text: string): (index: number) => boolean {
  let end = -1, close = -1, quote = 0;
  return index => {
    if (end <= index) { sentenceEnd.lastIndex = index + 1; end = sentenceEnd.exec(text)?.index ?? text.length; }
    // After a match, lastIndex is its end, so the quote is just before it;
    // with none, it is 0 and nothing closes.
    if (close <= index) { closer.lastIndex = index + 1; close = closer.exec(text)?.index ?? text.length; quote = closer.lastIndex ? closer.lastIndex - 1 : close; }
    return quote < end;
  };
}

/** English quote education only. No whitespace, dash, ellipsis, or length
 * changes, and each quote keeps its kind: single quotes are never turned into
 * double quotes or the reverse. Idempotent. */
export function smartQuotes(text: string): string {
  let doubleOpen = false;
  let singleOpen = false;
  let out = '';
  // The character before, as already educated: a quote just curled open
  // opens the next one too ("'Quoted' inside," gives \u201c\u2018). Kept
  // here, not read back from the growing output, which flattened it for
  // every quote.
  let before = '';
  const closesLater = laterCloser(text);
  const put = (char: string) => { out += char; before = char; };
  for (let index = 0; index < text.length; index++) {
    const quote = text[index];
    if (!/["'\u201c\u201d\u2018\u2019]/u.test(quote)) { put(quote); continue; }
    if (quote === '\u201c') doubleOpen = true;
    else if (quote === '\u201d') doubleOpen = false;
    else if (quote === '\u2018') singleOpen = true;
    if (quote !== '"' && quote !== "'") { put(quote); continue; }
    const after = text[index + 1] || '';
    const opening = !before || /[\s([{\u2014\u2013\u201c\u2018]/u.test(before);
    if (quote === '"') {
      // Straight where it cannot be a quotation mark in English: with space
      // (or the text's edge) on both sides, as French spaced quotes are
      // written (4.3 made " Bonjour " two closing quotes); and where it would
      // close no open quotation, as in width="100" (4.3 made the first one
      // closing) or after a number (5'10", 27"), as before.
      if ((!before || /\s/u.test(before)) && (!after || /\s/u.test(after))) put(quote);
      else if (opening && after && !/\s/u.test(after)) { doubleOpen = true; put('\u201c'); }
      else if (!doubleOpen) put(quote);
      else { doubleOpen = false; put('\u201d'); }
      continue;
    }
    const rest = text.slice(index + 1);
    if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) put('\u2019');
    else if (opening && (elision.test(rest) || (loose.test(rest) && !closesLater(index))
      || (/^n(?=['\u2019]?(?:\s|$))/iu.test(rest) && pairWordBefore(text, index)))) put('\u2019');
    else if (opening && after && !/\s/u.test(after)) { singleOpen = true; put('\u2018'); }
    else if (/\d/u.test(before) && !singleOpen) put(quote);
    else { singleOpen = false; put('\u2019'); }
  }
  return out;
}

export interface QuoteTransform { outcome: string; restore: () => void }

/** Whether quotes may be educated in text whose nearest lang is `tag`:
 * text declared English, in any spelling (en, en-GB, en_US), and, unless
 * `declared` (smartQuotes: 'en-declared'), untagged text. */
export function englishScope(tag: string | null | undefined, declared: boolean): boolean {
  const language = languageOf(tag);
  return language === 'en' || (!declared && language === 'und');
}

/** Same-length edits preserve source offsets, and restoration respects
 * external edits. `declared` educates only text an ancestor declares English
 * (smartQuotes: 'en-declared', the auto loader's default); otherwise
 * untagged text counts as English too. */
export function applySmartQuotes(element: HTMLElement, declared = false): QuoteTransform {
  const skip = 'code, pre, kbd, samp, input, textarea, script, style, [data-no-typeset], [contenteditable]:not([contenteditable="false"])';
  if (!englishScope(element.closest('[lang]')?.getAttribute('lang'), declared) || element.matches(skip) || element.querySelector(skip)
    || [...element.querySelectorAll('[lang]')].some(el => languageOf(el.getAttribute('lang')) !== 'en')) {
    return { outcome: 'native:quotes-scope', restore: () => {} };
  }
  const source = element.textContent || '';
  const educated = smartQuotes(source);
  const edits: { node: Text; source: string; output: string }[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  let offset = 0;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const output = educated.slice(offset, offset + text.length);
    offset += text.length;
    if (output !== text.data) { edits.push({ node: text, source: text.data, output }); text.data = output; }
  }
  return { outcome: edits.length ? 'applied' : 'unchanged', restore: () => {
    for (const edit of edits) if (element.contains(edit.node) && edit.node.data === edit.output) edit.node.data = edit.source;
  } };
}
