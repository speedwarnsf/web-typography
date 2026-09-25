import { LitElement, html, render } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { articles, expected } from './articles.js';
// Lit parts that start with an empty comment instead of a <!--?lit$...$-->
// marker: each item of an iterable (an array, map() and repeat()) and a
// top-level render() of a string. Lit writes a new string to the Text node
// right after that comment, found by position.
/** Pieces of five words, the space before each piece (`lead`) or after it. */
const pieces = (/** @type {string} */ text, /** @type {boolean} */ lead) => {
  const words = text.split(' '), out = [];
  for (let i = 0; i < words.length; i += 5) out.push(words.slice(i, i + 5).join(' '));
  return out.map((piece, i) => lead ? (i ? ' ' : '') + piece : piece + (i < out.length - 1 ? ' ' : ''));
};
class ArticleParts extends LitElement {
  static properties = { index: { type: Number } };
  constructor() { super(); this.index = 0; }
  createRenderRoot() { return this; } // light DOM, so page selectors and the loader see it
  render() {
    const a = articles[this.index], e = expected(this.index);
    // The spaces around the link stay inside the parts: Chromium leaves a
    // whitespace-only Text node beside a comment out of its accessibility
    // tree, with or without composition.
    const lead = pieces(a.lead, true), tail = pieces(a.tail, false);
    lead[lead.length - 1] += ' '; tail[0] = ' ' + tail[0];
    return html`<div class="col"><p id="sole">${pieces(e.sole, true)}</p><p id="mixed">${repeat(pieces(e.mixed, false), (_, i) => i, piece => piece)}</p><p id="linked">${lead.map(piece => piece)}<a href="#more">${pieces(a.link, true)}</a>${tail}</p><p id="cond"></p></div>`;
  }
  // A top-level render() into a paragraph the template leaves empty.
  updated() { render(expected(this.index).cond, /** @type {HTMLElement} */ (this.querySelector('#cond'))); }
}
customElements.define('article-parts', ArticleParts);
const card = document.createElement('article-parts');
/** @type {HTMLElement} */ (document.getElementById('app')).append(card);
window.fw = { name: 'lit-parts', articles, expected, async set(i) { card.index = i; await card.updateComplete; } };
