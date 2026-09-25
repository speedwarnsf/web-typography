import { typeset as compose, typesetAll as composeAll, mount as mountCore, planRichText as planCore } from './typeset.next';
import type { Options, Result, Controller, RichPlan } from './typeset.next';
import { checkOptions, checkSelector } from './validate';
export * from './typeset.next';
export { smartQuotes } from './smart-quotes';
export { styleProseLists } from './prose-lists';
export type { ListStyleResult } from './prose-lists';
// Retained for v3 advanced consumers; new integrations should use the owned adapters.
export { composeParagraph, finalValidate, linesOverflow, linesStarved, renderFrozenLines, shapeExactLines, tokenize } from './typeset';

/** Public v4 defaults. The research harness retains its explicit legacy baseline. */
const defaults = (options: Options): Options => ({ ...options, lineBreaks: options.lineBreaks ?? 'unicode', contour: options.contour ?? 'finished' });
// Bundlers replace process.env.NODE_ENV; a production build folds this to
// nothing and drops the checks. Without a bundler, `process` is undefined
// and the ReferenceError skips them. The script-tag builds define it as
// "development", so they keep the checks (each message printed once).
const check = (api: string, options: unknown, selector?: unknown) => {
  try { if (process.env.NODE_ENV !== 'production') { checkSelector(api, selector); checkOptions(api, options); } } catch { /* no process: skip */ }
};
export function typeset(element: HTMLElement, options: Options = {}): Result { check('typeset()', options); return compose(element, defaults(options)); }
export function typesetAll(selector?: string, options: Options = {}): Result[] { check('typesetAll()', options, selector); return composeAll(selector, defaults(options)); }
/** mount('article p') is mount(document, 'article p'). */
export function mount(selector: string, options?: Options): Controller;
export function mount(root?: ParentNode, selector?: string, options?: Options): Controller;
export function mount(root?: ParentNode | string, selector?: string | Options, options: Options = {}): Controller {
  if (typeof root === 'string') {
    const given = selector !== undefined && typeof selector === 'object' ? selector : options;
    check('mount()', given);
    return mountCore(root, defaults(given ?? {}));
  }
  check('mount()', options, selector);
  return mountCore(root, selector as string | undefined, defaults(options));
}
export function planRichText(element: HTMLElement, options: Options = {}): RichPlan { check('planRichText()', options); return planCore(element, defaults(options)); }
