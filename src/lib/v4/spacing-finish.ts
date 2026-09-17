import type { LayoutMetrics } from './layout-metrics';
import { finishSpaceDeltas } from './space-policy';

export interface SpaceAdjustment { offset: number; px: number; naturalPx: number; line: number }
export interface SpacingPlan {
  outcome: string;
  adjustments: SpaceAdjustment[];
  before: LayoutMetrics;
}

const fontProperties = ['font-family', 'font-size', 'font-style', 'font-weight', 'font-stretch', 'font-variant',
  'font-feature-settings', 'font-variation-settings', 'font-optical-sizing', 'font-kerning', 'font-size-adjust',
  'font-synthesis', 'text-rendering', 'text-transform'] as const;

export function naturalSpace(element: HTMLElement, style: CSSStyleDeclaration, text: string, cache: Map<string, number>): number {
  const font = fontProperties.map(property => style.getPropertyValue(property));
  const key = JSON.stringify([font, text]);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const probe = element.ownerDocument.createElement('span');
  probe.dataset.tsProbe = '1'; probe.setAttribute('aria-hidden', 'true');
  const declarations: Record<string, string> = { position: 'fixed', display: 'inline-block', width: 'max-content', 'min-width': '0',
    'max-width': 'none', height: 'auto', margin: '0', padding: '0', border: '0', 'white-space': 'pre', 'word-spacing': '0',
    'letter-spacing': '0', visibility: 'hidden', transform: 'none', zoom: '1', 'text-indent': '0', 'text-size-adjust': 'none' };
  for (const [property, value] of Object.entries(declarations)) probe.style.setProperty(property, value, 'important');
  fontProperties.forEach((property, index) => probe.style.setProperty(property, font[index], 'important'));
  // WebKit rounds Range boxes around individual spaces. Average a run of
  // spaces in a layout box, with the real run's computed font features/axes.
  probe.textContent = text.repeat(32);
  element.ownerDocument.body.append(probe);
  let width: number;
  try { width = probe.getBoundingClientRect().width / 32; }
  finally { probe.remove(); }
  cache.set(key, width);
  return width;
}

/** Finish existing lines only. The V3 neighbor/median policy is unchanged;
 * each rich-text space gets a bound measured in its own styled context. */
export function planSpacingFinish(element: HTMLElement, layout: LayoutMetrics): SpacingPlan {
  const result = (outcome: string, adjustments: SpaceAdjustment[] = []): SpacingPlan => ({ outcome, adjustments, before: layout });
  const cs = getComputedStyle(element);
  if (!['left', 'start'].includes(cs.textAlign) || cs.direction !== 'ltr' || cs.writingMode !== 'horizontal-tb') return result('native:spacing-layout');
  if (layout.lines.length < 2 || !layout.width) return result('unchanged');
  const source = element.textContent || '';
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs: { node: Text; start: number; end: number }[] = [];
  let node: Node | null, offset = 0;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    runs.push({ node: text, start: offset, end: offset + text.length }); offset += text.length;
  }
  const point = (at: number, end = false) => runs.find(run => end ? run.start < at && run.end >= at : run.start <= at && run.end > at);
  const range = element.ownerDocument.createRange();
  const measuredSpaces = new Map<string, number>();
  const measured: { offset: number; naturalPx: number; available: number }[][] = [];
  for (const line of layout.lines.slice(0, -1)) {
    const spaces = Array.from(source.slice(line.sourceStart, line.sourceEnd).matchAll(/[\t\n\r \u00a0\u202f]+/gu));
    const gaps: typeof measured[number] = [];
    for (const space of spaces) {
      const start = line.sourceStart + space.index!, end = start + space[0].length;
      const a = point(start), b = point(end, true);
      if (!a || !b || !a.node.parentElement) return result('native:spacing-measurement');
      range.setStart(a.node, start - a.start); range.setEnd(b.node, end - b.start);
      const style = getComputedStyle(a.node.parentElement);
      const available = range.getBoundingClientRect().width;
      const natural = naturalSpace(element, style, space[0].replace(/[\t\n\r ]+/g, ' '), measuredSpaces);
      if (!Number.isFinite(natural) || natural <= 0 || natural > parseFloat(style.fontSize) * space[0].length) return result('native:spacing-measurement');
      gaps.push({ offset: end, naturalPx: natural, available });
    }
    measured.push(gaps);
  }
  const deltas = finishSpaceDeltas(layout.lines.map(line => line.width), layout.width, measured.map(gaps => gaps.map(gap => gap.naturalPx)));
  const adjustments: SpaceAdjustment[] = [];
  for (const [line, gaps] of measured.entries()) for (const [index, gap] of gaps.entries()) {
    const px = deltas[line][index];
    if (gap.available + px <= 0) return result('native:spacing-measurement');
    if (Math.abs(px) > .001) adjustments.push({ offset: gap.offset, naturalPx: gap.naturalPx, px, line });
  }
  return result(adjustments.length ? 'applied' : 'unchanged', adjustments);
}

/** Empty, noninteractive markers change advances, never source characters. */
export function spacingMarkerStyle(px: number): Record<string, string> {
  return { display: 'inline-block', position: 'static', float: 'none', width: '0px', height: '0px', minWidth: '0px', minHeight: '0px',
    margin: '0px', marginLeft: px + 'px', padding: '0px', border: '0px', boxShadow: 'none', outline: 'none', transform: 'none',
    fontSize: '0px', lineHeight: '0', verticalAlign: 'baseline', pointerEvents: 'none' };
}

export function spacingVerified(element: HTMLElement, plan: SpacingPlan, after: LayoutMetrics): boolean {
  for (const marker of element.querySelectorAll<HTMLElement>('[data-ts-space]')) {
    const box = marker.getBoundingClientRect();
    if (box.width > .01 || box.height > .01) return false;
    for (const pseudo of ['::before', '::after']) {
      const content = getComputedStyle(marker, pseudo).content;
      if (content && !['none', 'normal', '""'].includes(content)) return false;
    }
  }
  if (after.lines.length !== plan.before.lines.length || Math.abs(after.width - plan.before.width) > .5
    || after.overflow > Math.max(.5, plan.before.overflow)) return false;
  return after.lines.every((line, index) => {
    const before = plan.before.lines[index];
    const delta = plan.adjustments.filter(space => space.line === index).reduce((sum, space) => sum + space.px, 0);
    return line.sourceStart === before.sourceStart && line.sourceEnd === before.sourceEnd
      && Math.abs((line.top - after.lines[0].top) - (before.top - plan.before.lines[0].top)) <= .75
      && Math.abs(line.width - before.width - delta) <= .75;
  });
}
