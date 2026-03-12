# typeset.us — Architecture & Known Issues

## Project Overview
- **Site:** typeset.us
- **Stack:** Next.js 15, Tailwind, Vercel
- **Repo:** speedwarnsf/web-typography
- **Deploy:** Git auto-deploy broken as of March 2026. Use `vercel --prod --yes` manually.

## Mobile Is the Priority

Most people visit websites on their phones. This is not an edge case — it is the primary use case. Typography that only works at 55-75ch desktop reading widths is solving a problem most users will never see.

**Mobile is the primary context.** The tool must work at every width, but mobile is where 99% of users will see the outcome of typeset in use. People implementing this tool are building websites. People visit websites on their phones. That's the reality.

Desktop matters too — long-form articles, documentation, books — and the tool must serve those contexts. But if we have to choose where to get it right first, it's mobile. Always.

The mistake we've made is treating mobile as a lesser context — disabling features at narrow widths instead of making them work there. That's backwards. If the tool can't improve typography at 375px, it fails where it matters most.

- **Mobile (320-414px):** The primary target. 99% of end users. If the tool makes things worse here, it's a regression — full stop.
- **Tablet (768-1024px):** Important middle ground.
- **Desktop (1200px+):** The tool already works here. Keep it working.

This means:
- **Test at 375px first.** Then verify at wider widths. Mobile is not the afterthought check.
- **Demos must show meaningful differences at mobile widths.** A comparison that only works at 65ch is not selling the tool to anyone.
- **If a typesetting rule makes mobile worse** (orphans, stranded words, worse rag), fix the algorithm for that width. Don't just disable it.
- **All pages and components must be designed mobile-first, then enhanced for desktop.**

This principle applies to every web project, not just this one.

## AnimatedHeroHeading

The homepage hero displays "Web Typography" where the word "Typography" animates through chaotic font/weight/size/rotation states before resolving to Playfair Display.

### CRITICAL: Descender Clipping

**The word "Typography" contains descenders (y, p).** Any `overflow: hidden` on the letter slots, the inline-flex wrapper, or the `<h1>` will clip the bottom of these characters.

**Rule: Use `overflow-x: clip` + `overflow-y: visible` on the `<h1>`. NO overflow properties on inner elements.**

**CSS spec gotcha:** `overflow-x: hidden` forces `overflow-y: visible` → `auto` (which clips). `overflow-x: clip` does NOT have this behavior — `clip` is not `hidden`. With `clip`, you can truly have `overflow-x: clip` + `overflow-y: visible`.

**The correct fix (v3):**
1. `<h1>`: `overflow-x: clip; overflow-y: visible` — clips horizontal chaos, descenders render freely below
2. `<span style="display: inline-flex">` (Typography wrapper): **NO overflow properties**
3. Each letter `<span>`: **NO overflow properties**, `lineHeight: 1.2` for descender room in slots

**History of this bug:**
- First appeared when overflow:hidden was added to prevent chaos animation from causing horizontal scroll
- "Fixed" with padding-bottom adjustments — band-aid, descenders still clipped at certain sizes
- "Fixed" with overflow-x:hidden + overflow-y:visible — doesn't work (CSS spec: visible → auto)
- "Fixed" with overflow:hidden + large paddingBottom — works at some sizes, fails at others (animation chaos phase pushes content beyond padding)
- **Real fix (2026-03-09 v3):** `overflow-x: clip; overflow-y: visible` — the ONLY approach that truly allows vertical overflow while clipping horizontal. Works at all sizes and during all animation phases.
- DO NOT use `overflow: hidden` or `overflow-x: hidden` anywhere in this component

### Animation Timing
- Tick speed: 140ms
- Cycle: 15 ticks hold → 25 ticks chaos → 15 ticks resolving
- REGULARITY: 0.73 (controls how wild the chaos phase gets)

## typeset.ts — The Typesetting Engine

### Current State (as of 2026-03-09)

The algorithm tiers bindings by actual container width in `ch` units:

| Measure | What fires | Why |
|---------|-----------|-----|
| < 25ch | Nothing | Too narrow for any binding to help |
| 25-44ch | Orphan prevention + number binding | At ~5-7 words/line, more bindings constrain the browser and make things worse |
| 45-49ch | + tiny word binding (1-2 char) | Medium columns can absorb small forced pairs |
| 50-54ch | + sentence protection | Enough room for sentence-start/end rules |
| 55-64ch | + medium word binding (3 char) | "the", "and", "but" etc. |
| 65ch+ | + full short-word binding | Wide columns, full rules |

**Critical: every page that calls `typesetText()` directly MUST pass `measure`.**
The `typeset()` DOM function measures automatically via `measureCh()`. But if you call `typesetText(text)` without options, it defaults to 65ch and fires ALL bindings — even on a 30ch mobile screen. This was the root cause of the "tool makes mobile worse" bug.

At mobile widths, CSS `text-wrap: pretty` does the heavy lifting. JS adds orphan prevention (last two words bound) and number binding ("30 years" stays together). That's honest and it works.

### Beyond Bindings — JS Is a Multi-Functional System

The nbsp binding approach is ONE technique. JS has full DOM access — it can measure rendered lines, detect bad patterns, and apply targeted fixes that CSS alone cannot.

Techniques available at ANY width, including mobile:

1. **smoothRag (word-spacing adjustment):** Measures actual line widths, adjusts word-spacing per line to even out the right edge. Works at every width because it reads the real layout, not guessing from character counts. Already implemented — needs mobile refinement.

2. **Post-render analysis:** After the browser lays out text, JS can measure each line and detect problems: orphaned last lines, lines significantly shorter/longer than neighbors, bad rag shapes. Then apply targeted fixes.

3. **Dynamic hyphenation control:** CSS `hyphens: auto` is blunt. JS can measure where a hyphen would actually help (preventing a very short or very long line) and insert soft hyphens (`&shy;`) only where they improve the layout.

4. **Letter-spacing micro-adjustments:** Per-line letter-spacing (±0.02em) to smooth rag without visible change to character spacing. More subtle than word-spacing.

5. **Optical margin alignment:** Move punctuation and certain glyphs slightly outside the text block for optically even edges. CSS `hanging-punctuation` covers some cases; JS can handle more.

6. **Line-break optimization:** Measure actual rendered line lengths, then use targeted nbsp or `<wbr>` insertions to fix specific bad breaks — not blanket binding of all short words.

7. **Widow/orphan detection on real lines:** Instead of always binding the last two words (which may not help), measure whether the last line actually IS an orphan in the current layout, and only intervene when needed.

**The principle:** Measure first, then intervene surgically. Don't apply blanket rules based on character counts — read the actual rendered layout and fix what's actually broken.

The current binding tiers (above) are a safety floor. The real value comes from the post-render techniques that work at every width.

### Implementation Status (as of March 11, 2026)

| Technique | Status | Notes |
|-----------|--------|-------|
| optimizeBreaks (Pass 1) | ✅ Deployed | Knuth-Plass DP with break quality rules, stairstep demerits, cubic badness. Applies via nbsp injection — preserves all HTML. |
| shapeRag (Pass 2) | ✅ Deployed | Per-line word-spacing + letter-spacing with Tschichold tolerances, line-height scaling, neighbor dampening, anti-justification guard. |
| Post-render line analysis | ✅ Deployed | Wraps words in spans, groups by offsetTop, measures actual line widths. Used by both passes. |
| Real-line widow/orphan detection | ✅ Deployed | `fixRealOrphans()` measures actual rendered lines, only binds when last line has exactly 1 word. |
| smoothRag (legacy) | Superseded | Replaced by the optimizeBreaks → shapeRag two-pass system. Code still exists but is not called. |
| Dynamic hyphenation | ❌ Not built | Explicitly rejected — "Fuck the hyphen, we have math." |
| Optical margin alignment | ⚠️ CSS only | `hanging-punctuation: first last` applied via CSS. No JS-driven optical alignment. |

**The full two-pass pipeline runs on every `<p>` with 80+ chars, 1.6s after page load, and re-runs on resize.**

**Next priorities:** Port shapeRag to go.js distributable. Replace static before/after PNGs with live interactive toggle.

### The Two-Pass System: optimizeBreaks → shapeRag

**Pass 1: `optimizeBreaks(element, { onApplied: () => shapeRag(element) })`**
- Knuth-Plass DP over all break configurations (25-word lookback)
- Break quality: 35 prepositions, 6 conjunctions, 3 articles (penalty 500 each)
- Sentence start protection (penalty 500)
- Stairstep demerits: >15% fill diff = +200, >10% = +80
- Cubic badness centered on 85% fill
- Applies via nbsp injection — walks innerHTML preserving all HTML tags
- ResizeObserver re-runs on window resize

**Pass 2: `shapeRag(element)`**
- Runs as callback after each optimizeBreaks application
- Wraps words in measurement spans, groups by offsetTop into lines
- Computes median target from non-last-line widths
- Per-line word-spacing: Tschichold tolerances (80–133% of natural space × lhScale)
- Per-line letter-spacing: ±2% of em × lhScale (secondary lever)
- Line-height adaptive scaling: `lhScale = 1.0 + (lhRatio - 1.5)`
- Asymmetric neighbor dampening: expanding × 0.85, contracting × 0.65
- Anti-justification guard: >92% fill + <4% range → scale 50%
- Near-justified + orphan pattern: avg >88% + last <60% → target at 82%

**Rules:**
- NEVER split on patterns that match `\u00A0` — it destroys typesetText bindings
- ALWAYS verify textContent after processing (no concatenated words)
- Word-spacing adjustments must be subtle — users should not perceive justification

### smoothRag() — LEGACY

Superseded by the optimizeBreaks → shapeRag two-pass system as of March 11, 2026. Code remains in typeset.ts but is no longer called by GlobalTypeset. Retained for reference and potential use in go.js until shapeRag is ported.

**CRITICAL BUG HISTORY (from smoothRag era):**
1. **Split on `[\s\u00A0]+`** destroyed nbsp bindings from typesetText. Fix: split on `/ +/` (regular spaces only). (2026-03-09)
2. **`<br>` joins** concatenated words in textContent. Fix: use `white-space: pre-line` + `\n` joins. (2026-03-09)
3. **display:block spans** also concatenated words in textContent. Same fix as above. (2026-03-09)
4. **Word-spacing too aggressive on mobile** (MAX_EXPAND 1.5px created justified look). Reduced to 0.6px at <350px. (2026-03-09)

### measureCh()

Measures container width in `ch` units. 

**NEVER use DOM probe spans** (inserting elements to measure) — this triggers MutationObserver infinite loops when GlobalTypeset is active. Use `Canvas.measureText()` with WeakMap caching instead. (Bug found 2026-03-08)

## BackToTop Component

Fixed-position button that appears after scrolling 600px. On desktop, follows mouse X position. On mobile (no mousemove events), pins to bottom-right corner.

**Positioning:** `position: fixed; bottom: 16px; right: 16px` (mobile) or `left: [mouseX]` (desktop). z-index: 50.

**Known issue:** On mobile, the button can overlap content in comparison panels or text blocks near the bottom of the viewport. Content sections that extend to the bottom of the page should account for the button's 40x40px footprint.

## Page-Specific Notes

### Perfect Paragraph (`/perfect-paragraph`)
- Side-by-side comparison on desktop: "Browser Default" vs "Typeset" panels
- **Mobile: toggle bar** — Default/Typeset toggle shows one panel at a time. Users tap to compare. Desktop keeps side-by-side layout unchanged.
- The "Typeset" panel measures its container via `measureCh()` and passes to `typesetText()`. Post-render analysis (`postRenderFix`) runs after layout to catch real orphans and smooth rag.
- Both panels MUST have `data-no-typeset` and `data-no-smooth` to prevent GlobalTypeset from processing them (which would make both panels identical, defeating the comparison).

### Go Page (`/go`)
- "Without go.js" vs "With go.js" comparison
- Uses `typeset()` (DOM function) on the "With" panel, which auto-measures

### go.js — The Distributable (`public/go.js`)

go.js v2.0 is the script users download via `<script src="https://typeset.us/go.js">`. It is a standalone IIFE (no dependencies) that mirrors the core typeset.ts algorithm.

| Feature | typeset.ts | go.js v2.0 |
|---------|-----------|------------|
| Measure-aware binding tiers | ✅ | ✅ Same thresholds |
| Post-render orphan detection | ✅ fixRealOrphans | ✅ fixRealOrphans |
| Post-render rag smoothing | ✅ fixRag | ✅ smoothRagLight |
| smoothRag (Knuth-Plass) | ✅ Full | ❌ Light version only |
| CSS enhancements | ✅ Via toggles | ✅ text-wrap, hanging-punctuation, font-features |
| MutationObserver | ✅ Paused during mutations | ✅ Paused during mutations, no double-processing |
| Heading mode | ✅ | ✅ |

**Keeping in sync:** go.js is manually maintained. When changing binding thresholds, word lists, or detection logic in typeset.ts, the same changes MUST be ported to go.js. Future improvement: build go.js from typeset.ts via a bundler.

### Font Pairing Cards (`/pairing-cards`)
- Live preview uses `typeset()` via ref + useEffect, auto-measuring the container
- Body text set via `data-no-typeset data-no-smooth` to prevent GlobalTypeset double-processing
- Generated PNG cards (mobile + square) are created via html2canvas — these apply smoothRag in an off-screen container. Test that generated images look correct at both sizes.
- On mobile, the sidebar controls stack above the preview. Font dropdowns need 44px min touch targets.

### Homepage (`/`)
- AnimatedHeroHeading: see dedicated section above
- GlobalTypeset processes all body text on this page — no page-specific overrides

## GlobalTypeset Double-Processing

**Risk:** If a page does its own `typeset()` or `typesetText()` on an element, AND GlobalTypeset also processes that element, the text gets double-processed. This can compound bindings (creating chains of nbsp-bound words) or cause smoothRag to run on already-smoothed text.

**Prevention:** Any element that a page processes directly MUST have `data-no-typeset` (to skip GlobalTypeset's typesetText pass) and optionally `data-no-smooth` (to skip smoothRag). The page then handles typesetting itself with the correct measure.

Currently protected:
- Perfect Paragraph: both panels have `data-no-typeset data-no-smooth`
- Go page: both panels have `data-no-typeset data-no-smooth`
- Pairing cards: preview body has `data-no-typeset data-no-smooth`
- AnimatedHeroHeading: `data-no-typeset` on the `<h1>`

**If you add a new page with custom typesetting, add these attributes.**

## Pages

15 pages total. All must pass:
- No horizontal overflow at 375px
- No console errors
- No concatenated words in textContent
- Example images loading correctly

## Deployment

- Repo: `speedwarnsf/web-typography`, branch: `master`
- Git auto-deploy is broken — always deploy with `vercel --prod --yes`
- Safari caches aggressively — tell users to hard-refresh (Cmd+Shift+R)

## GlobalTypeset

Runs the full typesetting pipeline on all text elements:

1. **Phase 1 (100ms, 600ms, 1600ms):** `typesetAll` + `typesetHeading` — pre-render nbsp bindings
2. **Phase 2b (1600ms + rAF):** `fixRealOrphans` — post-render orphan detection on actual rendered lines
3. **Phase 3 (1600ms + rAF + 200ms):** `optimizeBreaks` → `shapeRag` — the full two-pass system

MutationObserver handles dynamically added content (Phase 1 only — Phases 2/3 don't re-trigger to prevent infinite loops).

**Exclusions:** Elements with `data-no-typeset` skip typesetText. Elements with `data-no-smooth` skip optimizeBreaks + shapeRag. The AnimatedHeroHeading uses `data-no-typeset` on its `<h1>`.

The "Browser Default" panel on the Perfect Paragraph page MUST have both `data-no-typeset` and `data-no-smooth` — otherwise both panels look identical and the comparison is meaningless.
