'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** The element's content-box width, as ResizeObserver's inlineSize reports it. */
function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}

/**
 * Keeps a demo element composed for its current width.
 *
 * Demo pages compose their text themselves with one-shot typeset(), and opt
 * those elements out of the site's global controller, which is what
 * recomposes on resize. Composed lines end in <br>s measured for one width,
 * so after a rotation or a window resize the browser wrapped each composed
 * line again and painted alternating long and short lines (9 composed lines
 * painted as 18 on /perfect-paragraph at 375 -> 320 px).
 *
 *   const [widthKey, markComposed] = useComposedWidth(ref);
 *   useEffect(() => { typeset(ref.current); markComposed(); }, [text, widthKey]);
 *
 * markComposed() records the width the text was just composed for. When the
 * element's content-box inline size then differs from it by 2 px or more
 * and holds for 100 ms (the engine's own resize window), widthKey changes in
 * an animation frame, never inside the ResizeObserver callback, so
 * recomposing cannot feed the observer in the same frame. Height-only
 * changes are ignored, and so is a zero width: a hidden panel recomposes
 * when it shows at a width other than the one it was composed for.
 */
export function useComposedWidth(ref: RefObject<HTMLElement | null>): [number, () => void] {
  const [widthKey, setWidthKey] = useState(0);
  const composedFor = useRef(-1);

  const markComposed = useCallback(() => {
    const element = ref.current;
    if (element) composedFor.current = contentWidth(element);
  }, [ref]);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let latest = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    const cancel = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      timer = undefined;
      frame = 0;
    };
    const stale = (width: number) => composedFor.current >= 0 && Math.abs(width - composedFor.current) >= 2;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry.contentBoxSize?.[0];
      const inline = box ? box.inlineSize : entry.contentRect.width;
      cancel();
      if (inline < 1 || !stale(inline)) return;
      latest = inline;
      timer = setTimeout(() => {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (stale(latest)) setWidthKey((key) => key + 1);
        });
      }, 100);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancel();
    };
  }, [ref]);

  return [widthKey, markComposed];
}
