import type { Controller } from './typeset.release.js';
import './global.js';
declare global {
  interface Window {
    /** Set by typeset.us/go and typeset.us/auto: resolves with the page's controller once it has mounted. */
    TypesetReady: Promise<Controller>;
  }
}
export {};
