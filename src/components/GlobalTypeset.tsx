'use client';

import { useEffect } from 'react';
import typesetEngine, { typesetText, typesetHeading, measureCh, shouldIgnoreMutation, safeWrite } from '@/lib/typeset';

/**
 * GlobalTypeset — Single-owner pipeline architecture.
 *
 * Pipeline:
 *   Phase 1 (immediate, pre-render): typesetText/typesetHeading — nbsp bindings only
 *   Phase 2 (after fonts.ready + rAF): optimizeBreaks + shapeRag on each eligible paragraph
 *
 * Key changes from old architecture:
 *   - WeakMap stores canonical raw text before any processing
 *   - document.fonts.ready before measurement
 *   - Single pipeline pass (no triple timeout chain)
 *   - Orphan prevention built into optimizeBreaks (not separate pass)
 *   - MutationObserver ignores own DOM writes via isInternalWrite flag
 *   - ResizeObserver for width-change reprocessing
 *   - data-typeset-done marks finalized paragraphs
 */

const canonicalText = new WeakMap<HTMLElement, string>();

export default function GlobalTypeset() {
  useEffect(() => {
    let resizeObserver: ResizeObserver | null = null;

    // --- Phase 1: Pre-render bindings (no measurement needed) ---
    const runPhase1 = () => {
      // Body text: typesetText with measure-aware binding
      const bodyElements = document.querySelectorAll<HTMLElement>(
        'p:not([data-no-typeset]):not([data-typeset-done]), ' +
        'li:not([data-no-typeset]):not([data-typeset-done]), ' +
        'blockquote:not([data-no-typeset]):not([data-typeset-done]), ' +
        'figcaption:not([data-no-typeset]):not([data-typeset-done])'
      );

      bodyElements.forEach((el) => {
        // Skip centered text entirely in Phase 1
        const textAlign = getComputedStyle(el).textAlign;
        if (textAlign === 'center') return;

        if (!canonicalText.has(el)) {
          // Store canonical text before any processing
          canonicalText.set(el, el.textContent || '');
        }

        // Measure container width in ch
        const measure = measureCh(el);

        // Apply pre-render bindings
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const textNodes: Text[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          textNodes.push(node as Text);
        }

        safeWrite(() => {
          for (const textNode of textNodes) {
            const original = textNode.textContent;
            if (!original || original.trim().length < 10) continue;
            const leadingSpace = original.match(/^\s*/)?.[0] || '';
            const trailingSpace = original.match(/\s*$/)?.[0] || '';
            const processed = typesetText(original.trim(), { measure });
            textNode.textContent = leadingSpace + processed + trailingSpace;
          }
        });
      });

      // Headings: typesetHeading
      const headings = document.querySelectorAll<HTMLElement>(
        'h1:not([data-no-typeset]):not([data-typeset-done]), ' +
        'h2:not([data-no-typeset]):not([data-typeset-done]), ' +
        'h3:not([data-no-typeset]):not([data-typeset-done]), ' +
        'h4:not([data-no-typeset]):not([data-typeset-done])'
      );

      headings.forEach((el) => {
        if (!canonicalText.has(el)) {
          canonicalText.set(el, el.textContent || '');
        }

        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const textNodes: Text[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          textNodes.push(node as Text);
        }

        safeWrite(() => {
          for (const textNode of textNodes) {
            const original = textNode.textContent;
            if (!original || original.trim().length < 5) continue;
            const leadingSpace = original.match(/^\s*/)?.[0] || '';
            const trailingSpace = original.match(/\s*$/)?.[0] || '';
            textNode.textContent = leadingSpace + typesetHeading(original.trim()) + trailingSpace;
          }
        });
      });
    };

    // --- Phase 2: Compositor V2 — token-aware beam search (measurement required) ---
    const runPhase2 = () => {
      // Select blocks eligible for composition. Headings compose too (the
      // engine's heading mode: sentence-boundary breaks, epistrophe-aware
      // widow rules) — parity with the go.js drop-in. Inline-markup and
      // centered blocks are guarded below, so decorated headings like the
      // animated hero are untouched.
      const paragraphs = document.querySelectorAll<HTMLElement>(
        ['p', 'li', 'blockquote', 'figcaption', 'h1', 'h2', 'h3', 'h4']
          .map((t) => `${t}:not([data-no-typeset]):not([data-no-smooth]):not([data-typeset-done])`)
          .join(', ')
      );

      paragraphs.forEach((p) => {
        try {
          const text = canonicalText.get(p) || p.textContent || '';

          // The compositor strictly replaces content with text nodes; blocks
          // with real inline markup (<strong>, <a>, dropcaps) keep Phase 1
          // bindings only. Short blocks compose poorly — skip those too.
          if (p.querySelector('*') !== null || text.length < 30) {
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          if (p.closest('[data-no-typeset], [data-no-smooth], pre, code, .demo, [role="tabpanel"]')) {
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          if (getComputedStyle(p).textAlign === 'center') {
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          if (!canonicalText.has(p)) {
            canonicalText.set(p, text);
          }

          // ONE engine, ONE path. This used to be a hand-rolled parallel
          // wiring (own span measurer, direct composeParagraph/finalValidate/
          // renderFrozenLines calls) that failed in ways the real path
          // doesn't — the /library headline fell back to browser wrapping
          // and orphaned. typeset() carries the whole battle-tested
          // pipeline: quote education, heading mode, contour re-ranking,
          // spacing, overflow self-check, outcome reporting.
          p.dataset.tsRaw = text;
          typesetEngine(p);

          // typeset() marks success itself (data-typeset-done="1"). If it
          // fell back, mark done so we don't retry every pipeline pass —
          // the fonts.loadingdone reset un-marks when metrics change.
          if (!p.hasAttribute('data-typeset-done')) {
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
          }
        } catch {
          safeWrite(() => {
            p.setAttribute('data-typeset-done', '');
          });
        }
      });
    };

    // --- Pipeline execution ---
    const runPipeline = async () => {
      // Phase 1: Pre-render bindings (can run immediately)
      runPhase1();

      // Phase 2: Wait for fonts, then optimize + sculpt. Run directly — NOT
      // inside requestAnimationFrame: rAF never fires in hidden/background
      // tabs, so pages opened in a background tab would stay un-typeset and
      // visibly jump the moment the reader focused them. Running while hidden
      // means the text is already set before anyone looks at it.
      try {
        await document.fonts.ready;
        runPhase2();
      } catch (e) {
        // Fallback if fonts.ready fails
        setTimeout(() => {
          runPhase2();
        }, 1000);
      }
    };

    // Initial run (delayed to avoid hydration mismatch)
    setTimeout(() => {
      runPipeline();
    }, 100);

    // No blanket delayed re-runs: the MutationObserver catches dynamically
    // added content, and the surgical fonts.loadingdone pass handles late
    // webfonts. The old 1.5s/4s full-page re-runs recomposed pages while
    // people were already reading them — the "visible redraw" on /support.
    const delayedRuns: ReturnType<typeof setTimeout>[] = [];

    // --- MutationObserver for dynamic content ---
    const observer = new MutationObserver((mutations) => {
      // Ignore our own writes
      if (shouldIgnoreMutation()) return;

      // Check if mutations added genuinely new content
      let hasNewContent = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            // Check if this is new typeset-eligible content
            if (el.matches) {
              // Check if the added node itself is typeset-eligible
              const isEligible = el.matches('p, li, blockquote, figcaption, h1, h2, h3, h4') &&
                !el.hasAttribute('data-typeset-done') &&
                !el.hasAttribute('data-no-typeset');
              // Also check if it CONTAINS typeset-eligible children
              const hasEligibleChildren = !isEligible &&
                el.querySelector('p:not([data-typeset-done]):not([data-no-typeset]), li:not([data-typeset-done]):not([data-no-typeset])');
              if (isEligible || hasEligibleChildren) {
                hasNewContent = true;
                break;
              }
            }
          }
        }
        if (hasNewContent) break;
      }

      if (hasNewContent) {
        // setTimeout, not rAF — rAF never fires in hidden tabs (see runPipeline)
        setTimeout(() => {
          runPipeline();
        }, 0);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // --- ResizeObserver for width changes ---
    // Track last known widths to only reprocess on REAL width changes (not height changes from our own writes)
    const lastWidths = new WeakMap<HTMLElement, number>();

    resizeObserver = new ResizeObserver((entries) => {
      if (shouldIgnoreMutation()) return;

      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const newWidth = entry.contentRect.width;
        const prevWidth = lastWidths.get(el) ?? -1;

        // Only reprocess if WIDTH actually changed (not height from our block span conversion)
        if (Math.abs(newWidth - prevWidth) < 2) continue;
        lastWidths.set(el, newWidth);

        if (el.hasAttribute('data-typeset-done')) {
          safeWrite(() => {
            el.removeAttribute('data-typeset-done');

            // Composed-only restore — see the loadingdone handler. Never
            // flatten real markup with a textContent write.
            const original = canonicalText.get(el);
            if (original && el.querySelector(':scope > .ts-line')) {
              el.textContent = original;
            }
          });

          setTimeout(() => {
            runPipeline();
          }, 0);
        }
      }
    });

    // Observe all paragraphs
    const observeElements = () => {
      const elements = document.querySelectorAll<HTMLElement>(
        ['p', 'li', 'blockquote', 'figcaption', 'h1', 'h2', 'h3', 'h4']
          .map((t) => `${t}:not([data-no-typeset])`)
          .join(', ')
      );
      elements.forEach((el) => {
        if (resizeObserver) {
          resizeObserver.observe(el);
        }
      });
    };

    observeElements();

    // Re-observe after mutations (for dynamically added content)
    const reObserveTimer = setInterval(observeElements, 5000);

    // --- Re-typeset when webfonts finish loading ---
    // document.fonts.ready can resolve before late-triggered font loads start,
    // so a paragraph composed against fallback metrics renders wrong once the
    // real font arrives. When loading settles, restore canonical text and
    // recompose with true metrics.
    //
    // SURGICAL, not global: pages like the pairings library load dozens of
    // Google Fonts, staggered. Resetting EVERY composed block on every
    // loadingdone event caused a recompose storm — text flashing, heights
    // collapsing, scroll position yanked (worst on mobile). Now: debounce
    // across events, reset only elements whose computed font-family is among
    // the faces that actually loaded, and put the reader's scroll back.
    const pendingFamilies = new Set<string>();
    let fontsTimer: ReturnType<typeof setTimeout> | null = null;
    const onFontsLoadingDone = (e: Event) => {
      const faces = (e as unknown as { fontfaces?: { family: string }[] }).fontfaces ?? [];
      for (const f of faces) {
        pendingFamilies.add(f.family.replace(/['"]/g, '').toLowerCase());
      }
      if (fontsTimer) clearTimeout(fontsTimer);
      fontsTimer = setTimeout(() => {
        const families = Array.from(pendingFamilies);
        pendingFamilies.clear();
        if (!families.length) return;
        const sx = window.scrollX;
        const sy = window.scrollY;
        let touched = 0;
        document.querySelectorAll<HTMLElement>('[data-typeset-done]').forEach((el) => {
          const original = canonicalText.get(el);
          if (!original) return;
          const fam = getComputedStyle(el).fontFamily.toLowerCase();
          if (!families.some((f) => fam.includes(f))) return;
          // Only restore textContent for blocks WE composed (.ts-line
          // children). For anything still carrying real markup, textContent
          // restore would FLATTEN it and weld words together (the About
          // credentials bug: two flex spans became "EducationNSCAD").
          const composed = !!el.querySelector(':scope > .ts-line');
          touched++;
          safeWrite(() => {
            el.removeAttribute('data-typeset-done');
            if (composed) el.textContent = original;
          });
        });
        if (!touched) return;
        runPipeline();
        // Recomposition changes heights above the fold — restore the reader.
        setTimeout(() => window.scrollTo(sx, sy), 60);
      }, 150);
    };
    document.fonts?.addEventListener?.('loadingdone', onFontsLoadingDone);

    // --- Cleanup ---
    return () => {
      observer.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      clearInterval(reObserveTimer);
      delayedRuns.forEach(clearTimeout);
      if (fontsTimer) clearTimeout(fontsTimer);
      document.fonts?.removeEventListener?.('loadingdone', onFontsLoadingDone);
    };
  }, []);

  return null;
}
