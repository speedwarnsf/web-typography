import type { Metadata } from 'next';
import Link from 'next/link';
import { NPM_INSTALL, PINNED_SNIPPET, PINNED_VERSION } from '@/lib/install-snippet';
import '../install.css';

// Recipes for sites built with a framework. React-owned text uses the React
// adapters; static content that the framework renders once uses mount().
// One owner per element: never also load go.js on these pages.

export const metadata: Metadata = {
  title: 'Typeset in Next.js, Vite, Astro, SvelteKit and Vue',
  description: 'Recipes for adding Typeset line breaking to framework sites: React adapters for text React owns, mount() for static content, and the pinned script tag for everything else.',
};

const NEXT = `// app/page.tsx: a server component can use the adapters directly;
// typeset.us/react is already a client component.
import { TypesetRichText, TypesetText } from 'typeset.us/react';

export default function Page() {
  return (
    <article>
      <TypesetText as="h1" text="The End of Oak Street" />
      <TypesetRichText lang="en" smartQuotes="en">
        Read <strong>the notes</strong> at <a href="/gallery">the gallery</a>.
      </TypesetRichText>
    </article>
  );
}`;

const NEXT_MDX = `// app/components/SetArticle.tsx: for Markdown or CMS HTML that React
// renders once and never updates in place.
'use client';
import { useEffect } from 'react';
import { mount } from 'typeset.us';

export function SetArticle() {
  useEffect(() => {
    const controller = mount(document, 'article p, article h2, article li');
    return () => controller.disconnect();
  }, []);
  return null;
}`;

const VITE = `// Vite + React: the same adapters.
import { TypesetRichText } from 'typeset.us/react';

export function Lede() {
  return (
    <TypesetRichText as="p" lang="en">
      Plain words, <em>emphasis</em> and <a href="/more">links</a> are all fine.
    </TypesetRichText>
  );
}`;

const ASTRO = `---
// src/pages/post.astro: static HTML, set once in the browser.
---
<article>
  <h1>The End of Oak Street</h1>
  <p>Paragraphs Astro renders to static HTML.</p>
</article>

<script>
  import { mount } from 'typeset.us';
  mount(document, 'article p, article h1, article li');
</script>`;

const SVELTE = `<!-- SvelteKit: content Svelte renders once, such as {@html} Markdown. -->
<script>
  import { onMount } from 'svelte';
  import { mount } from 'typeset.us';
  export let html;
  let article;
  onMount(() => {
    const controller = mount(article, 'p, h2, li');
    return () => controller.disconnect();
  });
</script>

<article bind:this={article}>{@html html}</article>`;

const VUE = `<!-- Vue or Nuxt: content Vue renders once, such as v-html Markdown. -->
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import { mount } from 'typeset.us';
defineProps({ html: String });
const article = ref(null);
let controller;
onMounted(() => { controller = mount(article.value, 'p, h2, li'); });
onBeforeUnmount(() => controller?.disconnect());
</script>

<template><article ref="article" v-html="html" /></template>`;

function Recipe({ title, lede, code }: { title: string; lede: React.ReactNode; code: string }) {
  return (
    <section style={{ marginBottom: 56 }}>
      <h2>{title}</h2>
      <p className="in-lede">{lede}</p>
      <div className="in-snippet" data-no-typeset>
        <pre style={{ margin: 0, flex: 1, overflowX: 'auto' }}><code style={{ whiteSpace: 'pre' }}>{code}</code></pre>
      </div>
    </section>
  );
}

export default function Frameworks() {
  return (
    <main className="in-root">
      <p className="in-label">Install / Frameworks</p>
      <h1>Typeset in your framework.</h1>
      <p className="in-lede">
        Install the exact version, then pick one owner for each piece of text:
        the React adapters for text React renders and updates, or{' '}
        <code>mount()</code> for content the framework renders once. Never
        point <code>mount()</code> or a script tag at text a framework keeps
        updating.
      </p>
      <div className="in-snippet" data-no-typeset>
        <code>{NPM_INSTALL}</code>
      </div>
      <p className="in-fine">
        Typeset {PINNED_VERSION}. <code>-E</code> saves the exact version, so a
        release can never change your pages until you choose to upgrade.
      </p>

      <Recipe title="Next.js (App Router)" code={NEXT} lede={<>Use <code>TypesetText</code> and <code>TypesetRichText</code> wherever React renders the text. They render readable HTML on the server and compose in the browser; React 18.2 and later, and every React 19.</>} />
      <Recipe title="Next.js: Markdown and CMS content" code={NEXT_MDX} lede={<>For article HTML that React renders once, mount one controller for the page and disconnect it on unmount.</>} />
      <Recipe title="Vite + React" code={VITE} lede={<>The same adapters, no configuration.</>} />
      <Recipe title="Astro" code={ASTRO} lede={<>Astro bundles the script and runs it once per page load. With view transitions, run it again on <code>astro:page-load</code> and disconnect the previous controller.</>} />
      <Recipe title="SvelteKit" code={SVELTE} lede={<>Mount on the element that holds the content, and disconnect when the component is destroyed.</>} />
      <Recipe title="Vue and Nuxt" code={VUE} lede={<>The same pattern: mount after the content renders, disconnect before unmount.</>} />

      <section style={{ marginBottom: 56 }}>
        <h2>Plain HTML and no-code sites</h2>
        <p className="in-lede">One pinned script tag sets every paragraph, heading, list item and caption.</p>
        <div className="in-snippet" data-no-typeset>
          <code>{PINNED_SNIPPET}</code>
        </div>
        <p className="in-fine">
          Step-by-step guides for Ghost, WordPress, Webflow, Squarespace and
          others: <Link href="/install">Install</Link>.
        </p>
      </section>
      {/* TODO(docs-sync): C6 makes mount() safe when frameworks update text
          nodes in place; relax the "renders once" advice then. */}
    </main>
  );
}
