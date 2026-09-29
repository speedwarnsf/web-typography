import * as api from './typeset.release';

// The automatic website loader: typeset.us/go@<v>.js and, byte for byte, the
// npm package's dist/auto.js (typeset.us/auto). The npm /go entry stays scoped.
// A script-tag build, also on npm as typeset.us/auto; imported where there is
// no document (server rendering), it does nothing rather than throw.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement | null;
  const requested = script?.dataset.typesetSelector || 'p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th, dd, dt';
  // Only the React adapters' own hosts are left out; authors exclude content
  // with data-no-typeset.
  const selector = ':is(' + requested + '):not([data-typeset-react], [data-typeset-react] *, [data-typeset-react-rich], [data-typeset-react-rich] *)';
  const options = {
    smartQuotes: script?.dataset.typesetSmartQuotes === 'false' ? false as const : 'en' as const,
    opticalHanging: script?.dataset.typesetOpticalHanging !== 'false',
    spacing: script?.dataset.typesetSpacing !== 'false',
    tracking: script?.dataset.typesetTracking !== 'false',
    copy: script?.dataset.typesetCopy !== 'false',
  };
  window.Typeset = api;
  window.TypesetReady = new Promise<void>(resolve => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    else resolve();
  }).then(async () => {
    const controller = api.mount(document, selector, options);
    await controller.ready;
    if (!document.querySelector(selector)) console.info('typeset.us auto loader: no element matches ' + requested + ', so nothing was composed. New matches are composed as they appear.');
    return controller;
  });
}
