/** One lifecycle owner per document for the React adapters. Every TypesetText
 * and TypesetRichText host registers here instead of creating its own
 * controller: one MutationObserver, one ResizeObserver, one
 * IntersectionObserver and one set of font and window listeners, however
 * many blocks a screen renders, created with the first host and removed with
 * the last.
 *
 * Scheduling. A host mounted during a React commit composes synchronously
 * only when it intersects the viewport and the commit is expected to stay
 * within COMMIT_BUDGET_MS (a learned cost per character); a prop change of an
 * on-screen host always recomposes in its commit. Hero text can opt out with
 * priority="sync". Other visible hosts compose in the next animation frame,
 * top to bottom, before that frame paints, so a visible block is never painted
 * native and then rewrapped (only visible work beyond VISIBLE_BUDGET_MS, on a
 * very slow device, continues in the following frame). Hosts within a
 * viewport of the screen follow within a small frame budget, and the rest
 * compose in idle time. Triggers (ancestor class or style changes, fonts, window
 * resizes) first compare each host's computed layout key and do nothing when
 * it is unchanged. During a continuous resize a host whose composed lines no
 * longer fit shows native lines (stale) and recomposes once the size has held
 * for RESIZE_SETTLE_MS. */
import { contentWidth } from './layout-metrics';
import { fontKey } from './adapter-keys';
import { mountOwners, releaseOwner } from './ownership';
import { canCompose, canMaintain } from './environment';

export type Priority = 'auto' | 'sync';
export type Reason = 'mount' | 'force' | 'check';
export interface AdapterEntry {
  element: HTMLElement;
  priority: Priority;
  /** Compose now. `inCommit` is true inside a React commit (layout effects),
   * where state updates are already synchronous. */
  compose(reason: Reason, inCommit: boolean): void;
  /** Whether the host's layout key differs from its last composition. */
  changed(fonts: string): boolean;
  /** The widest composed line in px; 0 when there is nothing to double-wrap. */
  widest(): number;
  /** Show native lines until the next composition. */
  stale(): void;
  /** A composition request was deferred: make the host correct in the meantime. */
  deferred?(reason: Reason): void;
  /** Nothing can be composed or kept correct here (jsdom, happy-dom, an engine
   * without the observers): report 'native:environment' and leave the text. */
  unsupported(): void;
}

export const COMMIT_BUDGET_MS = 6;
const FRAME_BUDGET_MS = 12;
/** A safety valve, not a target: on-screen blocks are composed before the
 * frame paints (never painted native, then rewrapped) unless the visible work
 * alone would exceed this, on a very slow device. */
const VISIBLE_BUDGET_MS = 120;
const IDLE_SLICE_MS = 8;
const RESIZE_SETTLE_MS = 100;
const OBSERVED = ['class', 'style', 'lang'];

interface Registry {
  identity: symbol;
  entries: Map<HTMLElement, AdapterEntry>;
  add(entry: AdapterEntry): void;
  remove(entry: AdapterEntry): void;
  request(entry: AdapterEntry, reason: Reason, inCommit: boolean): void;
  writing<T>(write: () => T): T;
}
const registries = new WeakMap<Document, Registry>();

export function adapterRegistry(doc: Document): Registry {
  let registry = registries.get(doc);
  if (!registry) { registry = createRegistry(doc); registries.set(doc, registry); }
  return registry;
}

function createRegistry(doc: Document): Registry {
  const win = doc.defaultView;
  const identity = Symbol('typeset-react');
  const entries = new Map<HTMLElement, AdapterEntry>();
  const pending = new Map<AdapterEntry, Reason>();
  const near = new Set<AdapterEntry>();
  const resizing = new Set<AdapterEntry>();
  const widths = new WeakMap<Element, number>();
  const watchers = new Map<Element, Set<AdapterEntry>>();
  const parents = new Map<AdapterEntry, Element | null>();
  const later = (fn: () => void, ms: number) => (win || globalThis).setTimeout(fn, ms);
  const frame = (fn: () => void): void => { if (win?.requestAnimationFrame) win.requestAnimationFrame(fn); else later(fn, 16); };
  let commitStart = 0;
  let costPerChar = 0;
  let frameQueued = false, idleQueued = false, staleQueued = false;
  let settle: ReturnType<typeof setTimeout> | undefined;
  let mutations: MutationObserver | null = null, sizes: ResizeObserver | null = null, viewport: IntersectionObserver | null = null;
  let writingDepth = 0;

  // The adapters render synchronously in test runners, so a DOM emulation
  // (no layout yet or ever) is answered at once rather than queued.
  const supported = () => canMaintain(doc) && canCompose(doc);
  const visible = (el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    const height = win?.innerHeight ?? 0, width = win?.innerWidth ?? 0;
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
  };
  const observeDocument = () => mutations?.observe(doc, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: OBSERVED });

  function run(entry: AdapterEntry, reason: Reason, inCommit: boolean): void {
    pending.delete(entry); near.delete(entry); viewport?.unobserve(entry.element);
    if (!entries.has(entry.element)) return;
    const started = performance.now(), length = entry.element.textContent?.length || 1;
    writing(() => entry.compose(reason, inCommit));
    // Learn this device's cost per character of composed text, so a budget
    // can decline a composition that would overrun it before starting it.
    const perChar = (performance.now() - started) / length;
    costPerChar = costPerChar ? costPerChar * .8 + perChar * .2 : perChar;
  }
  /** Whether a composition of `entry` is expected to finish within `budget` ms from `start`. */
  const fits = (entry: AdapterEntry, start: number, budget: number): boolean =>
    performance.now() - start + costPerChar * (entry.element.textContent?.length || 1) <= budget;
  function writing<T>(write: () => T): T {
    // Our own writes are not triggers. Records queued before we started
    // belong to others and are handled first.
    if (!writingDepth && mutations) { const records = mutations.takeRecords(); if (records.length) mutated(records); mutations.disconnect(); }
    writingDepth++;
    try { return write(); }
    finally { if (!--writingDepth && mutations && entries.size) { observeDocument(); } }
  }
  function enqueue(entry: AdapterEntry, reason: Reason): void {
    const prior = pending.get(entry);
    // 'force' and 'mount' outrank 'check': they compose without comparing keys.
    if (!prior || prior === 'check') pending.set(entry, reason);
    viewport?.observe(entry.element);
    schedule();
  }
  function schedule(): void {
    if (!pending.size) return;
    if (!frameQueued) { frameQueued = true; frame(flushFrame); }
    if (!idleQueued) {
      idleQueued = true;
      if (win && typeof win.requestIdleCallback === 'function') win.requestIdleCallback(flushIdle, { timeout: 1000 });
      else later(() => flushIdle(), 50);
    }
  }
  /** Compose (or check) one pending host. */
  function process(entry: AdapterEntry, reason: Reason, fonts: string): void {
    // A host being resized is checked once its size settles, not per frame.
    if (reason === 'check' && (resizing.has(entry) || !entry.changed(fonts))) { pending.delete(entry); near.delete(entry); viewport?.unobserve(entry.element); return; }
    run(entry, reason, false);
  }
  /** On-screen work, before this frame paints, top to bottom, then nearby
   * hosts within FRAME_BUDGET_MS. Only visible work beyond VISIBLE_BUDGET_MS
   * continues in the next frame. */
  function flushFrame(): void {
    frameQueued = false;
    if (!pending.size) return;
    const start = performance.now();
    const fonts = fontKey(doc);
    // All reads first: one layout, then the compositions.
    const queued = [...pending.keys()].map(entry => ({ entry, rect: entry.element.getBoundingClientRect() }));
    const height = win?.innerHeight ?? 0, width = win?.innerWidth ?? 0;
    const onScreen = queued.filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width)
      .sort((a, b) => a.rect.top - b.rect.top).map(({ entry }) => entry);
    const soon = [...onScreen, ...queued.map(({ entry }) => entry).filter(entry => near.has(entry) && !onScreen.includes(entry))];
    let composed = 0;
    for (const entry of soon) {
      // At least one per frame, so a slow device still makes progress.
      if (composed && !fits(entry, start, onScreen.includes(entry) ? VISIBLE_BUDGET_MS : FRAME_BUDGET_MS)) { frameQueued = true; frame(flushFrame); break; }
      const reason = pending.get(entry);
      if (reason) { process(entry, reason, fonts); composed++; }
    }
  }
  /** Everything else, in slices, nearest first. */
  function flushIdle(deadline?: IdleDeadline): void {
    idleQueued = false;
    if (!pending.size) return;
    const start = performance.now();
    const fonts = fontKey(doc);
    const order = [...pending.keys()].sort((a, b) => Number(near.has(b)) - Number(near.has(a)));
    for (const entry of order) {
      const reason = pending.get(entry);
      if (reason) process(entry, reason, fonts);
      if (performance.now() - start >= IDLE_SLICE_MS || (deadline && !deadline.didTimeout && deadline.timeRemaining() <= 1)) break;
    }
    schedule();
  }

  /** Mark hosts for a key check: those inside `target`, or all. */
  function check(target?: Element): void {
    for (const entry of entries.values()) {
      if (target && target !== entry.element && !target.contains(entry.element)) continue;
      if (!pending.has(entry)) enqueue(entry, 'check');
    }
  }
  function hostOf(node: Node | null): AdapterEntry | undefined {
    for (let el = node instanceof Element ? node : node?.parentElement ?? null; el; el = el.parentElement) {
      const entry = entries.get(el as HTMLElement);
      if (entry) return entry;
    }
  }
  function mutated(records: MutationRecord[]): void {
    const targets = new Set<Element>();
    let styles = false;
    for (const record of records) {
      const target = record.target instanceof Element ? record.target : record.target.parentElement;
      if (!target) continue;
      const host = hostOf(target);
      // Inside a host: our own writes are excluded (see writing), and React's
      // commits of TypesetRichText leave its layout key unchanged.
      if (host) { if (!pending.has(host)) enqueue(host, 'check'); continue; }
      if (record.type === 'attributes') targets.add(target);
      else if (target.closest('head') || target instanceof HTMLStyleElement) styles = true;
    }
    if (styles) { check(); return; }
    // An attribute on an element with no element children can only affect
    // a host that it is, or is inside, which hostOf already found.
    for (const target of targets) if (target.firstElementChild) check(target);
  }

  function watch(entry: AdapterEntry): void {
    const parent = entry.element.parentElement;
    parents.set(entry, parent);
    for (const target of [entry.element, parent]) {
      if (!target) continue;
      let set = watchers.get(target);
      if (!set) { set = new Set(); watchers.set(target, set); sizes?.observe(target); }
      set.add(entry);
    }
  }
  function unwatch(entry: AdapterEntry): void {
    for (const target of [entry.element, parents.get(entry)]) {
      if (!target) continue;
      const set = watchers.get(target);
      set?.delete(entry);
      if (set && !set.size) { watchers.delete(target); sizes?.unobserve(target); widths.delete(target); }
    }
    parents.delete(entry);
  }
  function resized(observations: ResizeObserverEntry[]): void {
    const revealed = new Set<AdapterEntry>();
    for (const observation of observations) {
      const width = observation.contentRect.width;
      const previous = widths.get(observation.target);
      widths.set(observation.target, width);
      if (previous === undefined || Math.abs(previous - width) <= .01) continue;
      for (const entry of watchers.get(observation.target) || []) {
        if (previous === 0 && entry.element.isConnected && visible(entry.element)) {
          // Revealed (display:none, a collapsed panel): compose before this
          // frame paints. A composition keeps the line count, so the host
          // keeps its size and no new observation is raised.
          if (!revealed.has(entry)) { revealed.add(entry); resizing.delete(entry); run(entry, 'check', false); }
        } else if (!revealed.has(entry)) resizing.add(entry);
      }
    }
    if (!resizing.size) return;
    if (!staleQueued) { staleQueued = true; frame(staleCheck); }
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  }
  /** Before the next frame's layout: native lines wherever composed ones no
   * longer fit. Not in the observer callback, where the height change would be
   * a same-depth notification (a ResizeObserver loop error). */
  function staleCheck(): void {
    staleQueued = false;
    const doomed = [...resizing].filter(entry => entries.has(entry.element) && entry.widest() > contentWidth(entry.element) + .5);
    for (const entry of doomed) writing(() => entry.stale());
  }
  function settled(): void {
    settle = undefined;
    for (const entry of resizing) if (entries.has(entry.element)) enqueue(entry, 'check');
    resizing.clear();
  }
  const fontsChanged = () => check();
  const fontsLoading = () => { (doc.fonts as FontFaceSet | undefined)?.ready.then(fontsChanged); };
  const windowResized = () => {
    for (const entry of entries.values()) resizing.add(entry);
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  };

  function start(): void {
    if (win && typeof win.MutationObserver === 'function') { mutations = new win.MutationObserver(mutated); observeDocument(); }
    if (win && typeof win.ResizeObserver === 'function') sizes = new win.ResizeObserver(resized);
    if (win && typeof win.IntersectionObserver === 'function') viewport = new win.IntersectionObserver(observations => {
      for (const observation of observations) {
        const entry = entries.get(observation.target as HTMLElement);
        if (!entry) continue;
        if (observation.isIntersecting) { near.add(entry); schedule(); } else near.delete(entry);
      }
    }, { rootMargin: '100% 0px' });
    const fonts = doc.fonts as FontFaceSet | undefined;
    fonts?.addEventListener?.('loadingdone', fontsChanged);
    fonts?.addEventListener?.('loading', fontsLoading);
    fonts?.ready?.then(() => { if (entries.size) check(); });
    win?.addEventListener('resize', windowResized);
  }
  function stop(): void {
    mutations?.disconnect(); sizes?.disconnect(); viewport?.disconnect();
    mutations = sizes = viewport = null;
    const fonts = doc.fonts as FontFaceSet | undefined;
    fonts?.removeEventListener?.('loadingdone', fontsChanged);
    fonts?.removeEventListener?.('loading', fontsLoading);
    win?.removeEventListener('resize', windowResized);
    clearTimeout(settle); settle = undefined;
    pending.clear(); near.clear(); resizing.clear(); watchers.clear(); parents.clear();
  }

  return {
    identity, entries, writing,
    add(entry) {
      if (!entries.size && supported()) start();
      entries.set(entry.element, entry);
      // A page-level mount() must not compose a host React's adapter owns.
      if (!mountOwners.has(entry.element)) mountOwners.set(entry.element, identity);
      watch(entry);
    },
    remove(entry) {
      if (entries.get(entry.element) !== entry) return;
      entries.delete(entry.element);
      pending.delete(entry); near.delete(entry); resizing.delete(entry);
      viewport?.unobserve(entry.element);
      unwatch(entry);
      releaseOwner(entry.element, identity);
      if (!entries.size) stop();
    },
    request(entry, reason, inCommit) {
      if (!entries.has(entry.element)) return;
      if (!supported()) { entry.unsupported(); return; }
      if (entry.priority === 'sync') { run(entry, reason, inCommit); return; }
      if (inCommit) {
        if (!commitStart) { commitStart = performance.now(); queueMicrotask(() => { commitStart = 0; }); }
        // A prop change of an on-screen block recomposes in its commit, as
        // in 4.2; mounting (a screen push) is what the budget spreads out.
        if ((reason === 'force' || fits(entry, commitStart, COMMIT_BUDGET_MS)) && visible(entry.element)) { run(entry, reason, true); return; }
      }
      entry.deferred?.(reason);
      enqueue(entry, reason);
    },
  };
}
