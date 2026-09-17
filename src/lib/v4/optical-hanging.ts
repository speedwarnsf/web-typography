import type { LayoutMetrics } from './layout-metrics';
import { opticalInkPull } from './optical-ink';
import { spacingMarkerStyle } from './spacing-finish';

export interface OpticalHang { offset: number; px: number }
export interface OpticalPlan { outcome: string; hangs: OpticalHang[] }
const punctuation = new Set(['\u201c', '\u2018', '"', "'", '(', '[', '{', '\u00ab', '\u00bf', '\u00a1']);
const opticalLetters = /^[A-Zoc]$/;

/** Optical alignment is a rendering pass, never an extra line-breaking allowance. */
export function planOpticalHanging(element: HTMLElement, layout: LayoutMetrics): OpticalPlan {
  const cs = getComputedStyle(element);
  if (cs.direction !== 'ltr' || cs.writingMode !== 'horizontal-tb' || !['left', 'start'].includes(cs.textAlign)
    || cs.textIndent !== '0px') return { outcome: 'native:hanging-layout', hangs: [] };
  for (let el: HTMLElement | null = element; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (style.overflowX !== 'visible' || style.clipPath !== 'none' || style.transform !== 'none') {
      return { outcome: 'native:hanging-clipped', hangs: [] };
    }
  }
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const runs: { node: Text; start: number; end: number }[] = [];
  let node: Node | null;
  let offset = 0;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    runs.push({ node: text, start: offset, end: offset + text.length }); offset += text.length;
  }
  const range = element.ownerDocument.createRange();
  const cache = new Map<string, number | null>();
  let unmeasurable = false;
  const hangs = layout.lines.flatMap(line => {
    const run = runs.find(r => r.start <= line.sourceStart && r.end > line.sourceStart);
    if (!run) return [];
    const local = line.sourceStart - run.start;
    const char = run.node.data[local];
    const style = getComputedStyle(run.node.parentElement!);
    range.setStart(run.node, local); range.setEnd(run.node, local + 1);
    const advance = range.getBoundingClientRect().width;
    const displayed = style.textTransform === 'uppercase' ? char.toUpperCase() : style.textTransform === 'lowercase' ? char.toLowerCase() : char;
    let px = punctuation.has(char) ? advance : 0;
    if (!punctuation.has(char) && opticalLetters.test(displayed)) {
      const key = JSON.stringify([style.font, style.fontFamily, style.fontSize, style.fontWeight, style.fontStretch,
        style.fontStyle, style.fontKerning, style.letterSpacing, style.fontFeatureSettings, style.fontVariationSettings, displayed, advance]);
      if (!cache.has(key)) cache.set(key, opticalInkPull(element.ownerDocument, style, displayed, advance));
      const pull = cache.get(key)!;
      if (pull === null) unmeasurable = true;
      else px = pull;
    }
    return px > 0 && Number.isFinite(px) ? [{ offset: line.sourceStart, px }] : [];
  });
  return unmeasurable ? { outcome: 'native:hanging-font', hangs: [] } : { outcome: hangs.length ? 'applied' : 'unchanged', hangs };
}

export function opticalMarkerStyle(px: number): Record<string, string> {
  return spacingMarkerStyle(-px);
}

export function opticalVerified(element: HTMLElement, before: LayoutMetrics, after: LayoutMetrics, hangs: OpticalHang[]): boolean {
  const markers = Array.from(element.querySelectorAll<HTMLElement>('[data-ts-hang]'));
  if (markers.length !== hangs.length || before.lines.length !== after.lines.length || after.overflow > .5) return false;
  if (markers.some(marker => {
    const box = marker.getBoundingClientRect();
    const style = getComputedStyle(marker);
    return style.position !== 'static' || style.float !== 'none' || box.width > .01 || box.height > .01 || ['::before', '::after'].some(pseudo => {
      const content = getComputedStyle(marker, pseudo).content;
      return content && !['none', 'normal', '""'].includes(content);
    });
  })) return false;
  return after.lines.every((line, index) => {
    const previous = before.lines[index], hang = hangs.find(hang => hang.offset === previous.sourceStart)?.px || 0;
    return line.sourceStart === previous.sourceStart && line.sourceEnd === previous.sourceEnd
      && Math.abs(line.width - previous.width) <= .75
      && Math.abs(line.left + hang - previous.left) <= .75
      && Math.abs(line.top - previous.top) <= .75;
  });
}
