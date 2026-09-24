import { LitElement, html } from 'lit';
import { articles, expected } from './articles.js';
class ArticleCard extends LitElement {
  static properties = { index: { type: Number } };
  constructor() { super(); this.index = 0; }
  createRenderRoot() { return this; } // light DOM, so page selectors and the loader see it
  render() {
    const a = articles[this.index];
    return html`<div class="col"><p id="sole">${a.body}</p><p id="mixed">Hello <b>${a.name}</b>, ${a.body}</p><p id="linked">${a.lead} <a href="#more">${a.link}</a> ${a.tail}</p><p id="cond">${a.body}${a.flag ? a.extra : ''}</p></div>`;
  }
}
customElements.define('article-card', ArticleCard);
const card = document.createElement('article-card');
document.getElementById('app').append(card);
window.fw = { name: 'lit', articles, expected, async set(i) { card.index = i; await card.updateComplete; } };
