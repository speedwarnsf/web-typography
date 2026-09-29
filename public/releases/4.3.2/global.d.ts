import type * as Typeset from './typeset.release.js';
declare global {
  interface Window {
    /** The API, set by typeset.us/global (dist/typeset.global.js), typeset.us/go (dist/go.js) and typeset.us/auto (dist/auto.js). */
    Typeset: typeof Typeset;
  }
}
export {};
