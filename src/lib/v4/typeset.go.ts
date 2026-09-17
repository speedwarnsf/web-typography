import * as api from './typeset.release';
import type { Controller } from './typeset.next';
declare global { interface Window { Typeset: typeof api; TypesetReady: Promise<Controller> } }
const script = document.currentScript as HTMLScriptElement | null;
const requested = script?.dataset.typesetSelector || '[data-typeset]';
const selector = ':is(' + requested + '):not([data-typeset-react], [data-typeset-react] *, [data-typeset-react-rich], [data-typeset-react-rich] *)';
const options = { smartQuotes: script?.dataset.typesetSmartQuotes === 'en' ? 'en' as const : false as const, opticalHanging: script?.dataset.typesetOpticalHanging === 'true', spacing: script?.dataset.typesetSpacing !== 'false', tracking: script?.dataset.typesetTracking !== 'false' };
window.Typeset = api;
window.TypesetReady = new Promise<void>(resolve => {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
  else resolve();
}).then(async () => { const controller = api.mount(document, selector, options); await controller.ready; return controller; });
