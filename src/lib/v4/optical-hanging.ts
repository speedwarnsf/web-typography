import type { LayoutMetrics } from './layout-metrics';
import { opticalInkPull, opticalInkOverhang } from './optical-ink';
import { spacingMarkerStyle } from './spacing-finish';
import { hangingRoom, fitsHangingRoom } from './clipping';

export interface OpticalHang { offset: number; px: number; overhang?: number }
export interface OpticalPlan { outcome: string; hangs: OpticalHang[] }
const punctuation = new Set(['\u201c', '\u2018', '"', "'", '(', '[', '{', '\u00ab', '\u00bf', '\u00a1']);
const opticalLetters = /^[A-Zoc]$/;

/** Optical alignment is a rendering pass, never an extra line-breaking allowance. */
export function planOpticalHanging(element: HTMLElement, layout: LayoutMetrics): OpticalPlan {
  const cs = getComputedStyle(element);
  if (cs.direction !== 'ltr' || cs.writingMode !== 'horizontal-tb' || !['left', 'start'].includes(cs.textAlign)
    || cs.textIndent !== '0px') return { outcome: 'native:hanging-layout', hangs: [] };
  const room = hangingRoom(element);
  if (!room.supported) return { outcome: 'native:hanging-clipped', hangs: [] };
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
  let clipped = 0;
  const hangs = layout.lines.flatMap(line => {
    const run = runs.find(r => r.start <= line.sourceStart && r.end > line.sourceStart);
    if (!run) return [];
    const local = line.sourceStart - run.start;
    const char = run.node.data[local];
    const style = getComputedStyle(run.node.parentElement!);
    range.setStart(run.node, local); range.setEnd(run.node, local + 1);
    const glyph = range.getBoundingClientRect();
    const advance = glyph.width;
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
    if (!(px > 0 && Number.isFinite(px))) return [];
    let overhang: number | null = 0;
    if (room.clips.length) {
      const text = run.node.data.slice(local).match(/^\S{1,64}(?=\s|$)/u)?.[0] || char;
      range.setEnd(run.node, local + text.length);
      const contextualAdvance = range.getBoundingClientRect().width;
      const transformed = style.textTransform === 'uppercase' ? text.toUpperCase() : style.textTransform === 'lowercase' ? text.toLowerCase() : text;
      overhang = opticalInkOverhang(element.ownerDocument, style, displayed, advance, { text: transformed, advance: contextualAdvance });
    }
    if (overhang === null) { unmeasurable = true; return []; }
    if (!fitsHangingRoom(room, glyph, px, overhang)) { clipped++; return []; }
    return [{ offset: line.sourceStart, px, overhang }];
  });
  return unmeasurable ? { outcome: 'native:hanging-font', hangs: [] }
    : { outcome: hangs.length ? clipped ? 'applied:partial' : 'applied' : clipped ? 'native:hanging-clipped' : 'unchanged', hangs };
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
  const room = hangingRoom(element);
  if (!room.supported || after.lines.some(line => {
    const hang = hangs.find(hang => hang.offset === line.sourceStart);
    return hang && !fitsHangingRoom(room, new DOMRect(line.left, line.top, line.width, line.bottom - line.top), 0, hang.overhang);
  })) return false;
  return after.lines.every((line, index) => {
    const previous = before.lines[index], hang = hangs.find(hang => hang.offset === previous.sourceStart)?.px || 0;
    return line.sourceStart === previous.sourceStart && line.sourceEnd === previous.sourceEnd
      && Math.abs(line.width - previous.width) <= .75
      && Math.abs(line.left + hang - previous.left) <= .75
      && Math.abs(line.top - previous.top) <= .75;
  });
}
