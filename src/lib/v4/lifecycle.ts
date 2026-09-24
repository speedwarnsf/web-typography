/** Document-level lifecycle signals, shared by every controller and adapter in
 * a document: one set of listeners however many blocks are mounted. */

export interface LifecycleClient {
  /** A font face finished loading, or the font set settled. */
  fonts?(): void;
  /** The window resized, or printing ended. Runs before the frame's layout. */
  resize?(): void;
  /** A transition or animation of text metrics ended on `target`. */
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
const metric = /^(?:font|letter-spacing|word-spacing|line-height|text-transform|text-indent|tab-size)/u;

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

/** Printing (or print emulation) lays text out at the paper's width, where
 * print CSS shows native wrapping; composing for it is wasted work. */
export function printing(doc: Document): boolean {
  return !!doc.defaultView?.matchMedia?.('print').matches;
}

/** Whether an element's text is laid out now: it has boxes and is not in a
 * skipped content-visibility subtree. Measuring anything else is guesswork. */
export function rendered(element: Element): boolean {
  if (!element.getClientRects().length) return getComputedStyle(element).display === 'contents';
  const check = (element as Element & { checkVisibility?: (options: object) => boolean }).checkVisibility;
  return typeof check !== 'function' || check.call(element, { contentVisibilityAuto: true });
}

/** Re-arm font notifications. WebKit fires no loading events for fonts a
 * stylesheet requests, so every face still loading is watched directly. */
export function armFonts(doc: Document): void {
  const hub = hubs.get(doc);
  if (!hub) return;
  const settled = () => { if (hubs.get(doc) === hub) notify(hub, client => client.fonts?.()); };
  if (doc.fonts.status === 'loading' && !hub.ready) {
    hub.ready = true;
    doc.fonts.ready.then(() => { hub.ready = false; settled(); });
  }
  doc.fonts.forEach(face => {
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
      else styles = true;
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
  if (doc.head) observer.observe(doc.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['media', 'disabled', 'href', 'rel'] });
  doc.fonts.addEventListener('loadingdone', fonts);
  doc.fonts.addEventListener('loading', loading);
  doc.addEventListener('transitionend', ended, true);
  doc.addEventListener('animationend', ended, true);
  doc.addEventListener('contentvisibilityautostatechange', visibility, true);
  view?.addEventListener('resize', resize);
  const print = view?.matchMedia?.('print');
  const printed = () => { if (!print?.matches) resize(); };
  print?.addEventListener?.('change', printed);
  hub.stop = () => {
    view?.removeEventListener('resize', resize);
    print?.removeEventListener?.('change', printed);
    observer.disconnect();
    doc.fonts.removeEventListener('loadingdone', fonts);
    doc.fonts.removeEventListener('loading', loading);
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

const styled = new WeakSet<Document>();
/** One constructable stylesheet per document: no <style> element, so a strict
 * style-src policy is not involved. Skipped where unsupported. */
export function installLifecycleStyles(doc: Document): void {
  if (styled.has(doc)) return;
  styled.add(doc);
  try {
    const Sheet = (doc.defaultView as (Window & typeof globalThis) | null)?.CSSStyleSheet;
    if (!Sheet || !('adoptedStyleSheets' in doc)) return;
    const sheet = new Sheet();
    sheet.replaceSync(LIFECYCLE_CSS);
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
  } catch { /* dist/styles.css carries the same rules. */ }
}
