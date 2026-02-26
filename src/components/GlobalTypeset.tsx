'use client';

import { useEffect } from 'react';
import { typesetAll, typesetHeading, smoothRag } from '@/lib/typeset';

/**
 * GlobalTypeset — applies typographic rules to all text on the page.
 * 
 * Phase 1: typesetAll + typesetHeading (orphan prevention, short-word binding)
 * Phase 2: smoothRag on eligible paragraphs (Knuth-Plass optimal line breaking)
 * 
 * smoothRag runs ONCE after all typeset passes complete. It is NOT re-triggered
 * by MutationObserver to prevent infinite DOM mutation loops.
 */
export default function GlobalTypeset() {
  useEffect(() => {
    let mutationPaused = false;
    const ragCleanups: Array<() => void> = [];

    const runBody = () => typesetAll('p:not([data-no-typeset]), li:not([data-no-typeset]), blockquote:not([data-no-typeset]), figcaption:not([data-no-typeset])');

    const runHeadings = () => {
      const headings = document.querySelectorAll<HTMLElement>('h1:not([data-no-typeset]), h2:not([data-no-typeset]), h3:not([data-no-typeset]), h4:not([data-no-typeset])');
      headings.forEach((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const textNodes: Text[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          textNodes.push(node as Text);
        }
        for (const textNode of textNodes) {
          const original = textNode.textContent;
          if (!original || original.trim().length < 5) continue;
          const leadingSpace = original.match(/^\s*/)?.[0] || '';
          const trailingSpace = original.match(/\s*$/)?.[0] || '';
          textNode.textContent = leadingSpace + typesetHeading(original.trim()) + trailingSpace;
        }
      });
    };

    const runSmooth = () => {
      // Clean up previous
      ragCleanups.forEach(fn => { try { fn(); } catch {} });
      ragCleanups.length = 0;

      // Pause mutation observer — smoothRag modifies innerHTML
      mutationPaused = true;

      const paragraphs = document.querySelectorAll<HTMLElement>(
        'p:not([data-no-typeset]):not([data-no-smooth])'
      );
      paragraphs.forEach((p) => {
        try {
          const text = p.textContent || '';
          if (text.length < 80) return;
          if (p.closest('[data-no-smooth], pre, code, .demo, [role="tabpanel"]')) return;
          const cleanup = smoothRag(p);
          ragCleanups.push(cleanup);
        } catch {
          // silently skip
        }
      });

      // Resume observer after DOM settles
      requestAnimationFrame(() => { mutationPaused = false; });
    };

    const runTypeset = () => {
      runBody();
      runHeadings();
    };

    // Phase 1: typeset passes
    runTypeset();

    // Phase 2: smoothRag after initial typeset settles
    // Runs once with MutationObserver paused to prevent infinite loop
    const timers = [
      setTimeout(runTypeset, 500),
      setTimeout(() => {
        runTypeset();
        // Run smoothRag after final typeset pass
        requestAnimationFrame(runSmooth);
      }, 1500),
    ];

    // Observer for dynamically added content — only runs typeset, not smoothRag
    const observer = new MutationObserver(() => {
      if (mutationPaused) return;
      requestAnimationFrame(runTypeset);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
      ragCleanups.forEach(fn => { try { fn(); } catch {} });
    };
  }, []);

  return null;
}
