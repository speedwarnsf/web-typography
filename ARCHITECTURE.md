# typeset.us — Architecture & Known Issues

## Project Overview
- **Site:** typeset.us
- **Stack:** Next.js 15, Tailwind, Vercel
- **Repo:** speedwarnsf/web-typography
- **Deploy:** Git auto-deploy broken as of March 2026. Use `vercel --prod --yes` manually.

## AnimatedHeroHeading

The homepage hero displays "Web Typography" where the word "Typography" animates through chaotic font/weight/size/rotation states before resolving to Playfair Display.

### CRITICAL: Descender Clipping

**The word "Typography" contains descenders (y, p).** Any `overflow: hidden` on the letter slots, the inline-flex wrapper, or the `<h1>` will clip the bottom of these characters.

**Rule: NEVER use `overflow: hidden` vertically on any ancestor of the animated text.**

Use `overflow-x: hidden` (to contain horizontal chaos animation) + `overflow-y: visible` (to preserve descenders). This applies to ALL THREE layers:
1. `<h1>` — the outermost container
2. `<span style="display: inline-flex">` — the "Typography" wrapper
3. Each letter `<span>` — individual character slots

**History of this bug:**
- First appeared when overflow:hidden was added to prevent chaos animation from causing horizontal scroll
- "Fixed" multiple times by adjusting padding-bottom and line-height, but those are band-aids
- The real fix is overflow-x/overflow-y split (applied 2026-03-09)
- DO NOT revert to `overflow: hidden` — it WILL clip descenders again

### Animation Timing
- Tick speed: 140ms
- Cycle: 15 ticks hold → 25 ticks chaos → 15 ticks resolving
- REGULARITY: 0.73 (controls how wild the chaos phase gets)

## typeset.ts — The Typesetting Engine

### What It Does Well (45-75ch reading widths)
- Prevents orphans and widows
- Binds short words to neighbors (prevents stranded prepositions)
- Protects sentence starts from dangling
- Binds numbers to their units

### What It Doesn't Do (< 35ch / mobile)
- At narrow widths, nbsp bindings don't change visible line breaks because bound pairs already fit on one line
- Binding rules are tiered by measure: no binding under 35ch, orphan-only at 35-45ch, full rules at 55ch+
- **Do not demo the tool at mobile widths — it won't show meaningful differences**

### smoothRag()

Adjusts word-spacing per line to create even rag (right edge alignment).

**CRITICAL BUG HISTORY:**
1. **Split on `[\s\u00A0]+`** destroyed nbsp bindings from typesetText. Fix: split on `/ +/` (regular spaces only). (2026-03-09)
2. **`<br>` joins** concatenated words in textContent. Fix: use `white-space: pre-line` + `\n` joins. (2026-03-09)
3. **display:block spans** also concatenated words in textContent. Same fix as above. (2026-03-09)
4. **Word-spacing too aggressive on mobile** (MAX_EXPAND 1.5px created justified look). Reduced to 0.6px at <350px. (2026-03-09)

**Rules:**
- NEVER split on patterns that match `\u00A0` — it destroys typesetText bindings
- ALWAYS verify textContent after smoothRag runs (no concatenated words)
- Word-spacing adjustments must be subtle — users should not perceive justification

### measureCh()

Measures container width in `ch` units. 

**NEVER use DOM probe spans** (inserting elements to measure) — this triggers MutationObserver infinite loops when GlobalTypeset is active. Use `Canvas.measureText()` with WeakMap caching instead. (Bug found 2026-03-08)

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

Runs typesetText + smoothRag on all text elements via MutationObserver.

**Exclusions:** Elements with `data-no-typeset` skip typesetText. Elements with `data-no-smooth` skip smoothRag. The AnimatedHeroHeading uses `data-no-typeset` on its `<h1>`.

The "Browser Default" panel on the Perfect Paragraph page MUST have both `data-no-typeset` and `data-no-smooth` — otherwise both panels look identical and the comparison is meaningless.
