// Browser fixture for scripts/v4/verify-settle.mjs. The page lays out every
// layout of the settle matrix as static HTML; each [data-hosts] element holds
// a JSON list of the blocks it contains. With ?adapter=text or ?adapter=rich
// this bundle renders those blocks with TypesetText or TypesetRichText, one
// React root per container, so each host's parent is the layout's own box
// (a shrink-to-fit flex item, a table cell, a dialog), as in an application.
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TypesetText, TypesetRichText } from '../../src/lib/v4/typeset.release.react';

const h = React.createElement;
const Text = TypesetText as any, Rich = TypesetRichText as any;
const w = window as any;

interface HostSpec { tag?: string; text?: string; mode?: string; cls?: string; decor?: string; component?: boolean }

/** A component child, as next/link's <Link> is: TypesetRichText keeps the paragraph native. */
const Emphasis = (props: { children?: React.ReactNode }) => h('em', null, props.children);

/** The words of `text` with its third to fifth words in <em> (or the Emphasis component), as React children. */
function richChildren(text: string, component?: boolean): React.ReactNode[] {
  const words = text.split(' ');
  if (words.length < 8) return [text];
  return [words.slice(0, 2).join(' ') + ' ', h(component ? Emphasis : 'em', { key: 'em' }, words.slice(2, 5).join(' ')), ' ' + words.slice(5).join(' ')];
}

function render(adapter: 'text' | 'rich'): number {
  const texts: Record<string, string> = w.SETTLE_TEXTS;
  let hosts = 0;
  for (const container of Array.from(document.querySelectorAll<HTMLElement>('[data-hosts]'))) {
    const specs: HostSpec[] = JSON.parse(container.dataset.hosts || '[]');
    const children = specs.map((spec, i) => {
      if (spec.decor) return h('span', { key: 'decor' + i, className: spec.decor, 'aria-hidden': true });
      hosts++;
      const text = texts[spec.text || ''];
      const shared = { key: 'host' + i, as: spec.tag || 'p', lang: 'en', smartQuotes: 'en', opticalHanging: true, className: spec.cls, 'data-settle': '', ...(spec.mode ? { mode: spec.mode } : {}) };
      return adapter === 'rich' ? h(Rich, shared, ...richChildren(text, spec.component)) : h(Text, { ...shared, text });
    });
    container.replaceChildren();
    const root = createRoot(container);
    flushSync(() => root.render(children));
  }
  return hosts;
}

const adapter = new URLSearchParams(location.search).get('adapter');
if (adapter === 'text' || adapter === 'rich') w.settleHosts = render(adapter);
w.settleReady = true;
