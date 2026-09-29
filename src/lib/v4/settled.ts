/** whenSettled(): one promise for visual tests and screenshots. Every mount()
 * controller, every document's React adapter registry and a loader still
 * waiting for hydration report whether composition work is queued or timed;
 * whenSettled() resolves once none is, with no web font loading, at two
 * checks POLL_MS apart (the second lets a ResizeObserver delivery queue what
 * a composition's own layout change asks for).
 *
 * The sources live on globalThis under a registered symbol, so separate
 * copies of the engine share them: typeset.us and typeset.us/react under
 * require() (two CommonJS bundles), or a script-tag loader beside an npm
 * import. */
import { canCompose, canMaintain } from './environment';

export interface SettleOptions {
  /** Give up after this many milliseconds and resolve { settled: false } if
   * work is still queued then. Default 10,000. */
  timeout?: number;
}
export interface Settled {
  /** false: composition work was still queued or timed when the timeout ran out. */
  settled: boolean;
}

type Busy = () => boolean;
const KEY = Symbol.for('typeset.us/work');
const SETTLE_TIMEOUT_MS = 10000;
const POLL_MS = 50;

function sources(): Set<Busy> {
  const shared = globalThis as { [KEY]?: Set<Busy> };
  return shared[KEY] || (shared[KEY] = new Set());
}

/** Register a source of composition work; returns its removal. */
export function trackWork(busy: Busy): () => void {
  const set = sources();
  set.add(busy);
  return () => { set.delete(busy); };
}

/** Resolves once every mount() controller and React adapter host has its
 * outcome and no composition work is queued or timed. Where nothing can be
 * composed (jsdom, happy-dom, no document) it resolves { settled: true } at
 * once. */
export function whenSettled(options: SettleOptions = {}): Promise<Settled> {
  const doc = typeof document === 'undefined' ? undefined : document;
  const view = doc?.defaultView;
  if (!doc || !view || !canMaintain(doc) || !canCompose(doc)) return Promise.resolve({ settled: true });
  const timeout = typeof options.timeout === 'number' && options.timeout >= 0 ? options.timeout : SETTLE_TIMEOUT_MS;
  const start = performance.now();
  const busy = () => doc.readyState === 'loading' || doc.fonts?.status === 'loading' || [...sources()].some(source => source());
  return new Promise(resolve => {
    let quiet = 0;
    // A timer, not an animation frame: a frame requested every frame leaves
    // no idle period long enough for the adapters' offscreen work, which then
    // composes one host a second. POLL_MS apart, the two checks span the
    // rendering updates (and ResizeObserver deliveries) a composition causes.
    const next = () => view.setTimeout(step, Math.max(0, Math.min(POLL_MS, timeout - (performance.now() - start))));
    const step = () => {
      if (busy()) quiet = 0;
      else if (++quiet >= 2) { resolve({ settled: true }); return; }
      if (performance.now() - start >= timeout) { resolve({ settled: !busy() }); return; }
      next();
    };
    next();
  });
}
