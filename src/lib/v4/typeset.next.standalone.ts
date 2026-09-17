import * as TypesetNext from './typeset.next';
declare global { interface Window { TypesetNext: typeof TypesetNext } }
window.TypesetNext = TypesetNext;
