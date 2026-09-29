'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * The content-box inline size of an element that a demo page composes
 * itself with one-shot typeset(), as a value to list in the composing
 * effect's dependencies.
 *
 * Composed lines end in <br>s measured for one width. These demo elements
 * opt out of the site's global controller, which recomposes on resize, so
 * after a rotation or a window resize the browser wrapped each composed line
 * again and painted alternating long and short lines (9 composed lines
 * painted as 18 on /perfect-paragraph at 375 -> 320 px).
 *
 * The first observation is the width the page composed for and changes
 * nothing. After that, a width that differs by 2 px or more and holds for
 * 100 ms (the engine's own resize window) is committed in an animation
 * frame, never inside the ResizeObserver callback, so recomposing cannot
 * feed the observer in the same frame. Height-only changes are ignored, and
 * so is a zero width (a hidden panel keeps its composition until it shows
 * at a different width). Returns 0 until the first committed change.
 */
export function useComposedWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let composedFor = -1;
    let latest = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const cancel = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      timer = undefined;
      frame = 0;
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry.contentBoxSize?.[0];
      const inline = box ? box.inlineSize : entry.contentRect.width;
      if (composedFor < 0) {
        composedFor = inline;
        return;
      }
      cancel();
      if (inline < 1) return;
      latest = inline;
      if (Math.abs(inline - composedFor) < 2) return;
      timer = setTimeout(() => {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (Math.abs(latest - composedFor) < 2) return;
          composedFor = latest;
          setWidth(Math.round(latest));
        });
      }, 100);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancel();
    };
  }, [ref]);

  return width;
}
