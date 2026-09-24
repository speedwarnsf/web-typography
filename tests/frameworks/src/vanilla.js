// A hand-rolled renderer: it creates its Text nodes once and later sets .data
// on them, as Svelte, Vue, Lit and Solid do.
import { articles, expected } from './articles.js';
const text = value => document.createTextNode(value);
const refs = { sole: text(''), name: text(''), body: text(''), lead: text(''), link: text(''), tail: text(''), condBody: text(''), condExtra: text('') };
const column = document.createElement('div');
column.className = 'col';
const paragraph = (id, ...children) => { const p = document.createElement('p'); p.id = id; p.append(...children); column.append(p); };
const bold = document.createElement('b'); bold.append(refs.name);
const link = document.createElement('a'); link.href = '#more'; link.append(refs.link);
paragraph('sole', refs.sole);
paragraph('mixed', text('Hello '), bold, text(', '), refs.body);
paragraph('linked', refs.lead, text(' '), link, text(' '), refs.tail);
paragraph('cond', refs.condBody, refs.condExtra);
document.getElementById('app').append(column);
function render(i) {
  const a = articles[i];
  refs.sole.data = a.body; refs.name.data = a.name; refs.body.data = a.body;
  refs.lead.data = a.lead; refs.link.data = a.link; refs.tail.data = a.tail;
  refs.condBody.data = a.body; refs.condExtra.data = a.flag ? a.extra : '';
}
render(0);
window.fw = { name: 'vanilla', articles, expected, set(i) { render(i); return Promise.resolve(); } };
