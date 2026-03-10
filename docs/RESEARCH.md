# The Mathematics of Beautiful Paragraphs
## A Research & Implementation Journal

*Dustin York & Io — March 2026*
*typeset.us*

---

## Premise

The web abandoned paragraph-level typography forty years ago. When text moved from metal to phototype to digital, the tools that made narrow columns readable — hyphenation, paragraph-level optimization, skilled editing — were never rebuilt for the browser. CSS gives us `word-spacing`, `letter-spacing`, and `text-align: justify`. It does not give us taste.

This document records our attempt to bring that taste back, drawing on the mathematical foundations laid by the masters of the craft and encoding them as functions that run in the browser.

**The thesis:** A well-set paragraph is not an accident. It is the product of measurable decisions — about where to break, how much to stretch, what to avoid — that have been understood for centuries. We can express those decisions as math, and the math can run on any text, any font, any column width, on any device, in milliseconds.

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

**Our implementation:** Dynamic programming over all possible break points, with cubic badness centered on 85% fill (the sweet spot for ragged-right text). The DP evaluates up to 25 words back per break point, ensuring it can find optimal configurations even for lines with very long words.

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

## Part VI: The Spacing Pass

After breaks are optimized, spacing is adjusted to smooth the rag. This is the "accordion" — gently expanding short lines and contracting long lines toward the median fill.

### Two Levers

1. **Word-spacing** (primary): CSS `word-spacing` is additive to the font's natural space. We adjust ±0.9 to +1.4px per gap (Tschichold tolerances).

2. **Letter-spacing** (secondary): ±2% of em, half that for tightening. Letter-spacing is more visible than word-spacing, so it's a last resort for what word-spacing alone can't fix.

### Scaling

All tolerances derive from font metrics, not magic numbers:
- `maxTighten = naturalSpace × 0.20`
- `maxExpand = naturalSpace × 0.33`
- `maxLetterSpacing = em × 0.02`

Change the font, change the size — the tolerances recalculate automatically.

### The Anti-Justification Guard

The rag is a feature, not a bug. Dustin's insight: the irregular right edge provides a "lattice" of landmarks that helps the eye track its position in the paragraph. Smooth too much and you lose the lattice — the text starts looking justified without actually being justified, which is the worst of both worlds.

The guard: if a line's adjusted fill exceeds 92%, stop expanding. Leave the rag alone.

---

## Part VII: Results

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

## Part VIII: Architecture

### Two-Layer System

```
Text → Break Optimizer (Knuth-Plass DP) → Spacing Pass (Tschichold accordion) → Rendered paragraph
         ↑                                    ↑
    Break quality rules                  Font-derived tolerances
    Stairstep demerits                   Anti-justification guard
    Cubic badness                        Median-targeting
    Probabilistic variants               Neighbor-aware dampening
```

### Font Metrics (measured, not assumed)

For every paragraph, the system measures:
- **'i' width** → spacing tolerance unit (Tschichold)
- **Natural word space** → baseline for ±adjustments
- **Em width** → letter-spacing cap
- **Alphabet length** → Bringhurst measure diagnostic
- **Every word width** → exact line-width calculation

### No Magic Numbers

Every constant in the system traces back to a published typographic authority:
- 80% minimum word space → Tschichold
- 133% maximum word space → Tschichold
- 1.5–2.5× alphabet measure → Bringhurst
- Cubic badness → Knuth
- GRT line-height → Golden ratio research
- Font-to-measure ratio → Fibonacci/Bringhurst

---

## Part IX: What the Web Lost (and What We're Rebuilding)

### The Five Tools

Traditional typesetting relied on five tools for narrow columns:

1. **Hyphenation** — Breaking words at syllable boundaries. ❌ We chose not to use this.
2. **H&J Parameters** — Precise control over hyphenation and justification spacing. ✅ Rebuilt as Tschichold tolerances.
3. **Paragraph-level optimization** — Evaluating all possible break configurations. ✅ Rebuilt as Knuth-Plass DP.
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

## Part X: Open Questions

1. **Probabilistic variants**: How many iterations produce diminishing returns? Is 10 enough or do we need 20?
2. **Contour quality**: What makes a rag "beautiful"? Alternating short/long? Gentle curves? Anti-monotonic patterns?
3. **Expansion visibility**: Should the 133% Tschichold max be scaled back for web rendering, where subpixel differences are more visible than in print?
4. **Dynamic content**: How does the optimizer handle text that changes (CMS, user input, localization)?
5. **Performance budget**: Full DP with Monte Carlo on a long paragraph — can it stay under 16ms (one frame)?

---

*This document is a living record. It will grow as the system evolves.*

*"The details are not the details. They make the design." — Charles Eames*
