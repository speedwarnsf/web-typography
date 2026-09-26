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
 * viewport height of the screen, or of the scroll container they scroll in,
 * follow within a small frame budget, and the rest
 * compose in long idle periods, not in what is left of an animation frame.
 * Triggers (ancestor class or style changes, fonts, window resizes, a host's
 * height changing at the same width, and the document lifecycle hub's
 * stylesheet, metric-transition and content-visibility signals) first
 * compare each host's computed layout key and do nothing when it is
 * unchanged. During a continuous resize a host whose
 * composed lines no longer fit shows native lines (stale) and recomposes once
 * the size has held for RESIZE_SETTLE_MS; so does a host whose metrics change
 * again within RESIZE_SETTLE_MS of a check composing it (a font-size or
 * spacing transition, a text-size slider), unless a font face finished in
 * between, which composes. A size a composition changes itself (a box sized
 * by its content narrowing to the composed lines, a grid track or table
 * column passing room to a neighbour) is not a resize: a composed host whose
 * lines still fit keeps them (see rebase and resized). Hidden hosts keep their composition
 * and are checked when shown; nothing composes while the page prints; and
 * while a translator rewrites the page every host steps aside (see
 * lifecycle.ts). */
import { contentWidth } from './layout-metrics';
import { fontKey } from './adapter-keys';
import { mountOwners, releaseOwner } from './ownership';
import { canCompose, canMaintain } from './environment';
import { armFonts, ensureLifecycleStyles, installLifecycleStyles, lifecycleStylesFor, markTranslated, movedOnly, nearObserver, printing, rendered, styleMutation, subscribe, translationActive } from './lifecycle';
import type { NearObserver } from './lifecycle';

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
  /** Machine translation of the document started or ended. */
  translation?(active: boolean): void;
}

export const COMMIT_BUDGET_MS = 6;
const FRAME_BUDGET_MS = 12;
/** A safety valve, not a target: on-screen blocks are composed before the
 * frame paints (never painted native, then rewrapped) unless the visible work
 * alone would exceed this, on a very slow device. */
const VISIBLE_BUDGET_MS = 120;
const IDLE_SLICE_MS = 8;
/** Idle work waits at most this long for a long idle period. */
const IDLE_TIMEOUT_MS = 1000;
/** An idle period at least this long has no frame pending. Shorter ones are
 * what is left of an animation frame (a screen push, a transition, a
 * scroll), which one composition on a slow device can overrun. */
const LONG_IDLE_MS = 20;
const RESIZE_SETTLE_MS = 100;
// Edge's translator tags the nodes it rewrites with the _mst attributes; the
// hidden and open attributes reveal text, which then composes before the
// reveal paints.
const OBSERVED = ['class', 'style', 'lang', 'hidden', 'open', '_msttexthash', '_msthash'];

/** A content-box size as a ResizeObserver reports it: layout, before any
 * transform (NaN for an inline box). */
function contentSize(el: Element): { w: number; h: number } {
  const cs = getComputedStyle(el);
  const width = parseFloat(cs.width), height = parseFloat(cs.height);
  if (cs.boxSizing !== 'border-box') return { w: width, h: height };
  return { w: width - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0') - parseFloat(cs.borderLeftWidth || '0') - parseFloat(cs.borderRightWidth || '0'),
    h: height - parseFloat(cs.paddingTop || '0') - parseFloat(cs.paddingBottom || '0') - parseFloat(cs.borderTopWidth || '0') - parseFloat(cs.borderBottomWidth || '0') };
}

interface Registry {
  identity: symbol;
  entries: Map<HTMLElement, AdapterEntry>;
  add(entry: AdapterEntry): void;
  remove(entry: AdapterEntry): void;
  request(entry: AdapterEntry, reason: Reason, inCommit: boolean): void;
  /** A composition finished rendering outside run() (TypesetRichText's
   * finishing commits): its size changes are its own. */
  composed(entry: AdapterEntry): void;
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
  // Hosts in `resizing` because their metrics changed continuously (process),
  // and when a check last composed each host, with the font key it saw.
  const continuous = new Set<AdapterEntry>();
  const checked = new WeakMap<AdapterEntry, { at: number; fonts: string }>();
  // Content-box sizes as last seen by the ResizeObserver or left by our writes.
  const sizes = new WeakMap<Element, { w: number; h: number }>();
  const watchers = new Map<Element, Set<AdapterEntry>>();
  const parents = new Map<AdapterEntry, Element | null>();
  const later = (fn: () => void, ms: number) => (win || globalThis).setTimeout(fn, ms);
  const frame = (fn: () => void): void => { if (win?.requestAnimationFrame) win.requestAnimationFrame(fn); else later(fn, 16); };
  let commitStart = 0;
  let costPerChar = 0;
  // Whether a composition in this document has laid out lines. The first
  // to do so pays one-time setup (segmenters, the line search's compiled
  // code, measurement caches): 80-90 ms at 4x CPU for a paragraph that then
  // costs about 13 ms. Learned, and counted against the visible budget, it
  // turned away half of a cold screen's on-screen blocks, which painted
  // native lines and were rewrapped a frame later. It is neither.
  let warm = false;
  let frameQueued = false, idleQueued = false, staleQueued = false;
  // When idle work was first requested and has not run since.
  let idleSince = 0;
  let settle: ReturnType<typeof setTimeout> | undefined;
  let mutations: MutationObserver | null = null, observer: ResizeObserver | null = null, viewport: NearObserver | null = null;
  let writingDepth = 0;
  // Whether a composition, and whether anything outside the registry that can
  // move a line (a DOM change outside the hosts' text, a window resize, a
  // font, stylesheet, metric, visibility or translation signal), happened
  // since the ResizeObserver last delivered: sizes that changed with only the
  // former are our own compositions' (see resized).
  let composedSince = false, triggeredSince = false;
  let started = false;
  let windowWidth = win?.innerWidth ?? 0;
  let unsubscribe: (() => void) | undefined;

  // The adapters render synchronously in test runners, so a DOM emulation
  // (no layout yet or ever) is answered at once rather than queued.
  const supported = () => canMaintain(doc) && canCompose(doc);
  const visible = (el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    const height = win?.innerHeight ?? 0, width = win?.innerWidth ?? 0;
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
  };
  const observeDocument = () => mutations?.observe(doc, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true, attributeFilter: OBSERVED });

  /** Compose one host; returns the time spent on one-time setup, if this
   * was the document's first composition to lay out lines, else 0. */
  function run(entry: AdapterEntry, reason: Reason, inCommit: boolean): number {
    pending.delete(entry); near.delete(entry); viewport?.unobserve(entry.element);
    if (!entries.has(entry.element)) return 0;
    const begun = performance.now(), length = entry.element.textContent?.length || 1;
    writing(() => entry.compose(reason, inCommit));
    composedSince = true;
    const took = performance.now() - begun;
    let setup = 0;
    if (!warm && entry.element.dataset.tsOutcome?.startsWith('composed')) { warm = true; setup = took; }
    // Learn this device's cost per character of composed text, so a budget
    // can decline a composition that would overrun it before starting it.
    else costPerChar = costPerChar ? costPerChar * .8 + took / length * .2 : took / length;
    rebase(entry);
    // Declined while a transform animates (a dialog's @starting-style entry,
    // a scale-in, a drawer closing): compose again once it ends, since neither
    // a CSS transition nor a Web Animation ends with a mutation.
    if (entry.element.dataset.tsOutcome === 'native:transformed') awaitTransforms(entry);
    return setup;
  }
  /** The sizes of the host's box and its parent's as the host's own
   * composition left them, recorded as what the ResizeObserver compares
   * against. A box sized by its content (a flex item without flex-1 or
   * min-w-0, w-fit, inline-block, a float, an auto table cell) narrows to its
   * composed lines, and a composition can change the host's height: neither
   * is a resize or a reason to check the host again. Counted as a resize,
   * the narrowing made the host show native lines, widen, compose and narrow
   * again every 100 ms without end. A hidden box keeps the size it was last
   * seen at, so showing it is still seen as a reveal. (TypesetRichText, whose
   * updates render after a commit's run() returns, calls this again once its
   * composition has settled.) */
  function rebase(entry: AdapterEntry): void {
    for (const target of [entry.element, parents.get(entry)]) {
      const size = target ? sizes.get(target) : undefined;
      if (!target || !size?.w || !target.getClientRects().length) continue;
      const box = contentSize(target);
      if (!Number.isNaN(box.w) && box.w > 0) size.w = box.w;
      if (!Number.isNaN(box.h)) size.h = box.h;
    }
  }
  /** Hosts declined under each running animation, composed again when it
   * ends. One that never ends (infinite iterations) is not waited on, or its
   * set would hold every host replaced or unmounted under it. */
  const animating = new WeakMap<Animation, Set<AdapterEntry>>();
  function awaitTransforms(entry: AdapterEntry): void {
    for (const animation of doc.getAnimations?.() ?? []) {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      if (!target || animation.playState === 'finished' || !(target === entry.element || target.contains(entry.element))) continue;
      if (animation.effect?.getComputedTiming().endTime === Infinity) continue;
      let waiting = animating.get(animation);
      if (!waiting) {
        const set = waiting = new Set();
        animating.set(animation, set);
        const ended = () => {
          animating.delete(animation);
          for (const host of set) if (entries.get(host.element) === host) enqueue(host, 'force');
        };
        animation.finished.then(ended, ended);
      }
      waiting.add(entry);
    }
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
    requestIdle();
  }
  function requestIdle(): void {
    if (idleQueued) return;
    idleQueued = true;
    if (!idleSince) idleSince = performance.now();
    if (win && typeof win.requestIdleCallback === 'function') win.requestIdleCallback(flushIdle, { timeout: Math.max(1, IDLE_TIMEOUT_MS - (performance.now() - idleSince)) });
    else later(() => flushIdle(), 50);
  }
  /** Compose (or check) one pending host; returns run()'s setup time. */
  function process(entry: AdapterEntry, reason: Reason, fonts: string): number {
    const drop = () => { pending.delete(entry); near.delete(entry); viewport?.unobserve(entry.element); };
    if (reason === 'check') {
      // A host being resized, or whose metrics keep changing, is checked once
      // they settle, not per frame; a change meanwhile moves the settle on.
      if (resizing.has(entry)) { if (continuous.has(entry)) settleLater(); drop(); return 0; }
      // A hidden host keeps its composition; it is checked when shown.
      if (!rendered(entry.element) || !entry.changed(fonts)) { drop(); return 0; }
      // Changed again soon after a check composed it: a font-size or spacing
      // transition, a text-size slider, an animation. Native lines until the
      // metrics hold for RESIZE_SETTLE_MS, then one composition, instead of a
      // composition in every frame (long tasks, dropped frames). A font face
      // finishing is a one-off change, even when faces finish in successive
      // frames (the key holds every face's status, used or not): it composes.
      const last = checked.get(entry);
      if (entry.widest() && last !== undefined && last.fonts === fonts && performance.now() - last.at < RESIZE_SETTLE_MS) {
        writing(() => entry.stale());
        resizing.add(entry); continuous.add(entry);
        settleLater();
        drop();
        return 0;
      }
    }
    const setup = run(entry, reason, false);
    if (reason === 'check') checked.set(entry, { at: performance.now(), fonts }); else checked.delete(entry);
    return setup;
  }
  function settleLater(): void {
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  }
  /** On-screen work, before this frame paints, top to bottom, then nearby
   * hosts within FRAME_BUDGET_MS. Only visible work beyond VISIBLE_BUDGET_MS
   * (the document's one-time setup not counted) continues in the next frame. */
  function flushFrame(): void {
    frameQueued = false;
    // Print shows native wrapping; the work waits until printing ends.
    if (!pending.size || printing(doc)) return;
    ensureLifecycleStyles(doc);
    let start = performance.now();
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
      if (reason) { start += process(entry, reason, fonts); composed++; }
    }
    // A composition can start a font load (a face first used by this text).
    if (composed) armFonts(doc);
  }
  /** Everything else, in slices, nearest first, in a long idle period: a
   * short one is the rest of an animation frame, which a composition on a
   * slow device can overrun, dropping frames of a screen push or a scroll.
   * Waited for up to IDLE_TIMEOUT_MS; a callback that fires on its timeout
   * composes one block. (Engines without idle callbacks use a timer.) */
  function flushIdle(deadline?: IdleDeadline): void {
    idleQueued = false;
    if (!pending.size || printing(doc)) { idleSince = 0; return; }
    if (deadline && !deadline.didTimeout && deadline.timeRemaining() < LONG_IDLE_MS) { requestIdle(); return; }
    idleSince = 0;
    const start = performance.now();
    const fonts = fontKey(doc);
    const order = [...pending.keys()].sort((a, b) => Number(near.has(b)) - Number(near.has(a)));
    for (const entry of order) {
      const reason = pending.get(entry);
      if (reason) process(entry, reason, fonts);
      if (deadline?.didTimeout || performance.now() - start >= IDLE_SLICE_MS || (deadline && deadline.timeRemaining() <= 1)) break;
    }
    armFonts(doc);
    schedule();
  }

  /** Mark hosts for a key check: those inside `target`, or all. */
  function check(target?: Element): void {
    triggeredSince = true;
    for (const entry of entries.values()) {
      if (target && target !== entry.element && !target.contains(entry.element)) continue;
      if (!pending.has(entry)) enqueue(entry, 'check');
    }
  }
  function hostOf(node: Node | null): AdapterEntry | undefined {
    for (let el = node?.nodeType === 1 ? node as Element : node?.parentElement ?? null; el; el = el.parentElement) {
      const entry = entries.get(el as HTMLElement);
      if (entry) return entry;
    }
  }
  function mutated(records: MutationRecord[]): void {
    const targets = new Set<Element>();
    let styles = false;
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      if (!target) continue;
      if (record.type === 'attributes' && record.attributeName?.startsWith('_mst')) { markTranslated(doc); continue; }
      // A translation or fade, written every frame by an animation (a screen
      // push, a card entrance) on a host or an ancestor, moves no line: no
      // check, as in mount(). A scale still is one (see transformOnly).
      if (record.type === 'attributes' && record.attributeName === 'style' && movedOnly(record.oldValue, target.getAttribute('style'))) continue;
      const host = hostOf(target);
      // A translator wrapping a host's text in <font>.
      if (host && !translationActive(doc) && [...record.addedNodes].some(node => node.nodeName === 'FONT')) { markTranslated(doc); continue; }
      // Inside a host: our own writes are excluded (see writing), and React's
      // commits of TypesetRichText leave its layout key unchanged.
      if (host) { if (!pending.has(host)) enqueue(host, 'check'); continue; }
      triggeredSince = true;
      if (record.type === 'attributes') targets.add(target);
      // A stylesheet edit; a <title> tick or an injected <script> in <head>
      // changes no text metrics (see styleMutation).
      else if (target.closest('head') ? styleMutation(record) : target.localName === 'style') styles = true;
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
      if (!set) { set = new Set(); watchers.set(target, set); observer?.observe(target); }
      set.add(entry);
    }
  }
  function unwatch(entry: AdapterEntry): void {
    for (const target of [entry.element, parents.get(entry)]) {
      if (!target) continue;
      const set = watchers.get(target);
      set?.delete(entry);
      if (set && !set.size) { watchers.delete(target); observer?.unobserve(target); sizes.delete(target); }
    }
    parents.delete(entry);
  }
  function resized(observations: ResizeObserverEntry[]): void {
    const revealed = new Set<AdapterEntry>();
    const own = composedSince && !triggeredSince;
    composedSince = triggeredSince = false;
    for (const observation of observations) {
      const { width, height } = observation.contentRect;
      const previous = sizes.get(observation.target);
      sizes.set(observation.target, { w: width, h: height });
      if (!previous) continue;
      if (Math.abs(previous.w - width) <= .01) {
        // Same width, new height: a CSSOM rule (a text-spacing override), the
        // browser's font-size setting, text-only zoom or a FontFace added by
        // script changes text metrics with no mutation and no event. Compare
        // the host's layout key before the next frame.
        const entry = entries.get(observation.target as HTMLElement);
        if (entry && width && Math.abs(previous.h - height) > .5 && !pending.has(entry)) enqueue(entry, 'check');
        continue;
      }
      // Hidden (display:none, a closed dialog, an inactive tab): keep the
      // composition. Shown again at the same width, it paints composed.
      if (!width) continue;
      for (const entry of watchers.get(observation.target) || []) {
        if (previous.w === 0 && entry.element.isConnected && visible(entry.element)) {
          if (!revealed.has(entry)) { revealed.add(entry); resizing.delete(entry); reveal(entry); }
        } else if (!revealed.has(entry)) {
          // Changed by our own compositions alone: a box sized by its content
          // narrowed to a block's composed lines, or an auto grid track or
          // table column gave a neighbour's room to this block. A composed
          // block whose lines still fit keeps them. Recomposing it would move
          // its neighbours again, and them it: two auto grid tracks took three
          // rounds, a second each offscreen, and nothing bounds the rounds.
          if (own && entry.widest() && entry.widest() <= contentWidth(entry.element) + .5) continue;
          resizing.add(entry);
        }
      }
    }
    if (!resizing.size) return;
    if (!staleQueued) { staleQueued = true; frame(staleCheck); }
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  }
  /** Shown again, seen only here: a reveal this registry's MutationObserver
   * sees (a class, style, hidden or open attribute) composes in the next
   * frame, before it paints. Here, inside the observer callback, any change
   * to the host's height is a ResizeObserver loop error. A retained
   * composition that still fits paints as composed; one that no longer fits
   * (the width changed while hidden, unseen) is recomposed before the next
   * frame. Native text (never composed, or stale) is composed now only if
   * that keeps its height, and otherwise before the next frame. */
  function reveal(entry: AdapterEntry): void {
    const el = entry.element;
    if (!entry.widest() && !printing(doc)) {
      const before = el.getBoundingClientRect().height;
      run(entry, 'check', false);
      if (entries.has(el) && Math.abs(el.getBoundingClientRect().height - before) > .01) writing(() => entry.stale());
    }
    enqueue(entry, 'check');
  }
  /** Before the next frame's layout: native lines wherever composed ones no
   * longer fit. Not in the observer callback, where the height change would be
   * a same-depth notification (a ResizeObserver loop error). A hidden host
   * whose container changed width will be shown at another width: it shows
   * native lines from now, a write inside a hidden subtree that moves nothing. */
  function staleCheck(): void {
    staleQueued = false;
    ensureLifecycleStyles(doc);
    const doomed = [...resizing].filter(entry => entries.has(entry.element) && entry.widest()
      && (rendered(entry.element) ? entry.widest() > contentWidth(entry.element) + .5 : entry.element.isConnected));
    for (const entry of doomed) writing(() => entry.stale());
  }
  function settled(): void {
    settle = undefined;
    for (const entry of resizing) if (entries.has(entry.element)) { checked.delete(entry); enqueue(entry, 'check'); }
    resizing.clear(); continuous.clear();
  }
  const fontsChanged = () => check();
  // A transition or animation of text metrics ended on or around a host.
  const metricsEnded = (target: Element) => {
    triggeredSince = true;
    for (const entry of entries.values()) if (target.contains(entry.element) || entry.element.contains(target)) if (!pending.has(entry)) enqueue(entry, 'check');
  };
  // Translation started: step aside at once, before the translator fills the
  // Text nodes it holds. Ended ("show original"): compose again.
  const translated = (active: boolean) => {
    triggeredSince = true;
    for (const entry of [...entries.values()]) writing(() => entry.translation?.(active));
  };
  const windowResized = () => {
    triggeredSince = true;
    for (const entry of entries.values()) resizing.add(entry);
    // Hidden text is likely to be shown at another width once the window's
    // width changes: native lines until then (see staleCheck). A height-only
    // resize (a mobile URL bar) leaves it composed.
    const width = win?.innerWidth ?? 0;
    if (width !== windowWidth) { windowWidth = width; if (!staleQueued) { staleQueued = true; frame(staleCheck); } }
    clearTimeout(settle);
    settle = later(settled, RESIZE_SETTLE_MS);
  };

  function start(): void {
    started = true;
    if (win && typeof win.MutationObserver === 'function') { mutations = new win.MutationObserver(mutated); observeDocument(); }
    if (win && typeof win.ResizeObserver === 'function') {
      observer = new win.ResizeObserver(resized);
      for (const target of watchers.keys()) observer.observe(target);
    }
    // Near: within a viewport height of the window, or of the scroll
    // container a host scrolls in.
    viewport = nearObserver(doc, observations => {
      for (const observation of observations) {
        const entry = entries.get(observation.target as HTMLElement);
        if (!entry) continue;
        if (observation.isIntersecting) { near.add(entry); schedule(); } else near.delete(entry);
      }
    });
    // Fonts (including those a stylesheet requests late, which WebKit loads
    // without any event), window resizes and the end of printing, stylesheet
    // changes, metric transitions, content-visibility and translation all come
    // from the document's lifecycle hub, shared with mount().
    installLifecycleStyles(doc);
    unsubscribe = subscribe(doc, { fonts: fontsChanged, resize: windowResized, metrics: metricsEnded, styles: () => check(),
      visibility: target => check(target), translation: translated });
    (doc.fonts as FontFaceSet | undefined)?.ready?.then(() => { if (entries.size) check(); });
    armFonts(doc);
  }
  function stop(): void {
    started = false;
    mutations?.disconnect(); observer?.disconnect(); viewport?.disconnect();
    mutations = observer = viewport = null;
    unsubscribe?.(); unsubscribe = undefined;
    clearTimeout(settle); settle = undefined;
    pending.clear(); near.clear(); resizing.clear(); continuous.clear(); idleSince = 0;
  }

  return {
    identity, entries, writing,
    composed(entry) { if (entries.get(entry.element) === entry) { composedSince = true; rebase(entry); } },
    add(entry) {
      entries.set(entry.element, entry);
      // Observers start with the first host that can be composed, and a
      // document that gains layout later starts them then.
      if (!started && supported()) start();
      // Inside a shadow root, the lifecycle rules are adopted there too.
      lifecycleStylesFor(entry.element);
      // A page-level mount() must not compose a host React's adapter owns.
      if (!mountOwners.has(entry.element)) mountOwners.set(entry.element, identity);
      watch(entry);
    },
    remove(entry) {
      if (entries.get(entry.element) !== entry) return;
      entries.delete(entry.element);
      pending.delete(entry); near.delete(entry); resizing.delete(entry); continuous.delete(entry);
      viewport?.unobserve(entry.element);
      unwatch(entry);
      releaseOwner(entry.element, identity);
      if (!entries.size) stop();
    },
    request(entry, reason, inCommit) {
      if (!entries.has(entry.element)) return;
      if (!supported()) { entry.unsupported(); return; }
      if (!started) start();
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
