// Page-context names used inside page.evaluate() callbacks in scripts/v4.
// Those callbacks run in the browser, where the suites install the engine as
// window.Typeset and keep fixture state on window; the declarations below let
// the Node-side scripts type-check with // @ts-check without describing every
// fixture global. They are deliberately loose: the suites themselves assert
// the engine's behaviour.
interface Window { [key: string]: any }
declare var Typeset: any;
declare var TypesetReady: any;
declare var controller: any;
declare var compose: any;
declare var activations: any;
declare var link: any;
declare var head: any;
declare var tabTarget: any;
declare var originalText: any;
declare var selected: any;
interface Element { dataset: DOMStringMap; style: CSSStyleDeclaration; href?: string }
interface Node { data?: any; length?: any }
