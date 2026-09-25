import * as api from './typeset.release';
declare global { interface Window { Typeset: typeof api } }
// A script-tag build; imported where there is no window (server rendering),
// it does nothing rather than throw.
if (typeof window !== 'undefined') window.Typeset = api;
