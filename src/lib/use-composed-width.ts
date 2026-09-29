'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** The element's content-box width, as ResizeObserver's inlineSize reports it. */
function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return element.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}

/**
 * Keeps a demo element composed for its current width and fonts.
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
 *
 * A web font that finishes loading after the text was composed changes its
 * metrics without changing the width, so it recomposes the same way. On
 * /pairing-cards the preview composes as soon as a font is chosen, before
 * Google Fonts delivers it: 8 composed lines painted as 13 at 450 px when
 * Inter arrived 28 ms after the composition.
 */
export function useComposedWidth(ref: RefObject<HTMLElement | null>): [number, () => void] {
  const [widthKey, setWidthKey] = useState(0);
  const composedFor = useRef(-1);
  // A web font finished loading since the last composition.
  const fontsChanged = useRef(false);

  const markComposed = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    composedFor.current = contentWidth(element);
    fontsChanged.current = false;
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
    const stale = (width: number) => composedFor.current >= 0 && width >= 1 && (fontsChanged.current || Math.abs(width - composedFor.current) >= 2);
    const schedule = () => {
      cancel();
      if (!stale(latest)) return;
      timer = setTimeout(() => {
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (stale(latest)) setWidthKey((key) => key + 1);
        });
      }, 100);
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      const box = entry.contentBoxSize?.[0];
      latest = box ? box.inlineSize : entry.contentRect.width;
      schedule();
    });
    const onFonts = () => {
      if (composedFor.current < 0) return;
      fontsChanged.current = true;
      latest = contentWidth(element);
      schedule();
    };
    observer.observe(element);
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
      cancel();
    };
  }, [ref]);

  return [widthKey, markComposed];
}
