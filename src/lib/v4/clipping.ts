import { preservesAdvances } from './geometry';

interface Clip { left: number; top: number; bottom: number; topRadius: number; bottomRadius: number }
export interface HangingRoom { clips: Clip[]; supported: boolean }

/** Conservative rectangular clipping geometry. Never change author overflow. */
export function hangingRoom(element: HTMLElement): HangingRoom {
  const clips: Clip[] = [];
  for (let el: HTMLElement | null = element; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (!preservesAdvances(style) || style.clipPath !== 'none' || (style.clip && style.clip !== 'auto')
      || (style.maskImage && style.maskImage !== 'none')) return { clips, supported: false };
    const paint = /\b(paint|strict|content)\b/u.test(style.contain);
    if (style.overflowX === 'visible' && !paint) continue;
    const rect = el.getBoundingClientRect();
    const border = parseFloat(style.borderLeftWidth) || 0;
    let left = rect.left + Math.max(border, el.clientLeft);
    const top = rect.top + el.clientTop, bottom = top + el.clientHeight;
    const clipMargin = style.getPropertyValue('overflow-clip-margin').trim();
    if ((style.overflowX === 'clip' || paint) && clipMargin) {
      const values = clipMargin.split(/\s+/u);
      const edge = values.find(value => value.endsWith('-box')) || 'padding-box';
      const length = values.find(value => /^\d*\.?\d+px$/u.test(value));
      if (values.some(value => value !== edge && value !== length)) return { clips, supported: false };
      if (edge === 'content-box') left += parseFloat(style.paddingLeft) || 0;
      else if (edge === 'border-box') left -= border;
      left -= parseFloat(length || '0');
    }
    const radius = (value: string) => {
      const parts = value.split(/\s+/u);
      // A corner's bounding square is deliberately stricter than its ellipse.
      return Math.max(...parts.map(part => part.endsWith('%') ? parseFloat(part) / 100 * Math.max(rect.width, rect.height) : parseFloat(part) || 0));
    };
    clips.push({ left, top, bottom, topRadius: radius(style.borderTopLeftRadius), bottomRadius: radius(style.borderBottomLeftRadius) });
  }
  return { clips, supported: true };
}

export function fitsHangingRoom(room: HangingRoom, glyph: DOMRect, px: number, overhang = 0): boolean {
  return room.supported && room.clips.every(clip => {
    const corner = Math.max(glyph.top < clip.top + clip.topRadius ? clip.topRadius : 0,
      glyph.bottom > clip.bottom - clip.bottomRadius ? clip.bottomRadius : 0);
    return glyph.left - px - overhang >= clip.left + corner + .25;
  });
}
