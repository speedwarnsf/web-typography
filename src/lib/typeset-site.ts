import { typeset as compose, restore, type Options } from './v4/typeset.release';
export { typesetText, typesetHeading, measureCh, measureLayout } from './v4/typeset.release';

/** These demo refs own their children; their opt-out excludes the global controller. */
export function typeset(element: HTMLElement, options: Options = {}) {
  const exclusions: [HTMLElement, string][] = [];
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.hasAttribute('data-no-typeset')) {
      exclusions.push([node, node.getAttribute('data-no-typeset')!]);
      node.removeAttribute('data-no-typeset');
    }
  }
  try {
    return compose(element, { smartQuotes: 'en', opticalHanging: true, ...options });
  } finally {
    for (const [node, value] of exclusions) node.setAttribute('data-no-typeset', value);
  }
}
export { restore };
export default typeset;
