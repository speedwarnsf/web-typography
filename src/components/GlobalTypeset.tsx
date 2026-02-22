'use client';

import { useEffect } from 'react';
import { typesetAll } from '@/lib/typeset';

/**
 * GlobalTypeset — applies typographic rules to all body text on the page.
 * Drop this component once in the layout and forget about it.
 */
export default function GlobalTypeset() {
  useEffect(() => {
    // Run after initial render + ScrollReveal animations
    const run = () => typesetAll('p, h1, h2, h3, h4, li, blockquote, figcaption');

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
