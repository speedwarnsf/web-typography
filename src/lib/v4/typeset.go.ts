import { afterHydration } from './hydration';
import * as api from './typeset.release';
import type { Controller } from './typeset.next';
declare global { interface Window { Typeset: typeof api; TypesetReady: Promise<Controller> } }
// A script-tag build; imported where there is no document (server
// rendering), it does nothing rather than throw.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement | null;
  const requested = script?.dataset.typesetSelector || '[data-typeset]';
  const selector = ':is(' + requested + '):not([data-typeset-react], [data-typeset-react] *, [data-typeset-react-rich], [data-typeset-react-rich] *)';
  const options = { smartQuotes: script?.dataset.typesetSmartQuotes === 'en' ? 'en' as const : false as const, opticalHanging: script?.dataset.typesetOpticalHanging === 'true', spacing: script?.dataset.typesetSpacing !== 'false', tracking: script?.dataset.typesetTracking !== 'false', copy: script?.dataset.typesetCopy !== 'false' };
  window.Typeset = api;
  window.TypesetReady = new Promise<void>(resolve => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    else resolve();
  }).then(async () => {
    // On a server-rendered page, after the framework hydrates (hydration.ts).
    await afterHydration(document, selector, script?.dataset.typesetDefer);
    const controller = api.mount(document, selector, options);
    await controller.ready;
    // This loader composes only explicit targets. Say so once when there are
    // none, rather than silently doing nothing.
    if (!document.querySelector(selector)) console.info('typeset.us go.js: no element matches ' + requested + ', so nothing was composed. Mark the text to set with data-typeset, pass data-typeset-selector on this script, or use typeset.us/auto (dist/auto.js) to set all prose. New matches are composed as they appear.');
    return controller;
  });
}
