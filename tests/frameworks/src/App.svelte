<script>
  import { articles } from './articles.js';
  let i = $state(0);
  const a = $derived(articles[i]);
  window.__svelteSet = (n) => { i = n; };
</script>
<div class="col">
  <p id="sole">{a.body}</p>
  <p id="mixed">Hello <b>{a.name}</b>, {a.body}</p>
  <p id="linked">{a.lead} <a href="#more">{a.link}</a> {a.tail}</p>
  <p id="cond">{a.body}{a.flag ? a.extra : ''}</p>
</div>
