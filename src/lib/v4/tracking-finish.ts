import type { LayoutMetrics } from './layout-metrics';
import { preserveRichCopy, selectionBookmark } from './rich-text';
import type { RichOutput } from './rich-text';

export const TRACK_ATTRIBUTE = 'data-ts-track';
export const MAX_TRACKING_EM = .01;
export interface TrackingRun { start: number; end: number; line: number; px: number; fontSize: number; letterSpacing: number; wordSpacing: number }
export interface TrackingPlan { outcome: string; runs: TrackingRun[]; before: LayoutMetrics; targets: number[] }
interface TextRun { node: Text; start: number; end: number }
const resolvedSpacing = (value: string): number => value === 'normal' ? 0
  : /^-?(?:\d+\.?\d*|\.\d+)px$/u.test(value) ? parseFloat(value) : NaN;

function textRuns(element: HTMLElement): TextRun[] {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs: TextRun[] = [];
  let node: Node | null, offset = 0;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    runs.push({ node: text, start: offset, end: offset + text.length }); offset += text.length;
  }
  return runs;
}

/** A bounded residual finish: chosen breaks and existing word spaces stay fixed. */
export function planTrackingFinish(element: HTMLElement, layout: LayoutMetrics, targets: number[]): TrackingPlan {
  const result = (outcome: string, runs: TrackingRun[] = []): TrackingPlan => ({ outcome, runs, before: layout, targets });
  const style = getComputedStyle(element);
  if (style.direction !== 'ltr' || style.writingMode !== 'horizontal-tb' || !['left', 'start'].includes(style.textAlign)) return result('native:tracking-layout');
  const source = element.textContent || '', texts = textRuns(element);
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const runs: TrackingRun[] = [];
  let unsupported = false;
  for (const [line, box] of layout.lines.slice(0, -1).entries()) {
    const desired = targets[line] - box.width;
    if (!Number.isFinite(desired) || Math.abs(desired) < .25) continue;
    // Joining scripts need a script-specific policy; never space their letters apart.
    if ([...box.text].some(char => /\p{L}/u.test(char) && !/\p{Script=Latin}/u.test(char))) { unsupported = true; continue; }
    const pieces: (TrackingRun & { last: Text; count: number })[] = [];
    for (const text of texts) {
      const start = Math.max(box.sourceStart, text.start), end = Math.min(box.sourceEnd, text.end);
      if (end <= start || text.node.parentElement?.closest('code, kbd, samp')) continue;
      const parent = text.node.parentElement;
      if (!parent) continue;
      const cs = getComputedStyle(parent), fontSize = parseFloat(cs.fontSize);
      const letterSpacing = resolvedSpacing(cs.letterSpacing), wordSpacing = resolvedSpacing(cs.wordSpacing);
      if (!(fontSize > 0) || !Number.isFinite(letterSpacing) || !Number.isFinite(wordSpacing)) return result('native:tracking-measurement');
      const count = [...segmenter.segment(source.slice(start, end))].filter(part => !/^\s+$/u.test(part.segment)).length;
      const previous = pieces.at(-1);
      let adjacent: ChildNode | null = previous?.last.nextSibling || null;
      while (adjacent instanceof HTMLElement && adjacent.hasAttribute('data-ts-space')) adjacent = adjacent.nextSibling;
      if (previous && adjacent === text.node && previous.end === start) {
        previous.end = end; previous.count += count; previous.last = text.node;
      } else pieces.push({ start, end, line, px: 0, fontSize, letterSpacing, wordSpacing, last: text.node, count });
    }
    const capacity = pieces.reduce((sum, run) => sum + run.count * run.fontSize, 0);
    if (!capacity) continue;
    const em = Math.max(-MAX_TRACKING_EM, Math.min(MAX_TRACKING_EM, desired / capacity));
    for (const { last: _last, count, ...run } of pieces) if (count) runs.push({ ...run, px: run.fontSize * em });
  }
  if (runs.length > 256) return result('native:tracking-budget');
  return result(runs.length ? 'applied' : unsupported ? 'native:tracking-script' : 'unchanged', runs);
}

export function trackingStyle(run: TrackingRun): Record<string, string> {
  return { all: 'unset', display: 'inline', letterSpacing: run.letterSpacing + run.px + 'px',
    // CSS tracking also affects spaces. Compensate so the word-space finish
    // retains its measured 80-133% envelope instead of paying for tracking twice.
    wordSpacing: run.wordSpacing - run.px + 'px' };
}

/** Wrap contiguous text/engine-space runs only, never author elements. */
export function renderTracking(element: HTMLElement, plan: TrackingPlan): RichOutput {
  const restoreSelection = selectionBookmark(element), texts = textRuns(element);
  const splits = new Map<Text, Text[]>();
  const split = (head: Text, at: number) => {
    const tail = head.splitText(at), parts = splits.get(head) || [head];
    parts.splice(1, 0, tail); splits.set(head, parts); return tail;
  };
  for (const run of [...plan.runs].reverse()) {
    const a = texts.find(text => text.start <= run.start && text.end > run.start);
    const b = texts.find(text => text.start < run.end && text.end >= run.end);
    if (!a || !b || a.node.parentNode !== b.node.parentNode) continue;
    const end = run.end - b.start;
    if (end < b.node.length) split(b.node, end);
    const first = run.start > a.start ? split(a.node, run.start - a.start) : a.node;
    const last = a.node === b.node ? first : b.node;
    const wrapper = element.ownerDocument.createElement('span');
    wrapper.setAttribute(TRACK_ATTRIBUTE, String(run.start));
    Object.assign(wrapper.style, trackingStyle(run));
    first.before(wrapper);
    for (let node: ChildNode | null = first; node;) {
      const next: ChildNode | null = node.nextSibling;
      wrapper.append(node);
      if (node === last) break;
      node = next;
    }
  }
  restoreSelection();
  const releaseCopy = preserveRichCopy(element);
  return { nodes: [element], cleanup() {
    const restoreSelection = selectionBookmark(element);
    // Also unwrap engine spans copied by a framework replacement, retaining edits.
    element.querySelectorAll('[' + TRACK_ATTRIBUTE + ']').forEach(wrapper => wrapper.replaceWith(...wrapper.childNodes));
    for (const [head, parts] of splits) if (element.contains(head)) for (const part of parts.slice(1)) {
      if (head.nextSibling !== part) break;
      head.appendData(part.data); part.remove();
    }
    releaseCopy(); restoreSelection();
  } };
}

export function trackingVerified(element: HTMLElement, plan: TrackingPlan, after: LayoutMetrics): boolean {
  const wrappers = Array.from(element.querySelectorAll<HTMLElement>('[' + TRACK_ATTRIBUTE + ']'));
  if (wrappers.length !== plan.runs.length || after.lines.length !== plan.before.lines.length
    || Math.abs(after.width - plan.before.width) > .5 || after.overflow > Math.max(.5, plan.before.overflow)) return false;
  if (wrappers.some(wrapper => {
    const run = plan.runs.find(run => run.start === Number(wrapper.getAttribute(TRACK_ATTRIBUTE)));
    const cs = getComputedStyle(wrapper);
    return !run || Math.abs(parseFloat(cs.letterSpacing) - run.letterSpacing - run.px) > .001
      || Math.abs(parseFloat(cs.wordSpacing) - run.wordSpacing + run.px) > .001
      || cs.display !== 'inline' || cs.position !== 'static' || cs.visibility !== 'visible'
      || ['::before', '::after'].some(pseudo => !['none', 'normal', '""', ''].includes(getComputedStyle(wrapper, pseudo).content));
  })) return false;
  return after.lines.every((line, index) => {
    const before = plan.before.lines[index], adjusted = plan.runs.some(run => run.line === index);
    return line.sourceStart === before.sourceStart && line.sourceEnd === before.sourceEnd
      && Math.abs(line.left - before.left) <= .5 && Math.abs(line.top - before.top) <= .5 && Math.abs(line.bottom - before.bottom) <= .5
      && (adjusted ? Math.abs(plan.targets[index] - line.width) < Math.abs(plan.targets[index] - before.width) - .02
        : Math.abs(line.width - before.width) <= .5);
  });
}
