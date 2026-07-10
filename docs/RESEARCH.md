# The Mathematics of Beautiful Paragraphs
## A Research & Implementation Journal

*Dustin York & Io — March 2026*
*typeset.us*

---

## Premise

The web abandoned paragraph-level typography forty years ago. When text moved from metal to phototype to digital, the tools that made narrow columns readable — hyphenation, paragraph-level optimization, skilled editing — were never rebuilt for the browser. CSS gives us `word-spacing`, `letter-spacing`, and `text-align: justify`. It does not give us taste.

This document records our attempt to bring that taste back, drawing on the mathematical foundations laid by the masters of the craft and encoding them as functions that run in the browser.

> **Status note (2026-07-09).** This is a journal, and journals accumulate
> history. Parts II–X document the v5/v6 architecture (`optimizeBreaks` +
> `shapeRag`), which was **retired on 2026-03-17** and no longer runs
> anywhere. The engine that actually ships — on typeset.us and in go.js —
> is a **beam-search compositor with post-render self-verification**,
> described in **Part XIII**, which is the only part of this document that
> speaks in the present tense. Where the historical parts claim something
> is "deployed" or "live," read that as *was, in March 2026*. Where they
> claim the optimizer "evaluates all possible break configurations," that
> was an overstatement even then (the v5 DP had a bounded lookback window),
> and the shipped engine makes no such claim: a beam search examines a
> pruned slice of the configuration space and **verifies its output**
> instead of asserting optimality. We keep the old parts because the
> failures in them — v3's merged words, the Pass 2 that was never wired —
> are part of the record.

**The thesis:** A well-set paragraph is not an accident. It is the product of measurable decisions — about where to break, how much to stretch, what to avoid — that have been understood for centuries. We can express those decisions as math, and the math can run on any text, any font, any column width, on any device, in milliseconds per paragraph (measured, not asserted: docs/BENCHMARKS.md — median 1.4 ms per paragraph in Chromium at desktop speed, 6.6 ms at a 4x-throttled mid-range-phone proxy).

**The constraint:** No hyphens. "Fuck the hyphen — we have math." The web has `hyphens: auto` but it produces ugly, often wrong breaks. The great narrow-column publications (The New Yorker, Typographica, Octavo) relied on five tools: hyphenation, H&J parameters, paragraph-level optimization, hanging punctuation, and skilled editing. We're rebuilding four of the five without the one most publications leaned on.

---

## Part I: The Problem

### What the Browser Does

The browser sets text using a **greedy algorithm**: fill the line until the next word won't fit, then break. This is fast and works well enough at wide measures (600px+). At narrow measures (280–380px), it produces:

- **Bad breaks**: prepositions stranded at line ends ("the warmth of / a serif"), articles orphaned ("the sharpness of a / sans"), sentence starters trapped at the end of a previous line's thought
- **Staircases**: consecutive lines that differ dramatically in length, creating a visual cliff on the right edge
- **Orphans**: single words or short fragments on the last line
- **Uneven texture**: because the browser doesn't adjust spacing, some lines pack tight while others float loose

### What a Typographer Does

A human typographer reads the text, not just the metrics. They see that "of" should stay with the noun it governs. They feel that two 95% lines followed by a 60% line creates a jarring drop. They know that the right edge of a paragraph — the rag — should have a gentle, organic contour, not a mechanical staircase.

The question: can we teach a function to see what they see?

---

## Part II: The Masters

### Jan Tschichold (1902–1974)

**The 'i' width as unit of measure.**

Tschichold spent a decade redesigning every Penguin paperback. His spacing rules were not arbitrary — they were calibrated to the proportions of the typeface itself. He used the width of the lowercase 'i' (the narrowest character with a visible body) as a reference unit for acceptable word-spacing variation.

**Our implementation:** At Georgia 18px, the 'i' measures 5.3px. The natural word space is 4.3px (0.82 'i' widths). Tschichold's tolerances translate to:
- **Minimum word space:** 80% of natural = 3.4px (tighten by 0.9px)
- **Maximum word space:** 133% of natural = 5.7px (expand by 1.4px)

These are not magic numbers. They scale with the font. A different typeface at a different size produces different tolerances, all derived from the same proportional relationship.

**Critical lesson (learned the hard way):** The 'i' width is a **measurement unit**, not a tolerance range. Our v1–v3 implementations used ±5.3px as the spacing range — when the natural space is only 4.3px, that meant `word-spacing: -5.3px`, producing an effective gap of -1.0px. Words merged. Characters overlapped. The text was destroyed. The fix was understanding that Tschichold's tolerances are *percentages of the natural space*, measured in 'i' widths as a reference.

### Robert Bringhurst (b. 1946)

**The alphabet-length measure.**

Bringhurst's *Elements of Typographic Style* establishes that the ideal line length is 1.5–2.5× the width of the lowercase alphabet (a–z) set in the paragraph's typeface at the paragraph's size. Below 1.5×, the measure is too narrow for comfortable reading without hyphenation or aggressive spacing. Above 2.5×, the eye loses its place returning to the left margin.

**Our implementation:** At Georgia 18px, the lowercase alphabet measures ~233px.
- 310px = 1.33× alphabet → ⚠ narrow (below recommended)
- 340px = 1.46× alphabet → ⚠ narrow (approaching)
- 360px = 1.54× alphabet → ✓ acceptable (just inside)

This diagnostic runs before optimization begins. It tells both the optimizer and the developer: "this column is challenging. Expect tradeoffs."

### Emil Ruder (1914–1970)

**Leading as structural element.**

Ruder, at the Basel School of Design, taught that vertical spacing (leading) is not decoration — it is architecture. Greater leading compensates for narrow measures by giving the eye more room to track horizontally. His research showed that cramped leading at narrow widths compounds the damage of bad breaks.

**Our implementation:** Ruder's principle informed our quality scaling: at line-height > 1.6, the optimizer can be slightly more aggressive with horizontal adjustments because the vertical space provides a safety net. At tight leading (< 1.4), horizontal adjustments are scaled back.

### Donald Knuth (b. 1938)

**The cubic badness function.**

Knuth's TeX line-breaking algorithm (with Michael Plass, 1981) introduced two revolutionary concepts:

1. **Paragraph-level optimization**: Instead of breaking one line at a time (greedy), evaluate ALL possible break configurations and minimize total paragraph "badness."

2. **Cubic penalty**: Badness = (deviation)³. A line that's 5% off-target costs 125 units. A line that's 15% off costs 3,375 units — 27× worse. This makes the optimizer strongly prefer many small deviations over a few large ones, which matches human perception: one terrible line in an otherwise good paragraph is worse than several slightly loose lines.

**Our v5 implementation (retired):** Dynamic programming over break points
with cubic badness centered on 85% fill, evaluating up to 25 words back per
break point — a bounded window, not the full configuration space, so
"optimal" was always *optimal within the window*.

**The shipped implementation (Part XIII):** a beam search, not a DP. It
keeps Knuth's two real insights — score whole paragraphs, not single lines,
and make deviation cost grow superlinearly — but drops the optimality
claim. Deviation cost in the live scorer is quadratic and asymmetric
(short lines cost more than full ones), because that is what measured
better on real text at real widths, not because Knuth said cubic.

### The Golden Ratio Line Height (GRT)

**Formula:** `h = f × (φ + (w/f - φ) / 100)`

Where h = optimal line height, f = font size, φ ≈ 1.618, w = container width.

This formula tunes leading for perceptual balance in narrow columns. At Georgia 18px in a 310px container:
```
h = 18 × (1.618 + (310/18 - 1.618) / 100)
h = 18 × (1.618 + 0.156)
h = 18 × 1.774
h = 31.9px (line-height ratio: 1.774)
```

Our 1.7 line-height is "tight by 0.074" — the formula says narrow columns need MORE leading, confirming Ruder.

### The Fibonacci Font-to-Measure Ratio

**Formula:** `font size ≈ measure / 1.618` (golden ratio variant)

A diagnostic that links type size directly to column width:
- 310px → ideal font: 19.2px (we use 18px — slightly undersized)
- 340px → ideal font: 21.0px
- 360px → ideal font: 22.2px

This doesn't mean the font is "wrong" — it means the optimizer should expect more difficulty and be willing to accept wider tolerances at undersized ratios.

---

## Part III: Break Quality

Before optimizing spacing, we optimize *meaning*. A paragraph can have perfect metrics and still read badly if words are separated from their syntactic partners.

### The Rules

These penalties are added to the Knuth badness function:

| Violation | Penalty | Rationale |
|-----------|---------|-----------|
| Preposition at line end | 500 | "of", "in", "at", "by", "to", "for", "with" etc. should stay with their object |
| Conjunction at line end | 500 | "and", "or", "but" — connective tissue belongs with what follows |
| Article at line end | 500 | "a", "an", "the" — always pair with the noun |
| Sentence starter at line end | 500 | A new sentence should begin a new visual unit |
| Line < 40% fill | 300 | Runts destroy the rag |
| Line < 55% fill (≤ 2 words) | 150 | Thin lines with few words look abandoned |
| Orphan (single word, last line, < 25% fill) | 150 | The classic typographic sin |

### The Vocabulary

We track 35 prepositions, 6 conjunctions, and 3 articles. The complete list:

**Prepositions:** of, in, at, by, to, for, with, from, on, into, upon, about, between, through, without, during, before, after, against, among, within, beyond, toward, towards, across, along, behind, beneath, beside, besides, despite, except, inside, outside, underneath, until, unlike

**Conjunctions:** and, or, but, nor, yet, so

**Articles:** a, an, the

---

## Part IV: Stairstep Demerits

A "stairstep" occurs when consecutive lines differ by more than 10% in fill ratio. The visual effect is a cliff or ledge on the right edge that disrupts the rag's organic contour.

**Implementation:** When the DP evaluates a break point, it looks at the previous line's fill. If the current line would differ by:
- \> 15%: +200 demerits (large staircase)
- \> 10%: +80 demerits (moderate step)

This is adjacency-aware optimization — the cost of a line depends not just on its own metrics but on its relationship to its neighbor.

---

## Part V: Probabilistic Breaking (v6)

The deterministic optimizer finds ONE optimal solution. But typography isn't engineering — it's design. Sometimes a slightly suboptimal configuration *looks* better because its rag has a more natural, organic contour.

**The Bouckaert variant:** Run the Knuth-Plass DP multiple times (10–20 iterations) with randomly perturbed penalty weights. Each run produces a valid, near-optimal paragraph layout. Then evaluate all candidates by a *contour quality* metric and pick the best.

**Contour quality measures:**
- Rag deviation (standard deviation of non-last-line fill ratios)
- Maximum stairstep (largest fill difference between consecutive lines)
- Directional monotonicity (does the rag alternate pleasantly or staircase?)
- No break violations

The key insight: the "optimal" solution by badness score isn't always the most beautiful one. By exploring the neighborhood of near-optimal solutions, we can find configurations that score 95% as well on metrics but 110% as well on visual contour.

---

## Part VI: The Spacing Pass (shapeRag) — SUPERSEDED

> **Historical (March 2026).** `shapeRag` and `optimizeBreaks` were retired
> on 2026-03-17 and do not run anywhere. The shipped engine's spacing pass
> is `shapeExactLines` (Part XIII): per-line word-spacing within a flat
> ±0.03/0.04 em envelope, applied to lines the compositor already froze.
> The Tschichold-derived tolerances and lhScale described below exist only
> in this superseded code.

After breaks are optimized, spacing is adjusted to smooth the rag. This is the "accordion" — gently expanding short lines and contracting long lines toward the median fill. As of March 11, 2026, this pass was implemented and deployed as `shapeRag()` in `typeset.ts`, wired into `GlobalTypeset` as Pass 2 via a callback from `optimizeBreaks`.

### Two Levers

1. **Word-spacing** (primary): CSS `word-spacing` is additive to the font's natural space. We adjust within Tschichold tolerances: tighten by up to 20% of natural space, expand by up to 33%.

2. **Letter-spacing** (secondary): ±2% of em, half that for tightening. Letter-spacing is more visible than word-spacing, so it's a secondary lever for what word-spacing alone can't close.

### Scaling

All tolerances derive from font metrics, not magic numbers:
- `maxTighten = naturalSpace × 0.20 × lhScale`
- `maxExpand = naturalSpace × 0.33 × lhScale`
- `maxLetterSpacing = em × 0.02 × lhScale`

Change the font, change the size — the tolerances recalculate automatically.

### Line-Height Adaptive Scaling

Dustin's insight: higher line-height = more room for expansion (rivers are harder to see with more vertical space). The `lhScale` factor scales all tolerances based on computed line-height:
- `lhScale = 1.0 + (lhRatio - 1.5)` — where lhRatio is `lineHeight / fontSize`
- At the site's 1.65 leading: lhScale ≈ 1.15, so tolerances get ~15% more room
- At tight leading (1.3): lhScale ≈ 0.8, so tolerances tighten proportionally

### Asymmetric Neighbor Dampening

When adjacent lines move in opposite directions (one expanding, one contracting), the visual difference is amplified. The system applies asymmetric dampening:
- **Expanding line:** × 0.85 (lighter dampening — expansion matters more for readability)
- **Contracting line:** × 0.65 (heavier dampening — contraction is more visible)

Same-direction adjustments on adjacent lines get no dampening.

### The Anti-Justification Guard

The rag is a feature, not a bug. Dustin's insight: the irregular right edge provides a "lattice" of landmarks that helps the eye track its position in the paragraph. Smooth too much and you lose the lattice — the text starts looking justified without actually being justified, which is the worst of both worlds.

**Two-part guard:**
1. If all non-last fills > 92% AND within 4% of each other → scale all adjustments back 50%
2. If average fill > 88% and last line < 60% (near-justified + orphan pattern) → pull target down to 82% of container to create intentional rag

### Near-Justified + Orphan Pattern

When most lines fill >88% but the last line is short (<60%), the paragraph looks accidentally justified with a stranded last line. The system detects this pattern and shifts the target downward, creating a more intentional rag shape instead of near-justification.

### Implementation Architecture

```
optimizeBreaks(element, { onApplied: () => shapeRag(element) })
```

`shapeRag` runs as a callback after each `optimizeBreaks` application (including resize re-runs). It:
1. Wraps words in measurement spans to detect actual rendered lines
2. Groups by vertical position (offsetTop)
3. Computes median target from non-last-line widths
4. Applies per-line word-spacing + letter-spacing via `<span style="...">`
5. Uses `white-space: pre-line` with `\n` joins for clean textContent

No separate ResizeObserver — it inherits the resize lifecycle from `optimizeBreaks`.

---

## Part VII: Results — HISTORICAL (v5)

> These numbers were measured on the retired v5 system. Current measured
> results are in Part XII (the /proof instrument) and docs/BENCHMARKS.md.

### Best Cases (v5)

| Sample | Width | Range Before | Range After | Breaks | Steps |
|--------|-------|-------------|-------------|--------|-------|
| rhetoric-pathos | 310px | 18% | 3% | 2→0 | 1→0 |
| rhetoric-pathos | 340px | 16% | 3% | 3→0 | 1→0 |
| reading-lab | 310px | 15% | 7% | 1→0 | 1→0 |
| long-academic | 340px | 15% | 8% | 1→1 | 1→0 |

### Physical Constraints

Some text cannot be optimized at narrow measures without hyphens. "Interdisciplinary" at 133px consumes 43% of a 310px line. "Counterproductive" at 147px takes 47%. Two such words can never share a line — this is physics, not a bug in the algorithm.

The Bringhurst diagnostic flags this: 310px = 1.33× alphabet = "narrow." The optimizer does its best, but the measure is working against it.

### The Spacing Visibility Tradeoff

At Tschichold's maximum expansion (133% of natural space = +1.4px), the spacing adjustment is **visible** on lines with few word gaps. The question is whether to:
- Accept the visibility as a fair trade for tighter rag
- Scale back to 110–120% for subtler smoothing at the cost of wider rag variance
- Make this configurable per-deployment

---

## Part VIII: Architecture — SUPERSEDED

> **Historical (March 2026).** This two-pass system was retired 2026-03-17.
> The shipped architecture is in Part XIII.

### Two-Pass System (was deployed March 2026)

```
Text → typesetText (pre-render bindings)
     → Browser layout
     → optimizeBreaks / Pass 1 (Knuth-Plass DP → nbsp injection)
         ↑
    Break quality rules (35 prepositions, 6 conjunctions, 3 articles)
    Stairstep demerits (>10% = +80, >15% = +200)
    Cubic badness centered on 85% fill
    Sentence start protection (penalty 500)

     → shapeRag / Pass 2 (Tschichold accordion → per-line CSS)
         ↑
    Font-derived tolerances (ws: 80-133%, ls: ±2% em)
    Line-height adaptive scaling
    Asymmetric neighbor dampening
    Anti-justification guard (>92% + <4% range → scale 50%)
    Near-justified + orphan pattern detection
```

Both passes run via `GlobalTypeset` on all `<p>` elements with 80+ chars, 1.6s after page load. Pass 2 fires as a callback from Pass 1, sharing the same resize lifecycle.

### Font Metrics (measured, not assumed)

For every paragraph, the system measures:
- **'i' width** → spacing tolerance unit (Tschichold)
- **Natural word space** → baseline for ±adjustments
- **Em width** → letter-spacing cap
- **Alphabet length** → Bringhurst measure diagnostic
- **Every word width** → exact line-width calculation

### No Magic Numbers (a claim we no longer make in this form)

The v5 ambition was that every constant trace to a published typographic
authority:
- 80% minimum word space → Tschichold
- 133% maximum word space → Tschichold
- 1.5–2.5× alphabet measure → Bringhurst
- Cubic badness → Knuth
- GRT line-height → Golden ratio research
- Font-to-measure ratio → Fibonacci/Bringhurst

**Correction (2026-07-09):** the shipped scorer contains dozens of
constants that trace to *measurement on real text*, not to a book —
penalty weights, fill-band edges, cliff caps, contour weights. That is a
different and, we now think, more honest epistemology: the authorities
supply the principles (protect meaning, avoid cliffs, prefer many small
deviations), and the constants are tuned until the /proof instrument and
the eye agree on real paragraphs at real widths. Part XIII lists the live
constants and how each earned its value. Where a constant is a taste
decision, we say so.

---

## Part IX: What the Web Lost (and What We're Rebuilding)

### The Five Tools

Traditional typesetting relied on five tools for narrow columns:

1. **Hyphenation** — Breaking words at syllable boundaries. ❌ We chose not to use this.
2. **H&J Parameters** — Precise control over hyphenation and justification spacing. ✅ Rebuilt as Tschichold tolerances.
3. **Paragraph-level optimization** — Scoring whole paragraphs instead of single lines. ✅ Rebuilt — first as a windowed DP (v5, retired), now as a beam search with self-verification (Part XIII). No version ever evaluated *all* configurations, and the shipped engine doesn't claim to.
4. **Hanging punctuation** — Optically aligning punctuation outside the text block. 🔜 CSS `hanging-punctuation` exists but has limited support.
5. **Skilled editing** — Rewriting to fit the measure. ❌ We can't change the author's words.

We're rebuilding three of five, skipping hyphenation by choice and editing by necessity. The math has to be good enough to compensate.

### Exemplary Publications

These publications solved narrow-column typography through craft:

- **Typographica** (Herbert Spencer, 1949–1967) — Radical layouts with mathematical precision
- **The New Yorker** — Narrow single-column body text, immaculately set for decades
- **Octavo / 8vo** (1986–1992) — Swiss precision in extreme formats
- **TM / Typographische Monatsblätter** — The journal of Swiss typography itself
- **Eye Magazine** — Contemporary heir to the European tradition
- **Tschichold's Penguin rules** — Systematic design applied to mass-market paperbacks
- **Aldine Press** (Aldus Manutius, 1494) — Where italic type and the pocket book were born

---

## Part X: What Was Deployed (as of March 11, 2026) — HISTORICAL

> **None of the rows below are live anymore.** The two-pass system was
> retired 2026-03-17 in favor of the compositor described in Part XIII;
> `optimizeBreaks`, `shapeRag`, `smoothRag`, and their relatives survive
> only in a quarantined legacy block that ships in no bundle. What is
> deployed *today* is one path: `typeset()`.

The full two-pass system was live on typeset.us:

| Component | Function | Status |
|-----------|----------|--------|
| `typesetText()` | Pre-render nbsp bindings (measure-aware tiers) | ✅ Live |
| `fixRealOrphans()` | Post-render orphan detection on actual lines | ✅ Live |
| `optimizeBreaks()` | Pass 1: Knuth-Plass DP → nbsp injection | ✅ Live |
| `shapeRag()` | Pass 2: Tschichold accordion → per-line CSS | ✅ Live (March 11) |
| `smoothRag()` | Legacy rag smoother (Knuth-Plass + word-spacing) | Superseded by shapeRag |
| Probabilistic breaking (v6) | Monte Carlo variant exploration | Tested, not deployed |
| go.js v2.0 | Distributable script for users | ✅ Live (needs shapeRag port) |

### Key Decision: Break-Only → Full Two-Pass

From March 10 to March 11, the system ran break optimization only — no spacing adjustments. This was a deliberate conservative choice after a bug where spacing destroyed text (v3, words merging at -5.3px). 

On March 11, Dustin asked: "I thought we designed a multipass system that would see irregularities and adjust? Is it running?" The answer was no. Pass 2 had never been wired into production.

The full system is now deployed with correct Tschichold tolerances (80-133% of natural space, not ±'i' width), line-height scaling, neighbor dampening, and anti-justification guards.

---

## Part XI: Open Questions

1. **Contour quality**: What makes a rag "beautiful"? Alternating short/long? Gentle curves? Anti-monotonic patterns? (Dustin's "musicality" insight — optimize for shape, not uniformity)
2. **Expansion visibility at narrow widths**: At 310px with 6 gaps per line, even Tschichold-safe expansion (+1.4px) is visible. Should narrow measures use tighter tolerances?
3. **go.js needs shapeRag**: The distributable script users download doesn't have Pass 2 yet. Port needed.
4. **Live before/after demos**: Static PNGs of fabricated examples don't prove the tool works. Need interactive toggle on real text. (Dustin's March 11 insight: "if we have to keep using fake examples doesn't that mean our tool doesn't work?")
5. **Performance at scale**: Full two-pass on every paragraph — measure impact on pages with 20+ paragraphs.

---

## Part XII: The Proof, and What It Immediately Taught Us (2026-07-01)

Open question #4 — "if we have to keep using fake examples doesn't that mean our
tool doesn't work?" — is now answered by **/proof**: paste any text, pick a real
column width (375px first), and compare browser rendering against the engine,
side by side, both actually rendered. Every metric (weak line-endings, stranded
sentence openers, orphans, rag range, stairsteps) is measured from the rendered
lines, never precomputed.

Building the instrument immediately found three things the eye had missed:

1. **The fill band was centered at ~0.79, not the designed 0.85.** A hard
   admissibility cap at 0.85 fill plus a long-line penalty ladder that started
   charging at >0.84 made browser-quality lines (87–99% fill) impossible by
   construction. Cost: 2–3 extra lines per paragraph at 375px — 20–30% more
   vertical space on mobile — with no rag benefit. Fixed: cap raised to 0.97,
   deviation cost made asymmetric (short lines pay full quadratic, full lines
   pay soft), ladder now charges only genuinely overfull lines (>0.93). The
   rag-is-a-feature principle lives at the paragraph level (anti-justification
   guard, transition scoring), not inside every line.

2. **Compositions could overflow the measure.** The old 15% slack masked a
   webfont race: `document.fonts.ready` can resolve before late-triggered font
   loads, so paragraphs composed against fallback metrics rendered up to ~5px
   past the content box once the real font arrived. Fixed twice over: a
   post-render self-check (`linesOverflow`) restores plain text rather than
   ship an overflowing composition, and a `fonts.loadingdone` listener
   re-typesets with true metrics.

3. **Hidden tabs never typeset.** Phase 2 ran inside `requestAnimationFrame`,
   which never fires in background tabs — so articles opened in a background
   tab stayed raw and visibly jumped when focused. Phase 2 now runs directly
   after `fonts.ready`; text is already set before anyone looks at it.

Also landed: the May compositor wiring (V2 beam search behind `typeset()`),
optical margin alignment (hanging punctuation — tool #4 of the five the web
lost), quote/dash education that preserves the author's dash spacing style,
linking-verb end protection, and heading mode with epistrophe detection.

Measured at 375px Georgia 18px on real text (the essay's own paragraph):
weak line-endings 1→0, stranded openers 1→0, lines 12→11 after the rebalance.
At 650px: weak endings 3→0, and the browser's accidental near-justification
(4% rag range) becomes an intentional 12% rag. The engine now trades roughly
one line of vertical space for zero break violations — a defensible trade,
where before it traded three for the same.

Remaining, sharpened by the instrument: rag range on packed openings (the
two-register contour — full first lines, loose tail), and contour quality
generally (open question #1). The instrument to evaluate answers now exists.

**Addendum, same day — contour re-ranking landed.** Part V's insight (the
optimal-by-badness solution is not always the most beautiful) turned out not
to need Monte Carlo reruns: the beam search already finishes holding up to
200 complete compositions. Among candidates within 15% of optimal badness —
where break-quality rules are already satisfied, because violations cost far
more than the slack — the winner is now the best rag *shape*: lowest
weighted sum of spread (2.0), largest neighbor step (1.5), and two-register
drift (1.5, the mean-fill gap between the paragraph's first and second
half). Measured on the same essay paragraph at 375px: lines 11→10, rag range
21%→17%, stairsteps 2→1, and the composition now ends three sentences
exactly at line ends. Zero additional composition cost — the candidates were
already computed and previously discarded.

---

## Part XIII: The Shipped Engine (2026-07-09) — the present tense

Everything above this line is history or measurement. This part describes
what actually runs — on every page of typeset.us, in go.js, and in
typeset.min.js — with no claims the code doesn't back.

### The pipeline

```
text → educateQuotes (author's dash spacing preserved)
     → tokenize (whitespace tokens + syntactic bindings)
     → composeParagraph        BEAM SEARCH, not DP
     → contour re-rank         best rag shape among near-optimal completes
     → shapeExactLines         per-line word-spacing, +0.03 / −0.04 em
     → finalValidate           every frozen line re-measured against the box
     → renderFrozenLines       block spans + \n text nodes, optical indents
     → post-render self-checks linesOverflow, linesStarved → restore plain
```

One path. `GlobalTypeset` on the site and `Typeset.compose()` in the
bundles both call `typeset()`; there is no parallel wiring.

### The search, stated plainly

`composeParagraph` is a **beam search**: it advances line by line, keeping
the best **48** partial compositions (**80** for paragraphs over 120
tokens), considering up to **25** tokens of lookahead per line, retaining
up to **200** finished compositions, and stopping after at most 500
iterations. A paragraph of *n* words has on the order of 2^(n−1) possible
break configurations; the beam examines a vanishingly small, heuristically
chosen slice of them.

**Therefore the engine does not — and cannot — claim optimality.** What it
claims instead is *verified adequacy*: every composition it ships has been
re-measured line by line against the real content box (`finalValidate`),
checked for overflow and starvation after rendering, and abandoned in
favor of the browser's own layout if it fails (`data-ts-outcome`
records which). The guarantee moved from the search ("we looked at
everything") to the checker ("we measured what we shipped"). The second
guarantee is the one a reader can feel and a test can assert.

### The economics (live constants, and where each came from)

The governing principle, learned the hard way in the July rag-tuning
session: **shape must never outbid meaning.** Every structural violation
costs more than any sum of cosmetic improvements can buy back.

| Constant | Value | Earned how |
|---|---|---|
| Fill target (body) | 0.85 | Ragged-right sweet spot (Knuth's center, kept) |
| Admissibility cap | fill ≤ 0.97 | Measured: the old 0.85 cap cost 2–3 lines per paragraph at 375px |
| Fill deviation | quadratic, ×3000 short / ×1200 full | Asymmetry measured on /proof: short lines read worse than full ones |
| Weak line-end (preposition/article/conjunction) | 7,000–8,200 by tier | Raised above any plausible cliff sum so smoothness can never buy a weak ender |
| Linking-verb line-end | 1,600 | Taste, tested on real text |
| Dangling sentence start | by distance: opener stranded = 5,200 (7,000 if ≤4 letters), two words in = 2,600, three+ = free | Reading-flow protection — charging every boundary-crossing line steered breaks toward sentence ends and bought 50%-fill lines (the essay's odd-rag regression, 2026-07-09) |
| Orphan (last line) | effectively infinite (10⁹) | The classic sin is not for sale |
| Heading widow | 60,000 (finite) | Headings may widow only when physics forces it |
| Rag cliff (adjacent fill jump > 6%) | min(1800, 250000·(jump−0.06)²) | Graduated and *capped below one weak ender* |
| Contour re-rank slack | ≤ 3,200 | Capped below one violation: re-ranking may spend taste, never meaning |
| Contour score | 2.0·spread + 3.0·maxStep + 1.5·registerShift | Weights tuned on the /about long paragraphs |
| Word-spacing envelope (body) | +0.0825 / −0.05 em | Tschichold's 80–133% of the quarter-em natural space — InDesign's justification defaults; targets are neighbor-relational (each line blends its neighbors' fills with the paragraph median), expansion always participates, contraction only within reach |
| Word-spacing envelope (display) | +0.03 / −0.02 em | Word-space play at headline sizes reads pinched or gappy — display keeps the gentle envelope |

These are tuned constants, verified by measurement on real paragraphs at
real widths through the /proof instrument. The authorities supply the
principles; the numbers earn their keep or get changed.

### Self-verification (the part we'd defend in diligence)

- `finalValidate` — every line re-measured before rendering.
- `linesOverflow` — rendered ink wider than the content box → composition
  discarded, plain text restored.
- `linesStarved` — median non-last fill < 0.62 on a body paragraph →
  discarded. (This check caught the iOS canvas-state poisoning bug before
  we understood its cause — the checker paid for itself.)
- `data-ts-outcome` — every element records what happened to it:
  `composed`, `fallback:*`, or `skipped:*`.
- `Typeset.audit()` — DOM-Range probes of the *actual rendering*: returns
  overflows, orphans, weak line-ends. Asserted in CI (tests/engine.spec.ts)
  in Chromium and WebKit.

### Measurement discipline

Canvas text state silently keeps invalid assignments (`ctx.letterSpacing
= ''` keeps the previous tracked value; Safari keeps the previous font if
a family fails to parse). So: every family quoted, sentinel resets between
sessions, the measurer *verifies* the canvas accepted the font and falls
back to a DOM-span measurer when it doesn't. Every one of those clauses is
a production bug we shipped, found on a real phone, and root-caused.

### Honest limits (current)

- **English-only heuristics.** The weak-word lists, quote education, and
  whitespace tokenizer assume English; the engine skips what it can't
  measure, but a `lang` gate is future work, not present fact.
- **Copy/paste** carries a `\n` at composed line breaks (chosen over the
  worse defect of welded words).
- **Synchronous composition** on the main thread; measured budgets are in
  docs/BENCHMARKS.md rather than claimed in prose.
- **Dynamic text** must opt out (`data-no-typeset`): in-place text-node
  updates from a framework are not detected, and stale restores are
  possible without it.

*This part supersedes Parts II–X wherever they disagree.*

---

*This document is a living record. It will grow as the system evolves.*

*"The details are not the details. They make the design." — Charles Eames*
