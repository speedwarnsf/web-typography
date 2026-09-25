'use client';

import { createElement, useLayoutEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { restore, typeset } from './typeset.next';
import type { Mode, Options, Result } from './typeset.next';
import { adapterRegistry } from './adapter-registry';
import type { AdapterEntry, Priority } from './adapter-registry';
import { layoutKey } from './adapter-keys';
export { TypesetRichText } from './typeset-rich-react';
export type { TypesetRichTextProps } from './typeset-rich-react';
export type { Priority } from './adapter-registry';

export interface TypesetTextProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'dangerouslySetInnerHTML'> {
  text: string;
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span';
  mode?: Mode;
  keep?: readonly string[];
  maxLines?: number;
  density?: Options['density'];
  lineBreaks?: Options['lineBreaks'];
  smartQuotes?: Options['smartQuotes'];
  opticalHanging?: Options['opticalHanging'];
  spacing?: Options['spacing'];
  tracking?: Options['tracking'];
  contour?: Options['contour'];
  /** 'auto' (default) composes in the commit only what is on screen, within
   * a small time budget, and the rest before its first paint or in idle
   * time. 'sync' composes in the commit, as 4.2 did, for hero text. */
  priority?: Priority;
}

/**
 * React owns the semantic host and its attributes; this adapter owns only
 * its text subtree. The stable initial child also supplies readable SSR.
 * Inline interactive children belong outside this plain-text adapter.
 */
export function TypesetText({ text, as = 'p', mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour, priority = 'auto', ...attributes }: TypesetTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [initialText] = useState(text);
  const options = useRef<Options>({ text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour });
  options.current = { text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour };
  const entry = useRef<AdapterEntry | null>(null);
  // By value: an inline keep={[...]} is a new array on every parent render.
  const keepKey = keep?.join('\u0000');
  // One registration per host element. Unmounting does not restore: React
  // discards the host with its composed lines.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const registry = adapterRegistry(element.ownerDocument);
    let key = '', widest = 0;
    const current: AdapterEntry = {
      element, priority,
      compose() {
        const result: Result = typeset(element, options.current);
        widest = result.outcome.startsWith('composed') ? Math.max(0, ...result.after.lines.map(line => line.width)) : 0;
        delete element.dataset.tsStale;
        key = layoutKey(element);
      },
      changed: fonts => layoutKey(element, fonts) !== key,
      widest: () => widest,
      stale() { restore(element); element.dataset.tsStale = ''; widest = 0; },
      deferred() {
        // Until it composes, the host shows the current text natively.
        if (element.textContent !== options.current.text) { restore(element); element.textContent = options.current.text ?? ''; widest = 0; }
      },
    };
    entry.current = current;
    registry.add(current);
    registry.request(current, 'mount', true);
    return () => { registry.remove(current); entry.current = null; };
  }, [as]);
  useLayoutEffect(() => { if (entry.current) entry.current.priority = priority; }, [priority]);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const current = entry.current;
    if (current) adapterRegistry(current.element.ownerDocument).request(current, 'force', true);
  }, [text, mode, keepKey, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour]);
  return createElement(as, { ...attributes, ref, 'data-typeset-react': '' }, initialText);
}
