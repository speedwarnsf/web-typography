export interface ListStyleResult { styled: number; skipped: number; restore: () => void }
const owners = new WeakMap<HTMLUListElement, { count: number; hadClass: boolean; hadAttribute: boolean }>();

/** Explicit scope only. Load typeset.us/styles.css once; native markers retain semantics. */
export function styleProseLists(root: ParentNode): ListStyleResult {
  const lists = [...root.querySelectorAll<HTMLUListElement>('ul')];
  if (root instanceof HTMLUListElement) lists.unshift(root);
  const owned: HTMLUListElement[] = [];
  let skipped = 0;
  for (const list of lists) {
    const cs = getComputedStyle(list);
    const items = [...list.children];
    if (list.closest('nav, [role="navigation"], [role="menu"], [role="menubar"], [role="tablist"], [data-no-typeset]')
      || cs.display !== 'block' || cs.listStyleType === 'none' || cs.listStyleImage !== 'none'
      || !items.length || items.some(item => !(item instanceof HTMLElement) || item.tagName !== 'LI' || getComputedStyle(item).display !== 'list-item')) {
      skipped++; continue;
    }
    const owner = owners.get(list) || { count: 0, hadClass: list.classList.contains('ts-styled'), hadAttribute: list.hasAttribute('class') };
    owner.count++; owners.set(list, owner); list.classList.add('ts-styled'); owned.push(list);
  }
  let released = false;
  return { styled: owned.length, skipped, restore() {
    if (released) return;
    released = true;
    for (const list of owned) {
      const owner = owners.get(list)!;
      if (--owner.count === 0) {
        if (!owner.hadClass) { list.classList.remove('ts-styled'); if (!list.className && !owner.hadAttribute) list.removeAttribute('class'); }
        owners.delete(list);
      }
    }
  } };
}
