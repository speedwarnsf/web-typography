/** When the auto and go loaders first compose a server-rendered page. A
 * paragraph composed before the framework hydrates it no longer matches the
 * server HTML: React 18 and 19 report a recoverable hydration error (#418),
 * discard the server markup and render the root again on the client, and the
 * page is composed twice (4.3: every hydration that came after composition).
 *
 * On a page with a server-rendering marker, or with
 * data-typeset-defer="hydration" on the loader's script, the first
 * composition waits for the load event, then for the framework's own signal
 * where one is known, then for one idle callback (a timer where there are
 * none), all capped at HYDRATION_CAP_MS after load. data-typeset-defer="none"
 * keeps 4.3's timing: compose at DOMContentLoaded. Without a marker the timing
 * is 4.3's too. */
import { trackWork } from './settled';

/** Next.js (pages and app router), Gatsby, Framer, Astro islands and Vue 2
 * server rendering. A React root already on the document or its body counts
 * too (see reactRoots). */
const MARKERS = '#__next, #__NEXT_DATA__, #___gatsby, [data-framer-hydrate-v2], astro-island, [data-server-rendered]';
/** The markers of pages React hydrates. */
const REACT_MARKERS = '#__next, #__NEXT_DATA__, #___gatsby, [data-framer-hydrate-v2]';
const HYDRATION_CAP_MS = 10000;
const POLL_MS = 50;

const hasKey = (node: object, prefix: string) => Object.keys(node).some(key => key.startsWith(prefix));
/** React 18 and 19 mark a root's container with a __reactContainer$ key: the
 * document (Next.js app router), the body, or one of its children (#__next,
 * #___gatsby, Framer's #main, an app's #root). */
function reactRoots(doc: Document): Node[] {
  const candidates: Node[] = [doc];
  if (doc.body) candidates.push(doc.body, ...Array.from(doc.body.children));
  return candidates.filter(node => hasKey(node, '__reactContainer$'));
}
/** React sets a __reactFiber$ key on each element it hydrates, when that
 * element's whole subtree is done: an element counts as hydrated once it, or
 * an ancestor below the body, has one (an ancestor covers text set with
 * dangerouslySetInnerHTML, which React never hydrates node by node). html,
 * head and body are left out: React 19 claims them before their content. */
function reactHydrated(el: Element, root: Node): boolean {
  for (let node: Element | null = el; node && node !== root && !/^(HTML|HEAD|BODY)$/.test(node.tagName); node = node.parentElement) {
    if (hasKey(node, '__reactFiber$')) return true;
  }
  return false;
}

/** Whether a page's server HTML is still waiting for its framework. */
function waiting(doc: Document, server: Element[], react: boolean): boolean {
  if (react) {
    const roots = reactRoots(doc);
    if (!roots.length) return true;
    // Server-rendered targets in a root that React has not reached yet;
    // one it replaced or removed is no longer waited for.
    if (server.some(el => el.isConnected && roots.some(root => root.contains(el) && !reactHydrated(el, root)))) return true;
  }
  // Astro takes ssr off an island once it hydrates; islands waiting to be
  // scrolled into view or for a media query are not waited for.
  if (doc.querySelector('astro-island[ssr]:not([client="visible"], [client="media"])')) return true;
  // Vue 2 takes data-server-rendered off its root as it hydrates.
  return !!doc.querySelector('[data-server-rendered]');
}

/**
 * The first composition's wait, or undefined when there is none (no marker,
 * or data-typeset-defer="none"). `selector` is the loader's target selector:
 * the targets present now are the server-rendered ones.
 */
export function afterHydration(doc: Document, selector: string, defer: string | undefined): Promise<void> | undefined {
  if (defer === 'none') return undefined;
  const view = doc.defaultView;
  const nextData = !!view && Array.isArray((view as unknown as { __next_f?: unknown }).__next_f);
  const marked = nextData || !!doc.querySelector(MARKERS) || reactRoots(doc).length > 0;
  if (!view || (!marked && defer !== 'hydration')) return undefined;
  const server = Array.from(doc.querySelectorAll(selector));
  const reactMarked = nextData || !!doc.querySelector(REACT_MARKERS);
  // whenSettled() waits for this too.
  const untrack = trackWork(() => true);
  return new Promise<void>(resolve => {
    const done = () => { untrack(); resolve(); };
    const loaded = () => {
      const deadline = performance.now() + HYDRATION_CAP_MS;
      // Under data-typeset-defer="hydration" without a marker, a React root
      // present by the load event is waited for too.
      const react = reactMarked || reactRoots(doc).length > 0;
      const poll = () => {
        if (waiting(doc, server, react) && performance.now() < deadline) { view.setTimeout(poll, POLL_MS); return; }
        const left = Math.max(1, deadline - performance.now());
        if (typeof view.requestIdleCallback === 'function') view.requestIdleCallback(done, { timeout: left });
        else view.setTimeout(done, Math.min(left, POLL_MS));
      };
      poll();
    };
    if (doc.readyState === 'complete') loaded();
    else view.addEventListener('load', loaded, { once: true });
  });
}
