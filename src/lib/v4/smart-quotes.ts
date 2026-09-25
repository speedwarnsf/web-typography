/** Leading elisions: an apostrophe that opens a word stands for dropped
 * letters, not an opening quote ('90s, 'tis, 'em, rock 'n' roll, 'bout). */
const elision = /^(?:\d{2}s\b|tis\b|twas\b|em\b|cause\b|til\b|bout\b|round\b|nuff\b|n(?=['\u2019]?(?:\s|$)))/iu;

/** English quote education only. No whitespace, dash, ellipsis, or length
 * changes, and each quote keeps its kind: single quotes are never turned into
 * double quotes or the reverse. Idempotent. */
export function smartQuotes(text: string): string {
  let doubleOpen = false;
  let singleOpen = false;
  let out = '';
  for (let index = 0; index < text.length; index++) {
    const quote = text[index];
    if (!/["'\u201c\u201d\u2018\u2019]/u.test(quote)) { out += quote; continue; }
    if (quote === '\u201c') doubleOpen = true;
    else if (quote === '\u201d') doubleOpen = false;
    else if (quote === '\u2018') singleOpen = true;
    if (quote !== '"' && quote !== "'") { out += quote; continue; }
    // The character before, as already educated: a quote just curled open
    // opens the next one too ("'Quoted' inside," gives \u201c\u2018).
    const before = out[index - 1] || '';
    const after = text[index + 1] || '';
    const opening = !before || /[\s([{\u2014\u2013\u201c\u2018]/u.test(before);
    if (quote === '"') {
      if (opening && after && !/\s/u.test(after)) { doubleOpen = true; out += '\u201c'; }
      else if (/\d/u.test(before) && !doubleOpen) out += quote;
      else { doubleOpen = false; out += '\u201d'; }
      continue;
    }
    if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) out += '\u2019';
    else if (opening && elision.test(text.slice(index + 1))) out += '\u2019';
    else if (opening && after && !/\s/u.test(after)) { singleOpen = true; out += '\u2018'; }
    else if (/\d/u.test(before) && !singleOpen) out += quote;
    else { singleOpen = false; out += '\u2019'; }
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
