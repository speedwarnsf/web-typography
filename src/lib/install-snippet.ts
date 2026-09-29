/**
 * Install lines shown on typeset.us, generated at build time from
 * public/sri.json, which only release-cut writes. Every page offers the
 * pinned loader with its integrity hash, and the same file from jsDelivr with
 * the same hash; the unpinned go.js and go@4.js are named for local testing
 * but never offered as a line to copy. When a release is cut and the site
 * deployed, every snippet moves to the new version together.
 */
import sri from '../../public/sri.json';
import release from '../../public/release.json';

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

/** The pinned loader's gzip size in KB, as release-cut measured it. */
export const LOADER_GZIP_KB: string = (release.loader.gzipBytes / 1000).toFixed(1);

/** The unpinned loaders, named but never offered as a line to copy. */
export const EVERGREEN_NOTE = 'The unpinned go.js and go@4.js follow each 4.x release and cannot carry an integrity hash, so use them only for local testing.';

/** typeset.us hosting is a convenience; say so next to the lines that use it. */
export const HOSTING_NOTE = 'typeset.us hosting has no uptime guarantee. For a strict Content Security Policy, or to keep every request on your own domain, install from npm and serve the file yourself.';
