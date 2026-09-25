/** Feature detection. Where composition cannot be measured or maintained,
 * Typeset leaves text native and reports 'native:environment' instead of
 * throwing: jsdom and happy-dom (Jest, Vitest) have no layout engine and no
 * Range geometry, and older engines lack Intl.Segmenter or the observers. */
const measurable = new WeakSet<Document>();
type View = (Window & typeof globalThis) | null;

const segmenter = () => typeof Intl === 'object' && typeof (Intl as { Segmenter?: unknown }).Segmenter === 'function';
const geometry = (view: View) => !!view && typeof view.Range?.prototype?.getClientRects === 'function';

/** Intl.Segmenter, Range geometry and real layout: enough to compose now.
 * A page whose root has no box yet is asked again on the next call. */
export function canCompose(doc: Document): boolean {
  if (measurable.has(doc)) return true;
  if (!segmenter() || !geometry(doc.defaultView as View) || !doc.documentElement) return false;
  // A layout engine gives the root element a box; DOM emulations report zeros.
  const box = doc.documentElement.getBoundingClientRect();
  if (!(box.width > 0 || box.height > 0)) return false;
  measurable.add(doc);
  return true;
}

/** The APIs that keep a composition correct as text, styles and widths
 * change: MutationObserver and ResizeObserver, with Intl.Segmenter and Range
 * geometry (mount()). Layout itself is checked per composition. */
export function canMaintain(doc: Document): boolean {
  const view = doc.defaultView as View;
  return !!view && typeof view.MutationObserver === 'function' && typeof view.ResizeObserver === 'function' && segmenter() && geometry(view);
}

export const ENVIRONMENT_OUTCOME = 'native:environment';
