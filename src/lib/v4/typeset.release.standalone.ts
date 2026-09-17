import * as api from './typeset.release';
declare global { interface Window { Typeset: typeof api } }
window.Typeset = api;
