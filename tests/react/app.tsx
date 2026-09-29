// Browser fixture for scripts/v4/verify-react.mjs. Bundled once per React
// major (18.3.1 and 19.2.3) with the adapter under test; scenarios are
// rendered on demand through window.T so one page load serves many checks.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText, TypesetRichText, whenSettled } from '../../src/lib/v4/typeset.release.react';

const { useState, useDeferredValue, Suspense, StrictMode, startTransition, Fragment } = React;
const Activity = (React as any).Activity || (React as any).unstable_Activity;
const h = React.createElement;
const Text = TypesetText as any, Rich = TypesetRichText as any;

export const TEXTS = [
  'The cost of something is not just its price tag. It is the hours of your life you traded to earn that money, so spend them on what you actually value.',
  'Small habits compound quietly. A glass of water before coffee, ten minutes of daylight before screens, and one honest note about how you feel will change the shape of an ordinary week.',
  'Rest is not a reward for finishing everything on your list. It is the condition that makes the list possible, and the body keeps its own ledger.',
];
const LABELS = ['Daily tip', 'Breathe', 'Sleep better tonight', 'Your streak', 'Hydration'];
const rich = (i: number) => [h(Fragment, { key: 'a' }, 'Before you close the day, name '), h('strong', { key: 'b' }, 'one thing'), ' that went better than you expected and ',
  h('a', { key: 'c', href: '#x', onClick: () => {} }, 'one thing'), ` you would like to try differently tomorrow morning, number ${i}.`];

const results: Record<string, number> = {};
const w = window as any;
w.__results = results;
w.whenSettled = whenSettled;
const counted = (id: string) => (result: { outcome: string }) => { results[id] = (results[id] || 0) + 1; w.__lastResult = w.__lastResult || {}; w.__lastResult[id] = result; };

interface BlocksProps { n: number; kind: 'both' | 'text' | 'rich' | 'labels' | 'plain'; inlineKeep?: boolean; tick: number; onResult?: boolean; width?: number | string; labels?: boolean; priority?: string }
function Blocks({ n, kind, inlineKeep, onResult, width = 330, labels, priority }: BlocksProps) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const style = { width };
    const label = labels && i % 4 !== 3;
    const text = label ? LABELS[i % LABELS.length] : TEXTS[i % 3];
    const extra = onResult ? { onResult: counted('t' + i) } : {};
    if (kind === 'plain') { out.push(h('p', { key: 'p' + i, className: 'blk', style }, text)); continue; }
    const p = priority ? { priority } : {};
    if (kind !== 'rich') out.push(h(Text, { key: 't' + i, id: 't' + i, lang: 'en', className: 'blk', style, text, ...(inlineKeep ? { keep: ['price tag'] } : {}), ...extra, ...p }));
    if (kind === 'both' || kind === 'rich') out.push(h(Rich, { key: 'r' + i, id: 'r' + i, lang: 'en', className: 'blk rich', style, ...(onResult ? { onResult: counted('r' + i) } : {}), ...p }, label ? text : rich(i)));
  }
  return h('div', { className: 'col' }, out);
}

let resource: { done: boolean; promise: Promise<void> } | null = null;
function Suspender() { if (resource && !resource.done) throw resource.promise; return null; }

function Rapid({ text, deferred, inlineKeep }: { text: string; deferred?: boolean; inlineKeep?: boolean }) {
  const shown = useDeferredValue(text);
  const value = deferred ? shown : text;
  return h('div', { className: 'col' },
    h(Text, { id: 'rapid', lang: 'en', text: value, ...(inlineKeep ? { keep: ['price tag'] } : {}) }),
    h(Rich, { id: 'rapidrich', lang: 'en' }, value));
}

/** K5: refs resolve to host elements, widened hosts compose, onResult reports. */
const refs = { text: React.createRef<HTMLElement>(), rich: React.createRef<HTMLElement>(), callbackText: null as HTMLElement | null, callbackRich: null as HTMLElement | null };
w.__refs = refs;
function ApiScenario() {
  const long = TEXTS[1];
  const withResult = (id: string) => ({ id, lang: 'en', onResult: counted(id) });
  return h('div', { className: 'col', style: { width: 340 } },
    h(Text, { ...withResult('ref-text'), ref: refs.text, text: long }),
    h(Rich, { ...withResult('ref-rich'), ref: refs.rich }, rich(1)),
    h(Text, { ...withResult('cb-text'), ref: (node: HTMLElement | null) => { refs.callbackText = node; }, text: long }),
    h(Rich, { ...withResult('cb-rich'), ref: (node: HTMLElement | null) => { refs.callbackRich = node; } }, rich(2)),
    h('ul', { id: 'list' }, h(Text, { ...withResult('as-li'), as: 'li', text: long }), h(Rich, { ...withResult('as-li-rich'), as: 'li' }, rich(3))),
    h(Text, { ...withResult('as-div'), as: 'div', text: long }),
    h(Text, { ...withResult('as-blockquote'), as: 'blockquote', text: long }),
    h('figure', null, h(Text, { ...withResult('as-figcaption'), as: 'figcaption', text: long })),
    h('dl', null, h(Text, { ...withResult('as-dt'), as: 'dt', text: 'A term' }), h(Text, { ...withResult('as-dd'), as: 'dd', text: long })),
    h('table', null, h('tbody', null, h('tr', null, h(Text, { ...withResult('as-td'), as: 'td', colSpan: 2, text: long })))),
    // A label outside the flex column stays inline.
    h('div', null, h(Text, { ...withResult('as-label'), as: 'label', htmlFor: 'x', text: 'A label beside a field' })));
}

function App({ scenario, props }: { scenario: string; props: any }) {
  const [tick, setTick] = useState(0);
  const [text, setText] = useState(TEXTS[0]);
  const [show, setShow] = useState(true);
  const [mode, setMode] = useState('visible');
  const [k, setK] = useState(0);
  w.api = { setTick, setText, setShow, setMode, setK, flushSync, startTransition, bump: () => setTick(t => t + 1),
    suspend: (ms: number) => { const r = { done: false } as any; r.promise = new Promise<void>(res => setTimeout(() => { r.done = true; res(); }, ms)); resource = r; setTick(t => t + 1); } };
  const content = (() => {
    switch (scenario) {
      case 'blocks': return show ? h('div', { id: 'wrap', 'data-tick': tick }, h(Blocks, { ...props, tick })) : h('div', null, 'empty');
      case 'rapid': return h(Rapid, { text, ...props });
      case 'suspense': return h(Suspense, { fallback: h('p', { id: 'fallback' }, 'Loading') }, h(Suspender), h(Blocks, { n: 3, kind: 'both', tick }));
      case 'activity': return Activity ? h(Activity, { mode }, h('div', { id: 'wrap' }, h(Blocks, { n: 3, kind: 'both', tick }))) : h('p', { id: 'no-activity' }, 'no Activity');
      case 'api': return h(ApiScenario);
      case 'key': return h('div', { className: 'col' }, h(Text, { key: k, id: 'keyed', lang: 'en', text: TEXTS[k % 3] }), h(Rich, { key: 'r' + k, id: 'keyedrich', lang: 'en' }, rich(k)));
      default: return null;
    }
  })();
  return content;
}

/** Which adapter hosts are composed (have an outcome) and which are on screen. */
function composedState() {
  const hosts = Array.from(document.querySelectorAll<HTMLElement>('[data-typeset-react], [data-typeset-react-rich]'));
  return hosts.map(el => {
    const r = el.getBoundingClientRect();
    return { id: el.id, visible: r.bottom > 0 && r.top < innerHeight && r.width > 0 && r.height > 0, composed: !!el.dataset.tsOutcome };
  });
}
w.__composedState = composedState;
/** State as the first frame after `change` paints: a task queued from an
 * animation frame callback registered before the change runs after that paint. */
w.__afterFirstPaint = (change: () => void) => new Promise(resolve => {
  requestAnimationFrame(() => setTimeout(() => resolve(composedState()), 0));
  change();
});

let root: ReturnType<typeof createRoot> | null = null;
w.T = {
  version: React.version,
  render(scenario: string, props: any = {}, strict = false) {
    root?.unmount();
    const host = document.getElementById('root')!;
    root = createRoot(host);
    for (const key of Object.keys(results)) delete results[key];
    if (props.suspendMs) { const r = { done: false } as any; r.promise = new Promise<void>(res => setTimeout(() => { r.done = true; res(); }, props.suspendMs)); resource = r; }
    w.__lastResult = {};
    const app = h(App, { scenario, props });
    flushSync(() => root!.render(strict ? h(StrictMode, null, app) : app));
  },
  unmount() { root?.unmount(); root = null; },
};
w.booted = true;
