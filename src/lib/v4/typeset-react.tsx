'use client';

import { createElement, forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { restore, typeset } from './typeset.next';
import type { Options, Result } from './typeset.next';
import { adapterRegistry } from './adapter-registry';
import type { AdapterEntry } from './adapter-registry';
import { assignRef, layoutKey } from './adapter-keys';
import { ENVIRONMENT_OUTCOME } from './environment';
import type { TypesetAdapterProps } from './typeset-rich-react';
import { smartQuotes as educate } from './smart-quotes';
export { TypesetRichText } from './typeset-rich-react';
export type { TypesetRichTextProps, TypesetAdapterProps, TypesetTag, Priority } from './typeset-rich-react';

export interface TypesetTextProps extends TypesetAdapterProps {
  text: string;
}

// Layout effects do nothing during server rendering, and React 18 warns when
// one is scheduled there. On the server the effect never runs either way.
const useClientLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/**
 * React owns the semantic host and its attributes; this adapter owns only
 * its text subtree. The stable initial child also supplies readable SSR.
 * Inline interactive children belong outside this plain-text adapter. A ref
 * resolves to the host element.
 */
export const TypesetText = /* @__PURE__ */ forwardRef<HTMLElement, TypesetTextProps>(function TypesetText({ text, as = 'p', mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour, priority = 'auto', onResult, ...attributes }, forwarded) {
  const ref = useRef<HTMLElement | null>(null);
  const refCleanup = useRef<(() => void) | undefined>(undefined);
  // A classic callback ref (node, then null), which React 18 and 19 both
  // call; a React 19 caller's own cleanup is kept and run on detach.
  const setHost = useCallback((node: HTMLElement | null) => {
    ref.current = node;
    if (node) refCleanup.current = assignRef(forwarded, node);
    else { if (refCleanup.current) refCleanup.current(); else assignRef(forwarded, null); refCleanup.current = undefined; }
  }, [forwarded]);
  const [initialText] = useState(text);
  const options = useRef<Options>({ text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour });
  options.current = { text, mode, keep, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour };
  const report = useRef(onResult);
  report.current = onResult;
  // Curl quotes during render, so server HTML, no-JS readers and crawlers get
  // them and hydration matches. Education is idempotent; typeset() still owns
  // later text. An ancestor's lang is invisible here, so only a missing or
  // English lang prop qualifies, as the DOM path's scope check would allow.
  const curled = smartQuotes === 'en' && (!attributes.lang || /^en(?:-|$)/i.test(attributes.lang));
  // The text as it shows before composition: educated like the server HTML.
  const native = useRef('');
  native.current = curled ? educate(text) : text;
  const entry = useRef<AdapterEntry | null>(null);
  // By value: an inline keep={[...]} is a new array on every parent render.
  const keepKey = keep?.join('\u0000');
  // One registration per host element. Unmounting does not restore: React
  // discards the host with its composed lines.
  useClientLayoutEffect(() => {
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
        const callback = report.current;
        // After the commit, outside the registry's own writes.
        if (callback) queueMicrotask(() => callback(result));
      },
      changed: fonts => layoutKey(element, fonts) !== key,
      widest: () => widest,
      stale() { restore(element); element.dataset.tsStale = ''; widest = 0; },
      translation(active) {
        // typeset() steps aside while a page is translated: it unwraps its
        // breaks by moving Text nodes and records native:translated.
        if (active) { typeset(element, options.current); widest = 0; }
        else registry.request(current, 'force', false);
      },
      deferred() {
        // Until it composes, the host shows the current text natively.
        if (element.textContent !== native.current) { restore(element); element.textContent = native.current; widest = 0; }
      },
      unsupported() {
        if (element.textContent !== native.current) element.textContent = native.current;
        element.dataset.tsOutcome = ENVIRONMENT_OUTCOME;
        const callback = report.current;
        const none = { lines: [], width: 0, overflow: 0, firstSingleton: false, lastSingleton: false, rag: 0 };
        if (callback) queueMicrotask(() => callback({ outcome: ENVIRONMENT_OUTCOME, mode: options.current.mode || (/^H[1-6]$/.test(element.tagName) ? 'title' : 'body'), before: none, after: none, changed: false, durationMs: 0 }));
      },
    };
    entry.current = current;
    registry.add(current);
    registry.request(current, 'mount', true);
    return () => { registry.remove(current); entry.current = null; };
  }, [as]);
  useClientLayoutEffect(() => { if (entry.current) entry.current.priority = priority; }, [priority]);
  const first = useRef(true);
  useClientLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const current = entry.current;
    if (current) adapterRegistry(current.element.ownerDocument).request(current, 'force', true);
  }, [text, mode, keepKey, maxLines, density, lineBreaks, smartQuotes, opticalHanging, spacing, tracking, contour]);
  return createElement(as, { ...attributes, ref: setHost, 'data-typeset-react': '' }, curled ? educate(initialText) : initialText);
});
