import { createApp, ref, computed, nextTick } from 'vue';
import { render } from './vue-template.js';
import { articles, expected } from './articles.js';
const index = ref(0);
createApp({ setup() { return { a: computed(() => articles[index.value]) }; }, render }).mount('#app');
window.fw = { name: 'vue', articles, expected, async set(i) { index.value = i; await nextTick(); } };
