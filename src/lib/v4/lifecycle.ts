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
 * what shows it: the window, or the nearest scroll container it scrolls in.
 * An app shell's overflow:auto pane clips its content, and a root margin on
 * the window does not reach past that clip, so text below the fold there
 * was never near until it was on screen. One observer per scrollport, held
 * only while it observes something, so a scroll container a route removed
 * is not kept alive; an element's scrollport is found once. Null without
 * IntersectionObserver. */
export function nearObserver(doc: Document, callback: (entries: IntersectionObserverEntry[]) => void): NearObserver | null {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  if (!view || typeof view.IntersectionObserver !== 'function') return null;
  const observers = new Map<Element | null, { observer: IntersectionObserver; targets: Set<Element> }>();
  const roots = new WeakMap<Element, Element | null>();
  const scrollport = (element: Element): Element | null => {
    for (let node = element.parentElement; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
      const cs = view.getComputedStyle(node);
      if (/^(?:auto|scroll|overlay)$/u.test(cs.overflowY) || /^(?:auto|scroll|overlay)$/u.test(cs.overflowX)) return node;
    }
    return null;
  };
  return {
    observe(element) {
      let root = roots.get(element);
      if (root === undefined) { root = scrollport(element); roots.set(element, root); }
      let entry = observers.get(root);
      if (!entry) { entry = { observer: new view.IntersectionObserver(callback, { root, rootMargin: '100% 0px' }), targets: new Set() }; observers.set(root, entry); }
      entry.observer.observe(element);
      entry.targets.add(element);
    },
    unobserve(element) {
      const root = roots.get(element);
      const entry = root === undefined ? undefined : observers.get(root);
      if (!entry) return;
      entry.observer.unobserve(element);
      entry.targets.delete(element);
      // The window's observer stays; a scroll container's goes with its last target.
      if (root && !entry.targets.size) { entry.observer.disconnect(); observers.delete(root); }
    },
    disconnect() { for (const entry of observers.values()) entry.observer.disconnect(); observers.clear(); },
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
export function installLifecycleStyles(doc: Document): void {
  const known = sheets.get(doc);
  if (known === null) return;
  if (known) { ensureLifecycleStyles(doc); return; }
  try {
    const Sheet = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet;
    if (!Sheet || !('adoptedStyleSheets' in doc)) { sheets.set(doc, null); return; }
    const sheet = new Sheet();
    sheet.replaceSync(LIFECYCLE_CSS);
    sheets.set(doc, sheet);
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch { sheets.set(doc, null); /* dist/styles.css carries the same rules. */ }
}
/** Put an installed lifecycle sheet back if the page's own assignment to
 * document.adoptedStyleSheets removed it. Installs nothing new. */
export function ensureLifecycleStyles(doc: Document): void {
  const sheet = sheets.get(doc);
  if (!sheet) return;
  try { if (!doc.adoptedStyleSheets.includes(sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet]; } catch { /* dist/styles.css */ }
}
