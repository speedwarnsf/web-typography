'use client';

import { useEffect } from 'react';
import { typesetText, typesetHeading, measureCh, shouldIgnoreMutation, safeWrite, tokenize, composeParagraph, shapeExactLines, finalValidate, renderFrozenLines } from '@/lib/typeset';

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
      // Select paragraphs eligible for composition
      const paragraphs = document.querySelectorAll<HTMLElement>(
        'p:not([data-no-typeset]):not([data-no-smooth]):not([data-typeset-done])'
      );

      paragraphs.forEach((p) => {
        try {
          const text = canonicalText.get(p) || p.textContent || '';

          if (text.length < 30) {
            // Too short for compositor — mark done
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          // Skip if inside excluded containers
          if (p.closest('[data-no-typeset], [data-no-smooth], pre, code, .demo, [role="tabpanel"]')) {
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          // Skip centered text (auto-detect)
          const textAlign = getComputedStyle(p).textAlign;
          if (textAlign === 'center') {
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          // Store canonical text if not already stored
          if (!canonicalText.has(p)) {
            canonicalText.set(p, text);
          }

          // Measure paragraph dimensions
          const measureChars = measureCh(p);
          const cs = getComputedStyle(p);
          let measurePx = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);

          // Safety margin for italic text — italic overhang causes tokens
          // to render ~5% wider than the measurer calculates
          if (cs.fontStyle === 'italic') {
            measurePx *= 0.92;
          }

          if (measurePx <= 0) {
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          // Create hidden measurer for token widths
          const measurer = document.createElement('span');
          measurer.style.cssText =
            'position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none;' +
            'font:inherit;letter-spacing:inherit;word-spacing:inherit;';
          p.style.position = p.style.position || 'relative';
          p.appendChild(measurer);

          const measureText = (txt: string): number => {
            measurer.textContent = txt;
            return measurer.getBoundingClientRect().width;
          };

          // Step 1: Tokenize
          const tokens = tokenize(text, measureText);

          // Step 2: Compose paragraph (beam search for exact lines)
          const composition = composeParagraph(tokens, measurePx, measureChars);

          // Remove measurer
          p.removeChild(measurer);

          if (!composition) {
            // No valid composition — fall back to browser default
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          // Step 3: Shape exact lines (adjust word-spacing within fixed membership)
          const shaped = shapeExactLines(composition, measureChars, measurePx);

          if (!shaped) {
            // Shaping failed — fall back to browser default
            safeWrite(() => {
              p.setAttribute('data-typeset-done', '');
            });
            return;
          }

          // Step 4: Final validation — if it fails, still render the composition
          // (compositor scoring already prevents the worst outcomes,
          // falling back to browser is worse than a slightly imperfect composition)
          if (!finalValidate(shaped, measureChars)) {
            // Try rendering anyway — compositor output is still better than browser
          }

          // Step 5: Render frozen lines
          renderFrozenLines(p, shaped);

        } catch (e) {
          // Silently skip on error — mark done to avoid retry loops
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

      // Phase 2: Wait for fonts, then optimize + sculpt
      try {
        await document.fonts.ready;
        requestAnimationFrame(() => {
          runPhase2();
        });
      } catch (e) {
        // Fallback if fonts.ready fails
        setTimeout(() => {
          requestAnimationFrame(() => {
            runPhase2();
          });
        }, 1000);
      }
    };

    // Initial run (delayed to avoid hydration mismatch)
    setTimeout(() => {
      runPipeline();
    }, 100);

    // Delayed re-runs to catch dynamically loaded content (Supabase data, etc.)
    const delayedRuns = [
      setTimeout(() => runPipeline(), 1500),
      setTimeout(() => runPipeline(), 4000),
    ];

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
        requestAnimationFrame(() => {
          runPipeline();
        });
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

            const original = canonicalText.get(el);
            if (original) {
              el.textContent = original;
            }
          });

          requestAnimationFrame(() => {
            runPipeline();
          });
        }
      }
    });

    // Observe all paragraphs
    const observeElements = () => {
      const elements = document.querySelectorAll<HTMLElement>(
        'p:not([data-no-typeset]), ' +
        'li:not([data-no-typeset]), ' +
        'blockquote:not([data-no-typeset])'
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

    // --- Cleanup ---
    return () => {
      observer.disconnect();
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      clearInterval(reObserveTimer);
      delayedRuns.forEach(clearTimeout);
    };
  }, []);

  return null;
}
