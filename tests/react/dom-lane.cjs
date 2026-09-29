// One DOM-emulation lane for scripts/v4/verify-react-node.mjs, run in its own
// process from a staged consumer directory whose node_modules holds
// typeset.us (the candidate) and the React under test:
//
//   node dom-lane.cjs <jsdom|happy-dom> <esm|cjs> <domModules>
//
// It installs the emulated window's globals the way jest-environment-jsdom
// and Vitest's jsdom/happy-dom environments do, renders both adapters with
// act(), and prints one JSON line of observations. It must never throw.
const [, , emulation, format, domModules] = process.argv;
const { createRequire } = require('node:module');
const fromDom = createRequire(domModules + '/');
const out = { emulation, format, errors: [], consoleErrors: [] };
const html = '<!doctype html><html lang="en"><body><div id="root"></div><p id="plain">A paragraph for mount() in a test runner.</p></body></html>';
let window;
if (emulation === 'jsdom') {
  const { JSDOM } = fromDom('jsdom');
  window = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' }).window;
} else {
  const { Window } = fromDom('happy-dom');
  window = new Window({ url: 'http://localhost/' });
  window.document.write(html);
}
// What the test environments expose: the window's own properties as globals.
for (const key of Object.getOwnPropertyNames(window)) {
  if (key in globalThis || key === 'undefined') continue;
  try { globalThis[key] = window[key]; } catch {}
}
globalThis.window = window; globalThis.document = window.document; globalThis.navigator = window.navigator;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalError = console.error;
console.error = (...args) => { out.consoleErrors.push(args.map(String).join(' ').slice(0, 300)); };

(async () => {
  try {
    const React = require('react');
    const { createRoot } = require('react-dom/client');
    out.react = React.version;
    const load = async (specifier) => format === 'cjs' ? require(specifier) : import(specifier);
    const core = await load('typeset.us');
    const adapters = await load('typeset.us/react');
    out.entries = { core: typeof core.typeset, text: typeof adapters.TypesetText, rich: typeof adapters.TypesetRichText };
    const results = [];
    const textRef = React.createRef(), richRef = React.createRef();
    const tree = React.createElement('div', null,
      React.createElement(adapters.TypesetText, { id: 'text', lang: 'en', ref: textRef, text: 'Hello world, this is a paragraph composed in a test runner.', onResult: r => results.push(['text', r.outcome]) }),
      React.createElement(adapters.TypesetRichText, { id: 'rich', lang: 'en', ref: richRef, onResult: r => results.push(['rich', r.outcome]) }, 'Hello ', React.createElement('em', null, 'world'), ', with ', React.createElement('a', { href: '#x' }, 'a link'), '.'));
    const root = createRoot(document.getElementById('root'));
    await React.act(async () => { root.render(tree); });
    const text = document.getElementById('text'), rich = document.getElementById('rich');
    out.rendered = { text: text?.textContent, rich: rich?.textContent, textOutcome: text?.dataset.tsOutcome, richOutcome: rich?.dataset.tsOutcome, richLink: !!rich?.querySelector('a[href="#x"]') };
    out.refs = { text: textRef.current === text, rich: richRef.current === rich };
    // whenSettled() (4.4) resolves at once where nothing can be composed.
    const settleStart = Date.now();
    const settled = await Promise.all([core.whenSettled(), adapters.whenSettled()]);
    out.settled = { core: settled[0] && settled[0].settled, react: settled[1] && settled[1].settled, ms: Date.now() - settleStart };
    await React.act(async () => { root.render(React.cloneElement(tree)); });
    await React.act(async () => { root.render(React.createElement('div', null, React.createElement(adapters.TypesetText, { id: 'text', lang: 'en', text: 'Updated text.' }))); });
    out.updated = document.getElementById('text')?.textContent;
    out.results = results;
    const direct = document.getElementById('plain');
    out.typeset = core.typeset(direct).outcome;
    const controller = core.mount(document, 'p');
    await controller.ready;
    controller.disconnect();
    out.mount = direct.dataset.tsOutcome;
    out.audit = typeof core.auditJSON().pass;
    await React.act(async () => { root.unmount(); });
    out.unmounted = document.getElementById('root').children.length === 0;
  } catch (error) {
    out.errors.push(String(error && error.stack || error).split('\n').slice(0, 4).join(' | '));
  }
  console.error = originalError;
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
})();
