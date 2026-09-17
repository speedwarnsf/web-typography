import * as api from './typeset.release';

// Preserve the existing public one-line install. The npm /go entry stays scoped.
const script = document.currentScript as HTMLScriptElement | null;
const requested = script?.dataset.typesetSelector || 'p, li, blockquote, figcaption, h1, h2, h3, h4, h5, h6, td, th, dd, dt';
const selector = ':is(' + requested + '):not([data-typeset-react], [data-typeset-react] *, [data-typeset-react-rich], [data-typeset-react-rich] *, .demo, .demo *, [data-no-smooth], [data-no-smooth] *)';
const options = {
  smartQuotes: script?.dataset.typesetSmartQuotes === 'false' ? false as const : 'en' as const,
  opticalHanging: script?.dataset.typesetOpticalHanging !== 'false',
  spacing: script?.dataset.typesetSpacing !== 'false',
  tracking: script?.dataset.typesetTracking !== 'false',
};
window.Typeset = api;
window.TypesetReady = new Promise<void>(resolve => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  else resolve();
}).then(async () => {
  const controller = api.mount(document, selector, options);
  await controller.ready;
  return controller;
});
