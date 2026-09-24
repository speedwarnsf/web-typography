/**
 * The front door IS the flagship: the v2 experience serves at `/`.
 * The old resource homepage (rules, pairings, tips) lives on at /library.
 * /v2 remains as an alias for links already in the wild.
 */
export { default } from './v2/page';

export const metadata = {
  title: 'Typeset: better line breaks for web text',
  description: 'No stranded short words or one-word last lines. Grammar-aware line breaks that keep links and styling intact, checked after rendering in Chrome, Safari and Firefox. One pinned script tag, or npm and React.',
};
