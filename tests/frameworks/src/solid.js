import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import html from 'solid-js/html';
import { articles, expected } from './articles.js';
// solid-js/html drops whitespace-only text between expressions and tags, as
// JSX does across lines, so the linked paragraph's spaces live in the values.
const [index, setIndex] = createSignal(0);
const a = () => articles[index()];
render(() => html`<div class="col"><p id="sole">${() => a().body}</p><p id="mixed">Hello <b>${() => a().name}</b>, ${() => a().body}</p><p id="linked">${() => a().lead + ' '}<a href="#more">${() => a().link}</a>${() => ' ' + a().tail}</p><p id="cond">${() => a().body}${() => a().flag ? a().extra : ''}</p></div>`, document.getElementById('app'));
window.fw = { name: 'solid', articles, expected, set(i) { setIndex(i); return Promise.resolve(); } };
