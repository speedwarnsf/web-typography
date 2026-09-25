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
/** The code point of `text` that starts at `index`, or the one that ends
 * just before it. */
function pointAt(text: string, index: number): string {
  const code = text.charCodeAt(index);
  return code >= 0xd800 && code <= 0xdbff && index + 1 < text.length && (text.charCodeAt(index + 1) & 0xfc00) === 0xdc00 ? text.slice(index, index + 2) : text[index];
}
function pointBefore(text: string, index: number): string {
  const code = text.charCodeAt(index - 1);
  return (code & 0xfc00) === 0xdc00 && index > 1 && (text.charCodeAt(index - 2) & 0xfc00) === 0xd800 ? text.slice(index - 2, index) : text[index - 1];
}
/**
 * Whether a closing single quote ends a later word of the same sentence:
 * for the quote at `index`, whether /[\p{L}\p{N}.,!?]['\u2019](?![\p{L}\p{N}])/u
 * matches the text after it up to the first /[.!?](?:\s|$)/u. Searching the
 * rest of the text for each 'round, 'bout or 'nuff cost the square of a text
 * with no sentence end, so each call resumes where the last left off: the
 * quotes are educated left to right, and neither the next sentence end nor
 * the next closing quote from a later start can come before the last ones.
 */
function laterCloser(text: string): (index: number) => boolean {
  let end = -1, close = -1, closeFrom = -1;
  const sentenceEnd = (at: number) => /[.!?]/u.test(text[at]) && (at + 1 === text.length || /\s/u.test(text[at + 1]));
  return index => {
    const from = index + 1;
    // The first sentence end at or after `from`, or text.length.
    if (end < from) for (end = from; end < text.length && !sentenceEnd(end); end++);
    // The first quote that closes a word starting at or after `from`, or text.length.
    if (closeFrom < from) {
      for (close = Math.max(close + 1, from + 1), closeFrom = Infinity; close < text.length; close++) {
        if (text[close] !== "'" && text[close] !== '\u2019') continue;
        const before = pointBefore(text, close);
        if (close - before.length < from || !/[\p{L}\p{N}.,!?]/u.test(before)) continue;
        if (close + 1 < text.length && /[\p{L}\p{N}]/u.test(pointAt(text, close + 1))) continue;
        closeFrom = close - before.length;
        break;
      }
    }
    return close < end;
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
  let closesLater: ((index: number) => boolean) | undefined;
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
      if (opening && after && !/\s/u.test(after)) { doubleOpen = true; put('\u201c'); }
      else if (/\d/u.test(before) && !doubleOpen) put(quote);
      else { doubleOpen = false; put('\u201d'); }
      continue;
    }
    const rest = text.slice(index + 1);
    if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) put('\u2019');
    else if (opening && (elision.test(rest) || (loose.test(rest) && !(closesLater ??= laterCloser(text))(index))
      || (/^n(?=['\u2019]?(?:\s|$))/iu.test(rest) && pairWordBefore(text, index)))) put('\u2019');
    else if (opening && after && !/\s/u.test(after)) { singleOpen = true; put('\u2018'); }
    else if (/\d/u.test(before) && !singleOpen) put(quote);
    else { singleOpen = false; put('\u2019'); }
  }
  return out;
}

export interface QuoteTransform { outcome: string; restore: () => void }

/** Same-length edits preserve source offsets, and restoration respects external edits. */
export function applySmartQuotes(element: HTMLElement): QuoteTransform {
  const skip = 'code, pre, kbd, samp, input, textarea, script, style, [data-no-typeset], [contenteditable]:not([contenteditable="false"])';
  const lang = element.closest('[lang]')?.getAttribute('lang');
  if ((lang && !/^en(?:-|$)/i.test(lang)) || element.matches(skip) || element.querySelector(skip)
    || [...element.querySelectorAll('[lang]')].some(el => !/^en(?:-|$)/i.test(el.getAttribute('lang') || ''))) {
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
