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
  const width = contentWidth(element);
  const left = box.left + parseFloat(cs.borderLeftWidth || '0') + parseFloat(cs.paddingLeft || '0');
  const right = left + width;
  const lines: MeasuredLine[] = [];
  const source = element.textContent || '';
  const lineEnds = new Map<MeasuredLine, number>();
  let sourceOffset = 0;
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const range = element.ownerDocument.createRange();
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
