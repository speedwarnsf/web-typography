/**
 * Descendants that paint no inline box: visually hidden text (the sr-only
 * pattern: position absolute or fixed, a box at most 1 px square that clips
 * its overflow, as Bootstrap, Tailwind and WordPress write it) and aria-hidden
 * elements with no width. Screen readers read the first and nothing reads
 * the second; neither takes room on a line. The outermost ones, in document
 * order; engine markers are never among them.
 */
export function hiddenInline(element: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const el of element.querySelectorAll<HTMLElement>('*')) {
    if (el.hasAttribute('data-ts-break') || el.hasAttribute('data-ts-track') || found.some(atom => atom.contains(el))) continue;
    if (paintsNothing(el)) found.push(el);
  }
  return found;
}

function paintsNothing(el: HTMLElement): boolean {
  if (el.getAttribute('aria-hidden') === 'true') return Array.from(el.getClientRects()).every(rect => rect.width === 0);
  const cs = getComputedStyle(el);
  if (cs.position !== 'absolute' && cs.position !== 'fixed') return false;
  const box = el.getBoundingClientRect();
  return box.width <= 1 && box.height <= 1 && ['hidden', 'clip'].includes(cs.overflowX) && ['hidden', 'clip'].includes(cs.overflowY);
}

/** Whether a node is inside one of `hidden` (see hiddenInline). */
export const withinHidden = (node: Node, hidden: readonly Element[]): boolean => hidden.some(el => el.contains(node));
