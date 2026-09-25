import { mount, flushSync } from 'svelte';
import App from './App.svelte';
import { articles, expected } from './articles.js';
mount(App, { target: document.getElementById('app') });
window.fw = { name: 'svelte', articles, expected, set(i) { window.__svelteSet(i); flushSync(); return Promise.resolve(); } };
