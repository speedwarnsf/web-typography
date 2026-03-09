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

### The Ongoing Challenge
Making the tool more valuable at mobile widths without making things worse. The browser's line-breaking is already good at narrow widths. Any binding we add constrains it. Only add bindings where the benefit clearly outweighs the constraint.

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
