import { Children, Fragment, isValidElement } from 'react';
import type { ForwardedRef, ReactNode, Ref } from 'react';
import { contentWidth } from './layout-metrics';
import { BREAK_ATTRIBUTE } from './rich-text';

/** Value keys that decide whether a React adapter must recompose. A parent
 * re-render passes fresh arrays, style objects, JSX and callbacks with the same
 * values; comparing by value keeps those renders free. */

const json = (value: unknown): string => {
  try {
    return JSON.stringify(value, (_key, item) => typeof item === 'function' || typeof item === 'symbol'
      || (typeof Node === 'function' && item instanceof Node) ? undefined : item) ?? '';
  } catch { return String(Math.random()); }
};

/** Every prop except children, refs and callbacks, by value. */
export function propsKey(props: object): string {
  const { children: _children, ref: _ref, forwardedRef: _forwarded, ...rest } = props as Record<string, unknown>;
  return json(rest);
}

const typeIds = new WeakMap<object, number>();
let nextType = 0;
const typeName = (type: unknown): string => {
  if (typeof type === 'string') return type;
  if (type === Fragment) return '#fragment';
  if ((typeof type === 'object' || typeof type === 'function') && type) {
    if (!typeIds.has(type)) typeIds.set(type, ++nextType);
    return '#' + typeIds.get(type);
  }
  return '#' + String(type);
};

/** Text, element types, keys and non-callback props of a JSX tree, by value. */
export function childrenKey(children: ReactNode): string {
  const parts: string[] = [];
  const visit = (nodes: ReactNode) => Children.forEach(nodes, child => {
    if (child === null || child === undefined || typeof child === 'boolean') parts.push('_');
    else if (typeof child === 'string' || typeof child === 'number') parts.push(json(String(child)));
    else if (isValidElement<{ children?: ReactNode }>(child)) {
      const { children: nested, ...props } = child.props;
      parts.push('<' + typeName(child.type) + (child.key === null ? '' : '#' + json(child.key)) + json(props));
      visit(nested);
      parts.push('>');
    } else parts.push('?');
  });
  visit(children);
  return parts.join('');
}

const fontIds = new WeakMap<FontFace, number>();
// WebKit may collect and re-create the wrapper of a face nothing references,
// which a WeakMap would count as a new face: every key would change once.
const fontsSeen = new WeakMap<Document, FontFace[]>();
let nextFont = 0;
/** Every FontFace and its status. A face can be added already loaded, or
 * replaced while the set stays loaded, without any loading event. */
export function fontKey(doc: Document): string {
  const fonts = doc.fonts as FontFaceSet | undefined;
  if (!fonts) return '';
  const faces: string[] = [fonts.status], seen: FontFace[] = [];
  fonts.forEach(face => {
    if (!fontIds.has(face)) fontIds.set(face, ++nextFont);
    seen.push(face);
    faces.push(fontIds.get(face) + ':' + face.status);
  });
  fontsSeen.set(doc, seen);
  return faces.join('|');
}

/** Computed properties that move line breaks, for the host and each author
 * descendant, and the geometry of engine markers (so a style sheet that
 * reaches them is noticed and the finish re-verified). Colour, transforms and
 * other paint-only values are left out: they cannot change where a line ends. */
function typeKey(element: HTMLElement): string {
  return [element, ...element.querySelectorAll<HTMLElement>('*')].map(el => {
    const cs = getComputedStyle(el);
    if (el.hasAttribute(BREAK_ATTRIBUTE) || el.hasAttribute('data-ts-track')) {
      return [el.tagName, cs.display, cs.position, cs.visibility, cs.width, cs.marginInline, cs.paddingInline, cs.fontSize, cs.letterSpacing, cs.wordSpacing].join('|');
    }
    return [el.tagName, cs.font, cs.fontFeatureSettings, cs.fontVariationSettings, cs.fontOpticalSizing, cs.fontKerning, cs.fontVariant, cs.fontSizeAdjust,
      cs.fontSynthesis, cs.textRendering, cs.letterSpacing, cs.wordSpacing, cs.textTransform, cs.whiteSpace, cs.hyphens, cs.wordBreak, cs.lineBreak,
      cs.overflowWrap, el.getAttribute('lang'), cs.display, cs.direction, cs.unicodeBidi, cs.verticalAlign, cs.visibility, cs.paddingInline,
      cs.marginInline, cs.borderInlineWidth, getComputedStyle(el, '::before').content, getComputedStyle(el, '::after').content].join('|');
  }).join(';');
}

/** Everything a composed host's line breaks depend on, read without writing:
 * its text, its content width and its parent's, fonts, and the computed type
 * of the host and every author descendant. Ancestor attributes are not part of
 * it, only their effect on these values. */
export function layoutKey(element: HTMLElement, fonts = fontKey(element.ownerDocument)): string {
  const cs = getComputedStyle(element);
  return json([
    element.textContent, contentWidth(element), element.parentElement && contentWidth(element.parentElement), fonts,
    element.closest('[lang]')?.getAttribute('lang'), cs.textAlign, cs.textIndent, cs.textWrap, cs.getPropertyValue('-webkit-line-clamp'),
    cs.overflow, cs.textOverflow, cs.writingMode, typeKey(element),
  ]);
}

/** Set a caller's ref to `node`; returns the cleanup a React 19 callback ref gave, if any. */
export function assignRef(ref: Ref<HTMLElement> | ForwardedRef<HTMLElement> | undefined, node: HTMLElement | null): (() => void) | undefined {
  if (typeof ref === 'function') { const cleanup = (ref as (node: HTMLElement | null) => unknown)(node); return typeof cleanup === 'function' ? cleanup as () => void : undefined; }
  if (ref) (ref as { current: HTMLElement | null }).current = node;
}
