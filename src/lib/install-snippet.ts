/**
 * Install lines shown on typeset.us, generated at build time from
 * public/sri.json, which only release-cut writes. The pinned loader, with its
 * integrity hash, is what every page offers first; the evergreen go.js is
 * offered only with its label. When a release is cut and the site deployed,
 * every snippet moves to the new version together.
 */
import sri from '../../public/sri.json';

const files = sri.files as Record<string, string>;

/** The current release. */
export const PINNED_VERSION: string = sri.version;

/** `<script src="https://typeset.us/go@<v>.js" integrity=… crossorigin="anonymous" defer>`. */
export const PINNED_SNIPPET: string = sri.snippet;

/** Exact-version npm install. */
export const NPM_INSTALL = `npm i -E typeset.us@${sri.version}`;

/** The same loader from npm through jsDelivr (dist/auto.js, from 4.3), with the same hash. */
export const JSDELIVR_SNIPPET: string | null = files[`go@${sri.version}.js`] && Number(sri.version.split('.')[1]) >= 3 && sri.version.startsWith('4.')
  ? `<script src="https://cdn.jsdelivr.net/npm/typeset.us@${sri.version}/dist/auto.js" integrity="${files[`go@${sri.version}.js`]}" crossorigin="anonymous" defer></script>`
  : null;

/** The window.Typeset library, pinned when this release published typeset@<v>.min.js (4.3 and later). */
export const LIBRARY_SNIPPET: string = files[`typeset@${sri.version}.min.js`]
  ? `<script src="https://typeset.us/typeset@${sri.version}.min.js" integrity="${files[`typeset@${sri.version}.min.js`]}" crossorigin="anonymous"></script>`
  : '<script src="https://typeset.us/typeset.min.js"></script>';
export const LIBRARY_PINNED = !!files[`typeset@${sri.version}.min.js`];

/** The evergreen loader. Always shown with EVERGREEN_NOTE. */
export const EVERGREEN_SNIPPET = '<script src="https://typeset.us/go.js" defer></script>';
export const EVERGREEN_NOTE = 'go.js updates itself within 4.x, for trying Typeset out. It will never move to 5.0. For a site you run, use the pinned line with its integrity hash.';
