// React 19 outside the Typeset adapters, as on a page running the website loader.
import { createElement as h, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { articles, expected } from './articles.js';
let setIndex = () => {};
function App() {
  const [index, set] = useState(0);
  setIndex = set;
  const a = articles[index];
  return h('div', { className: 'col' },
    h('p', { id: 'sole' }, a.body),
    h('p', { id: 'mixed' }, 'Hello ', h('b', null, a.name), ', ', a.body),
    h('p', { id: 'linked' }, a.lead, ' ', h('a', { href: '#more' }, a.link), ' ', a.tail),
    // A conditional child: React removes and re-inserts this Text node.
    h('p', { id: 'cond' }, a.body, a.flag ? a.extra : null));
}
const root = createRoot(document.getElementById('app'));
flushSync(() => root.render(h(App)));
window.fw = { name: 'react', articles, expected, set(i) { flushSync(() => setIndex(i)); return Promise.resolve(); } };
