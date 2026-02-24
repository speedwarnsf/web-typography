'use client';

import { useEffect } from 'react';
import { typesetAll, typesetHeading } from '@/lib/typeset';

/**
 * GlobalTypeset — applies typographic rules to all text on the page.
 * Body text (p, li, etc.) uses body mode (orphan prevention, short-word binding).
 * Headings (h1-h4) use heading mode (semantic phrase preservation).
 */
export default function GlobalTypeset() {
  useEffect(() => {
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

    const run = () => {
      runBody();
      runHeadings();
    };

    // Initial pass
    run();

    // Re-run after ScrollReveal animations might have loaded content
    const timers = [
      setTimeout(run, 500),
      setTimeout(run, 1500),
      setTimeout(run, 3000),
    ];

    // Observer for dynamically added content
    const observer = new MutationObserver(() => {
      requestAnimationFrame(run);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
    };
  }, []);

  return null;
}
