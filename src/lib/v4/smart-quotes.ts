/** English quote education only. No whitespace, dash, ellipsis, or length changes. */
export function smartQuotes(text: string): string {
  let doubleOpen = false;
  let singleOpen = false;
  return text.replace(/["'\u201c\u201d\u2018\u2019]/gu, (quote, index: number) => {
    if (quote === '\u201c') { doubleOpen = true; return quote; }
    if (quote === '\u201d') { doubleOpen = false; return quote; }
    if (quote === '\u2018') { singleOpen = true; return quote; }
    if (quote === '\u2019') return quote;
    const before = text[index - 1] || '';
    const after = text[index + 1] || '';
    const opening = !before || /[\s([{\u2014\u2013\u201c\u2018]/u.test(before);
    if (quote === '"') {
      if (opening && after && !/\s/u.test(after)) { doubleOpen = true; return '\u201c'; }
      if (/\d/u.test(before) && !doubleOpen) return quote;
      doubleOpen = false; return '\u201d';
    }
    if (/\p{L}/u.test(before) && /\p{L}/u.test(after)) return '\u2019';
    if (opening && /^(?:\d{2}s\b|tis\b|twas\b|em\b|cause\b|til\b)/iu.test(text.slice(index + 1))) return '\u2019';
    if (opening && after && !/\s/u.test(after)) { singleOpen = true; return '\u2018'; }
    if (/\d/u.test(before) && !singleOpen) return quote;
    singleOpen = false; return '\u2019';
  });
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
