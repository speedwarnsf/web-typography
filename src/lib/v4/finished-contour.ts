import type { ParagraphLine } from './typeset';
import { naturalSpace } from './spacing-finish';
import { finishSpaceDeltas } from './space-policy';

/** Measure once per paragraph, then rank all candidates without DOM writes. */
export function finishedContour(element: HTMLElement, words: readonly { index: number; text: string }[], measure: number): (lines: ParagraphLine[]) => number[] {
  const source = element.textContent || '';
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs: { start: number; end: number; node: Text }[] = [];
  let node: Node | null, offset = 0;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    runs.push({ start: offset, end: offset + text.length, node: text }); offset += text.length;
  }
  const cache = new Map<string, number>();
  const spaces = Array.from(source.matchAll(/[\t\n\r \u00a0\u202f]+/gu), match => {
    const run = runs.find(run => run.start <= match.index! && run.end > match.index!);
    const parent = run?.node.parentElement;
    const width = parent ? naturalSpace(element, getComputedStyle(parent), match[0].replace(/[\t\n\r ]+/g, ' '), cache) : 0;
    return { start: match.index!, end: match.index! + match[0].length, width };
  });
  return lines => {
    let cursor = 0;
    const gaps = lines.map(line => {
      const start = words[cursor].index;
      cursor += line.tokens.length;
      const last = words[cursor - 1], end = last.index + last.text.length;
      return spaces.filter(space => space.start >= start && space.end <= end).map(space => space.width);
    });
    const widths = lines.map(line => line.width);
    const deltas = finishSpaceDeltas(widths, measure, gaps);
    return widths.map((width, index) => (width + deltas[index].reduce((sum, delta) => sum + delta, 0)) / measure);
  };
}
