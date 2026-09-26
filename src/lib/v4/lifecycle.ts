/** Document-level lifecycle signals, shared by every controller and adapter in
 * a document: one set of listeners however many blocks are mounted. */

export interface LifecycleClient {
  /** A font face finished loading, or the font set settled. */
  fonts?(): void;
  /** The window resized, or printing ended. Runs before the frame's layout. */
  resize?(): void;
  /** A transition or animation of text metrics, or of a transform, ended on `target`. */
  metrics?(target: Element): void;
  /** A stylesheet was added, removed, edited or switched. */
  styles?(): void;
  /** A content-visibility:auto subtree under `target` stopped being skipped. */
  visibility?(target: Element): void;
  /** Machine translation of the document started or ended. */
  translation?(active: boolean): void;
}

interface Hub { clients: Set<LifecycleClient>; faces: WeakSet<FontFace>; ready: boolean; translated: boolean; classed: boolean; stop: () => void }
const hubs = new WeakMap<Document, Hub>();
// On the document itself, so every engine copy on a page (a loader script and
// a bundled React adapter, say) sees a translator's mark.
const LATCH = Symbol.for('typeset.us:translated');
const latched = {
  has: (doc: Document) => !!(doc as unknown as Record<symbol, boolean>)[LATCH],
  add: (doc: Document) => { (doc as unknown as Record<symbol, boolean>)[LATCH] = true; },
  delete: (doc: Document) => { delete (doc as unknown as Record<symbol, boolean>)[LATCH]; },
};

function translatedClass(doc: Document): boolean {
  const list = doc.documentElement?.classList;
  return !!list && (list.contains('translated-ltr') || list.contains('translated-rtl'));
}

/** Google Translate and Chrome's built-in translation mark the root element;
 * Edge marks the nodes it rewrites, and translators wrap text in <font>
 * (markTranslated). Translators segment text at element boundaries and hold
 * references to the Text nodes they fill, so composition steps aside. */
export function translationActive(doc: Document): boolean {
  return latched.has(doc) || translatedClass(doc);
}
// Transforms too: text declined as transformed mid-transition composes once it ends.
const metric = /^(?:font|letter-spacing|word-spacing|line-height|text-transform|text-indent|tab-size|transform$|scale$|rotate$|zoom$)/u;

/** A <style> element or a stylesheet <link>; with `holding`, also an
 * element added or removed with one inside. */
function sheetNode(node: Node | null, holding = false): boolean {
  if (node?.nodeType !== 1) return false;
  const el = node as Element;
  return el.localName === 'style' || (el.localName === 'link' && /(?:^|\s)stylesheet(?:\s|$)/iu.test(el.getAttribute('rel') || ''))
    || (holding && !!el.querySelector?.('style, link[rel~="stylesheet" i]'));
}
/** Whether a mutation in <head> can change how text is laid out: a
 * stylesheet added, removed, edited or switched. A ticking <title>, an
 * injected <script> or <meta>, a preconnect or a favicon badge's href moves
 * nothing, and rechecking every block for each cost continuous main-thread
 * time. The registry's own MutationObserver uses the same test. */
export function styleMutation(record: MutationRecord): boolean {
  if (record.type === 'characterData') return record.target.parentElement?.localName === 'style';
  if (record.type === 'childList') return sheetNode(record.target) || [...record.addedNodes, ...record.removedNodes].some(node => sheetNode(node, true));
  // media, disabled, href or rel on a stylesheet, or rel switched away from one.
  return sheetNode(record.target) || (record.attributeName === 'rel' && /(?:^|\s)stylesheet(?:\s|$)/iu.test(record.oldValue || ''));
}

function notify(hub: Hub, call: (client: LifecycleClient) => void): void {
  for (const client of [...hub.clients]) call(client);
}

/** A translator's mark inside composed text: a <font> wrapper or an Edge
 * _msttexthash attribute. Holds until the root's translation class goes. */
export function markTranslated(doc: Document): void {
  if (latched.has(doc)) return;
  latched.add(doc);
  const hub = hubs.get(doc);
  if (hub && !hub.translated) { hub.translated = true; notify(hub, client => client.translation?.(true)); }
}

/** Whether a style attribute changed only by a translation (the transform or
 * translate property) or opacity: a JavaScript animation (a screen push,
 * parallax, a smooth-scroll wrapper) writes one every frame, and none of them
 * moves a line. A scale, rotation or any other declaration is a real change. */
export function movedOnly(before: string | null, after: string | null): boolean {
  const declarations = (text: string | null) => new Map((text || '').split(';').map(part => part.trim()).filter(Boolean)
    .map(part => { const at = part.indexOf(':'); return at < 0 ? [part, ''] : [part.slice(0, at).trim().toLowerCase(), part.slice(at + 1).trim()]; }));
  const a = declarations(before), b = declarations(after);
  for (const name of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(name) === b.get(name) || name === 'opacity' || name === 'translate') continue;
    if (name === 'transform' && [a.get(name), b.get(name)].every(value => value === undefined || /^(?:none|(?:translate(?:3d|x|y|z)?\([^()]*\)\s*)+)$/iu.test(value))) continue;
    return false;
  }
  return true;
}
/** Printing (or print emulation) lays text out at the paper's width, where
 * print CSS shows native wrapping; composing for it is wasted work. */
const prints = new WeakMap<Document, MediaQueryList | undefined>();
export function printing(doc: Document): boolean {
  if (!prints.has(doc)) prints.set(doc, doc.defaultView?.matchMedia?.('print'));
  return !!prints.get(doc)?.matches;
}

/** Whether an element's text is laid out now: it has boxes and is not in a
 * skipped content-visibility subtree. Measuring anything else is guesswork. */
export function rendered(element: Element): boolean {
  if (!element.getClientRects().length) return getComputedStyle(element).display === 'contents';
  const check = (element as Element & { checkVisibility?: (options: object) => boolean }).checkVisibility;
  return typeof check !== 'function' || check.call(element, { contentVisibilityAuto: true });
}

/** Watches whether elements are within a viewport height of what shows them. */
export interface NearObserver { observe(element: Element): void; unobserve(element: Element): void; disconnect(): void }
/** IntersectionObservers that report an element within a viewport height of
 * what shows it: the window, or the nearest container it scrolls in
 * vertically that hides it (its box lies wholly above or below the
 * container's client area). An app shell's overflow:auto pane clips its
 * content, and a root margin on the window does not reach past that clip,
 * so text below the fold there was never near until it was on screen. One
 * observer per scrollport, held only while it observes something, so a
 * scroll container a route removed is not kept alive.
 * Null without IntersectionObserver. */
export function nearObserver(doc: Document, callback: (entries: IntersectionObserverEntry[]) => void): NearObserver | null {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (!view || typeof view.IntersectionObserver !== 'function') return null;
  const observers = new Map<Element | null, { observer: IntersectionObserver; targets: Set<Element> }>();
  // Where each element is observed: its scrollport (null: the window), and
  // the containers below that which could scroll it vertically but did not
  // hide it when it was placed. Found once, and again only when one of
  // those containers hides it.
  const places = new WeakMap<Element, { root: Element | null; waiting: Element[] }>();
  // The observed elements waiting on each such container.
  const waiters = new Map<Element, Set<Element>>();
  let queued = false;
  // Only a container that scrolls vertically: nearness is a vertical
  // distance. And only one that hides the text: an overflow-x:hidden
  // wrapper (its overflow-y computes to auto) as tall as the page, or a
  // horizontal carousel row, would make every block in it near, however far
  // below the fold, and those compose in animation frames during a screen
  // push. A transform makes either overflow (a reveal library's translateY,
  // a card's entrance animation) without hiding any text in it. A pane that
  // hides nothing yet (FAQ answers in closed <details>, a list still
  // loading) may later, and the text is placed again when that is seen.
  const scrolls = (node: Element) => /^(?:auto|scroll|overlay)$/u.test(view.getComputedStyle(node).overflowY);
  // The pane's client area in viewport coordinates, or null when its
  // content does not overflow it (so it hides nothing).
  const area = (pane: Element) => {
    if (pane.scrollHeight <= pane.clientHeight + 1) return null;
    const frame = pane.getBoundingClientRect(), height = (pane as HTMLElement).offsetHeight;
    const scale = height ? frame.height / height : 1, top = frame.top + pane.clientTop * scale;
    return { top, bottom: top + pane.clientHeight * scale };
  };
  // The vertical translation an element's box carries relative to `pane`:
  // transform or translate on it or an ancestor below the pane.
  const lift = (element: Element, pane: Element) => {
    let y = 0;
    for (let node: Element | null = element; node && node !== pane; node = node.parentElement) {
      const style = view.getComputedStyle(node);
      const matrix = /^matrix(3d)?\(([^)]*)\)$/u.exec(style.transform);
      if (matrix) y += parseFloat(matrix[2].split(',')[matrix[1] ? 13 : 5]) || 0;
      const shift = (style.translate || '').split(/\s+/u)[1];
      if (shift) y += shift.endsWith('%') ? parseFloat(shift) / 100 * ((node as HTMLElement).offsetHeight || 0) : parseFloat(shift) || 0;
    }
    return y;
  };
  // Whether the pane hides the element: its box, less any translation (which
  // moves no line), lies wholly outside the pane's client area. An element
  // with no box yet (in a closed <details>) is not hidden.
  const hides = (pane: Element, bounds: { top: number; bottom: number }, element: Element) => {
    const box = element.getBoundingClientRect();
    if ((!box.width && !box.height) || (box.bottom > bounds.top + .5 && box.top < bounds.bottom - .5)) return false;
    const y = lift(element, pane);
    return box.bottom - y <= bounds.top + .5 || box.top - y >= bounds.bottom - .5;
  };
  const place = (element: Element) => {
    const waiting: Element[] = [];
    for (let node = element.parentElement; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
      if (!scrolls(node)) continue;
      const bounds = area(node);
      if (bounds && hides(node, bounds, element)) return { root: node, waiting };
      waiting.push(node);
    }
    return { root: null, waiting };
  };
  const add = (element: Element) => {
    const at = places.get(element)!;
    let entry = observers.get(at.root);
    if (!entry) { entry = { observer: new view.IntersectionObserver(notify, { root: at.root, rootMargin: '100% 0px' }), targets: new Set() }; observers.set(at.root, entry); }
    entry.observer.observe(element);
    entry.targets.add(element);
    for (const pane of at.waiting) { let set = waiters.get(pane); if (!set) waiters.set(pane, set = new Set()); set.add(element); }
  };
  const release = (element: Element) => {
    const at = places.get(element);
    const entry = at && observers.get(at.root);
    if (!at || !entry) return;
    entry.observer.unobserve(element);
    entry.targets.delete(element);
    // The window's observer stays; a scroll container's goes with its last target.
    if (at.root && !entry.targets.size) { entry.observer.disconnect(); observers.delete(at.root); }
    for (const pane of at.waiting) { const set = waiters.get(pane); set?.delete(element); if (set && !set.size) waiters.delete(pane); }
  };
  // Whether a container observed elements wait on hides any of them now:
  // reads only, all together after the calls that asked (a commit, a
  // mutation batch, an intersection change), so no read follows a write;
  // then the hidden ones are placed again.
  const recheck = () => {
    queued = false;
    const moving = new Set<Element>();
    for (const [pane, set] of waiters) {
      const bounds = area(pane);
      if (bounds) for (const element of set) if (!moving.has(element) && hides(pane, bounds, element)) moving.add(element);
    }
    for (const element of moving) { release(element); places.set(element, place(element)); add(element); }
  };
  const later = () => { if (!queued && waiters.size) { queued = true; queueMicrotask(recheck); } };
  // An intersection change is when text in a pane that just overflowed
  // (content added above it) drops out of view: check the panes then too.
  function notify(entries: IntersectionObserverEntry[]) { callback(entries); later(); }
  return {
    observe(element) {
      const placed = places.has(element);
      if (!placed) places.set(element, place(element));
      add(element);
      // Observed again (a recheck, a reveal, new text): a pane it waits on may hide it now.
      if (placed) later();
    },
    unobserve(element) { release(element); },
    disconnect() { for (const entry of observers.values()) entry.observer.disconnect(); observers.clear(); waiters.clear(); },
  };
}

/** Re-arm font notifications. WebKit fires no loading events for fonts a
 * stylesheet requests, so every face still loading is watched directly. */
export function armFonts(doc: Document): void {
  const hub = hubs.get(doc);
  if (!hub) return;
  const settled = () => { if (hubs.get(doc) === hub) notify(hub, client => client.fonts?.()); };
  // document.fonts is missing in DOM emulations and some older engines.
  const fonts = doc.fonts as FontFaceSet | undefined;
  if (!fonts) return;
  if (fonts.status === 'loading' && !hub.ready) {
    hub.ready = true;
    fonts.ready.then(() => { hub.ready = false; settled(); });
  }
  fonts.forEach(face => {
    if (face.status !== 'loading' || hub.faces.has(face)) return;
    hub.faces.add(face);
    face.loaded.then(settled, settled);
  });
}

function start(doc: Document): Hub {
  const view = doc.defaultView;
  const hub: Hub = { clients: new Set(), faces: new WeakSet(), ready: false, translated: translationActive(doc), classed: translatedClass(doc), stop: () => {} };
  const resize = () => notify(hub, client => client.resize?.());
  const fonts = () => { notify(hub, client => client.fonts?.()); armFonts(doc); };
  const loading = () => armFonts(doc);
  const ended = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1) return;
    if (event.type === 'animationend' || metric.test((event as TransitionEvent).propertyName || '')) notify(hub, client => client.metrics?.(target));
  };
  const visibility = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.nodeType === 1 && !(event as Event & { skipped?: boolean }).skipped) notify(hub, client => client.visibility?.(target));
  };
  // Stylesheets arrive and switch without touching composed text: a late
  // @font-face, a text-spacing bookmarklet, a theme <link media>.
  const observer = new MutationObserver(records => {
    let styles = false, rootClass = false;
    for (const record of records) {
      if (record.target === doc.documentElement && record.type === 'attributes') rootClass = true;
      else if (styleMutation(record)) styles = true;
    }
    if (rootClass) {
      const classed = translatedClass(doc);
      // "Show original" removes the class; that ends a latched translation too.
      if (hub.classed && !classed) latched.delete(doc);
      hub.classed = classed;
      const now = translationActive(doc);
      if (now !== hub.translated) { hub.translated = now; notify(hub, client => client.translation?.(now)); }
    }
    if (styles) { notify(hub, client => client.styles?.()); armFonts(doc); }
  });
  if (doc.documentElement) observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
  if (doc.head) observer.observe(doc.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeOldValue: true, attributeFilter: ['media', 'disabled', 'href', 'rel'] });
  const faces = doc.fonts as FontFaceSet | undefined;
  faces?.addEventListener?.('loadingdone', fonts);
  faces?.addEventListener?.('loading', loading);
  doc.addEventListener('transitionend', ended, true);
  doc.addEventListener('animationend', ended, true);
  doc.addEventListener('contentvisibilityautostatechange', visibility, true);
  view?.addEventListener('resize', resize);
  const print = view?.matchMedia?.('print');
  // Print shows native wrapping through the lifecycle sheet's print rules;
  // this listener runs as printing starts, before the print layout.
  const printed = () => { if (print?.matches) ensureLifecycleStyles(doc); else resize(); };
  print?.addEventListener?.('change', printed);
  hub.stop = () => {
    view?.removeEventListener('resize', resize);
    print?.removeEventListener?.('change', printed);
    observer.disconnect();
    faces?.removeEventListener?.('loadingdone', fonts);
    faces?.removeEventListener?.('loading', loading);
    doc.removeEventListener('transitionend', ended, true);
    doc.removeEventListener('animationend', ended, true);
    doc.removeEventListener('contentvisibilityautostatechange', visibility, true);
  };
  return hub;
}

/** Receive this document's lifecycle signals until the returned function runs. */
export function subscribe(doc: Document, client: LifecycleClient): () => void {
  let hub = hubs.get(doc);
  if (!hub) { hub = start(doc); hubs.set(doc, hub); }
  const current = hub;
  current.clients.add(client);
  return () => {
    current.clients.delete(client);
    if (!current.clients.size && hubs.get(doc) === current) { current.stop(); hubs.delete(doc); }
  };
}

/** Hooks for authors and for the engine's own transient states:
 * --ts-break-display drives every generated break, [data-ts-stale] shows a
 * block's native wrapping while its composition waits to be redone, and print
 * wraps natively at the paper's width. dist/styles.css ships the same rules
 * for engines without constructable stylesheets. */
export const LIFECYCLE_CSS = '[data-ts-stale]{--ts-break-display:none}'
  + '[data-ts-stale] :is([data-ts-space],[data-ts-hang])[data-ts-break]{margin-left:0!important}'
  + '[data-ts-stale] [data-ts-track]{letter-spacing:inherit!important;word-spacing:inherit!important}'
  + '[data-ts-stale]>.ts-line[data-ts-generated]{display:inline!important;word-spacing:inherit!important}'
  + '@media print{:root{--ts-break-display:none}'
  + ':is([data-ts-space],[data-ts-hang])[data-ts-break]{margin-left:0!important}'
  + '[data-ts-track]{letter-spacing:inherit!important;word-spacing:inherit!important}'
  + '.ts-line[data-ts-generated]{display:inline!important;word-spacing:inherit!important}}';

// The document's lifecycle sheet, or null where none can be installed.
const sheets = new WeakMap<Document, CSSStyleSheet | null>();
/** One constructable stylesheet per document: no <style> element, so a strict
 * style-src policy is not involved. Skipped where unsupported. A page that
 * assigns document.adoptedStyleSheets (a theme switcher, the MDN example)
 * drops it; installing again, and ensureLifecycleStyles() as printing starts,
 * before stale mode and in each pass, put it back. */
export function installLifecycleStyles(doc: Document, element?: Element): void {
  const known = sheets.get(doc);
  if (known === null) return;
  if (known) ensureLifecycleStyles(doc);
  else try {
    const Sheet = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet;
    if (!Sheet || !('adoptedStyleSheets' in doc)) { sheets.set(doc, null); return; }
    const sheet = new Sheet();
    sheet.replaceSync(LIFECYCLE_CSS);
    sheets.set(doc, sheet);
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch { sheets.set(doc, null); /* dist/styles.css carries the same rules. */ return; }
  if (element) lifecycleStylesFor(element);
}
/** A document's stylesheets do not reach into shadow trees: text composed
 * inside a shadow root (mount(shadowRoot, ...), a component's own markup)
 * gets the same sheet adopted by that root, or stale mode and the print
 * rules would not apply to it. Installs nothing new. */
export function lifecycleStylesFor(element: Element): void {
  const root = element.getRootNode() as ShadowRoot;
  const sheet = root.nodeType === 11 && root.host ? sheets.get(element.ownerDocument) : null;
  if (!sheet) return;
  try { if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]; } catch { /* dist/styles.css */ }
}
/** Put an installed lifecycle sheet back if the page's own assignment to
 * document.adoptedStyleSheets removed it. Installs nothing new. */
export function ensureLifecycleStyles(doc: Document): void {
  const sheet = sheets.get(doc);
  if (!sheet) return;
  try { if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]; } catch { /* dist/styles.css */ }
}
