import { inlineBoxInsets } from './inline-box';

export interface MeasuredLine {
  text: string;
  sourceStart: number;
  sourceEnd: number;
  width: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  words: number;
}

export interface LayoutMetrics {
  lines: MeasuredLine[];
  width: number;
  overflow: number;
  firstSingleton: boolean;
  lastSingleton: boolean;
  rag: number;
}

export function contentWidth(element: HTMLElement): number {
  const cs = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return Math.max(0, rect.width - parseFloat(cs.paddingLeft || '0')
    - parseFloat(cs.paddingRight || '0') - parseFloat(cs.borderLeftWidth || '0')
    - parseFloat(cs.borderRightWidth || '0'));
}

/** Read real line boxes, including native and fallback text. No DOM writes. */
export function measureLayout(element: HTMLElement): LayoutMetrics {
  const cs = getComputedStyle(element);
  const box = element.getBoundingClientRect();
  const width = Math.max(0, box.width - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0')
    - parseFloat(cs.borderLeftWidth || '0') - parseFloat(cs.borderRightWidth || '0'));
  const left = box.left + parseFloat(cs.borderLeftWidth || '0') + parseFloat(cs.paddingLeft || '0');
  const right = left + width;
  const lines: MeasuredLine[] = [];
  if (cs.display !== 'contents' && !element.getClientRects().length) {
    return { lines, width, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 };
  }
  const source = element.textContent || '';
  const lineEnds = new Map<MeasuredLine, number>();
  let sourceOffset = 0;
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = element.ownerDocument.createRange();
  // A single rendered run needs one Range read, not one read per word.
  // Multiline and styled text continue through the full fragment mapper.
  if (element.childNodes.length === 1 && element.firstChild?.nodeType === Node.TEXT_NODE
    && source.trim() && !element.closest('script, style, [hidden], [aria-hidden="true"]')) {
    const start = source.search(/\S/u), end = source.trimEnd().length;
    range.setStart(element.firstChild, start); range.setEnd(element.firstChild, end);
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
    if (rects.length === 1) {
      const rect = rects[0], text = source.slice(start, end).replace(/\s+/gu, ' ');
      return { width, lines: [{ text, sourceStart: start, sourceEnd: end, words: text.split(' ').length,
        width: rect.width, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }],
        overflow: Math.max(0, rect.right - right, left - rect.left), firstSingleton: false, lastSingleton: false, rag: 0 };
    }
  }
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const nodeOffset = sourceOffset;
    sourceOffset += node.textContent?.length || 0;
    if (node.parentElement?.closest('script, style, [hidden], [aria-hidden="true"]')) continue;
    for (const match of (node.textContent || '').matchAll(/\S+/gu)) {
      range.setStart(node, match.index!);
      range.setEnd(node, match.index! + match[0].length);
      const rects = Array.from(range.getClientRects()).filter(r => r.height > 0 && r.width > 0);
      const fragments: { text: string; rect: DOMRect }[] = rects.length < 2
        ? rects.map(rect => ({ text: match[0], rect })) : [];
      if (rects.length > 1) {
        // A browser may split a hyphenated word. Attribute each grapheme to
        // its actual line instead of counting the entire word on both lines.
        for (const part of segmenter.segment(match[0])) {
          range.setStart(node, match.index! + part.index);
          range.setEnd(node, match.index! + part.index + part.segment.length);
          // WebKit includes a zero-width caret on the previous line at a
          // wrap boundary; its union box incorrectly spans both lines.
          const rect = Array.from(range.getClientRects()).find(r => r.width > 0 && r.height > 0);
          if (!rect) continue;
          const previous = fragments.at(-1);
          if (previous && Math.min(previous.rect.bottom, rect.bottom) - Math.max(previous.rect.top, rect.top) > rect.height * .5) {
            previous.text += part.segment;
            const left = Math.min(previous.rect.left, rect.left);
            const top = Math.min(previous.rect.top, rect.top);
            previous.rect = new DOMRect(left, top, Math.max(previous.rect.right, rect.right) - left, Math.max(previous.rect.bottom, rect.bottom) - top);
          } else fragments.push({ text: part.segment, rect });
        }
      }
      let fragmentOffset = nodeOffset + match.index!;
      for (const { rect, text } of fragments) {
        // Vertical overlap groups inline emphasis of a different font size
        // without relying on exact, rounded glyph tops.
        let line = lines.find(l =>
          Math.min(l.bottom, rect.bottom) - Math.max(l.top, rect.top)
            > Math.min(l.bottom - l.top, rect.height) * 0.5);
        if (!line) {
          line = { text: '', sourceStart: fragmentOffset, sourceEnd: fragmentOffset, words: 0, width: 0, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
          lines.push(line);
        }
        const previousEnd = lineEnds.get(line);
        const gap = previousEnd === undefined ? '' : source.slice(previousEnd, fragmentOffset);
        line.text += (line.text && /\s/u.test(gap) ? ' ' : '') + text;
        fragmentOffset += text.length;
        line.sourceEnd = fragmentOffset;
        lineEnds.set(line, fragmentOffset);
        line.words = line.text.trim().split(/\s+/u).length;
        line.left = Math.min(line.left, rect.left);
        line.right = Math.max(line.right, rect.right);
        line.top = Math.min(line.top, rect.top);
        line.bottom = Math.max(line.bottom, rect.bottom);
        line.width = line.right - line.left;
      }
    }
  }
  // A text Range omits padding/borders at inline fragment edges. Include
  // those real boxes so composition and overflow checks account for code chips.
  for (const inline of element.querySelectorAll<HTMLElement>('*')) {
    if (inline.hasAttribute('data-ts-break') || inline.closest('[hidden], [aria-hidden="true"]')) continue;
    const style = getComputedStyle(inline);
    if (style.display !== 'inline') continue;
    const insets = inlineBoxInsets(style);
    if (!insets.left && !insets.right) continue;
    const rects = Array.from(inline.getClientRects()).filter(rect => rect.width && rect.height);
    for (const [index, rect] of rects.entries()) {
      const line = lines.reduce<MeasuredLine | undefined>((best, candidate) => {
        const overlap = Math.min(candidate.bottom, rect.bottom) - Math.max(candidate.top, rect.top);
        const bestOverlap = best ? Math.min(best.bottom, rect.bottom) - Math.max(best.top, rect.top) : 0;
        return overlap > bestOverlap ? candidate : best;
      }, undefined);
      if (!line) continue;
      line.left = Math.min(line.left, rect.left - (index === 0 ? insets.marginLeft : 0));
      line.right = Math.max(line.right, rect.right + (index === rects.length - 1 ? insets.marginRight : 0));
      line.width = line.right - line.left;
    }
  }
  lines.sort((a, b) => a.top - b.top);
  const fills = lines.map(l => width > 0 ? l.width / width : 0);
  const hangs = Array.from(element.querySelectorAll<HTMLElement>(':scope > .ts-line'))
    .map(el => Math.min(0, parseFloat(getComputedStyle(el).textIndent) || 0));
  const optical = new Map(Array.from(element.querySelectorAll<HTMLElement>('[data-ts-break][data-ts-hang]'))
    .filter(el => getComputedStyle(el).display !== 'none')
    .map(el => [Number(el.dataset.tsHang), Math.min(0, parseFloat(getComputedStyle(el).marginLeft) || 0)]));
  const mean = fills.reduce((a, b) => a + b, 0) / Math.max(1, fills.length);
  return {
    lines, width,
    // Old Typeset intentionally hangs punctuation/capitals into the margin.
    // Do not mislabel its documented optical indent as an A/B overflow win.
    overflow: Math.max(0, ...lines.flatMap((l, i) => [l.right - right, left + (hangs[i] || optical.get(l.sourceStart) || 0) - l.left])),
    firstSingleton: lines.length > 1 && lines[0].words === 1,
    lastSingleton: lines.length > 1 && lines[lines.length - 1].words === 1,
    rag: fills.reduce((sum, f) => sum + (f - mean) ** 2, 0) / Math.max(1, fills.length),
  };
}
