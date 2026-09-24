/** Document-level lifecycle signals, shared by every controller and adapter in
 * a document: one set of listeners however many blocks are mounted. */

export interface LifecycleClient {
  /** A font face finished loading, or the font set settled. */
  fonts?(): void;
  /** A transition or animation of text metrics ended on `target`. */
  metrics?(target: Element): void;
  /** A stylesheet was added, removed, edited or switched. */
  styles?(): void;
}

interface Hub { clients: Set<LifecycleClient>; faces: WeakSet<FontFace>; ready: boolean; stop: () => void }
const hubs = new WeakMap<Document, Hub>();
const metric = /^(?:font|letter-spacing|word-spacing|line-height|text-transform|text-indent|tab-size)/u;

function notify(hub: Hub, call: (client: LifecycleClient) => void): void {
  for (const client of [...hub.clients]) call(client);
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
  const hub: Hub = { clients: new Set(), faces: new WeakSet(), ready: false, stop: () => {} };
  const fonts = () => { notify(hub, client => client.fonts?.()); armFonts(doc); };
  const loading = () => armFonts(doc);
  const ended = (event: Event) => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1) return;
    if (event.type === 'animationend' || metric.test((event as TransitionEvent).propertyName || '')) notify(hub, client => client.metrics?.(target));
  };
  // Stylesheets arrive and switch without touching composed text: a late
  // @font-face, a text-spacing bookmarklet, a theme <link media>.
  const observer = new MutationObserver(() => { notify(hub, client => client.styles?.()); armFonts(doc); });
  if (doc.head) observer.observe(doc.head, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['media', 'disabled', 'href', 'rel'] });
  doc.fonts.addEventListener('loadingdone', fonts);
  doc.fonts.addEventListener('loading', loading);
  doc.addEventListener('transitionend', ended, true);
  doc.addEventListener('animationend', ended, true);
  hub.stop = () => {
    observer.disconnect();
    doc.fonts.removeEventListener('loadingdone', fonts);
    doc.fonts.removeEventListener('loading', loading);
    doc.removeEventListener('transitionend', ended, true);
    doc.removeEventListener('animationend', ended, true);
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
