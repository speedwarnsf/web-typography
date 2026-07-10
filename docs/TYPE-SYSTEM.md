# The Typeset.us Type System

*The canon. One voice, everywhere, enforced by inheritance and verified by
measurement. Deviations are bugs.*

## Faces — three voices, no exceptions in chrome

| Voice | Face | Where |
|---|---|---|
| Display | **Playfair Display 700** | h1–h4, by element default |
| Reading | **Source Sans 3 400** | body, by element default |
| Machine | **JetBrains Mono** | labels, nav, buttons, code, data |

Enforced in `globals.css` at the **element level** — a page cannot fall out
of the system by forgetting a class. (`font-playfair` / `font-source-sans`
exist as real utilities; never trust a `font-{name}` class in Tailwind v4
unless its token exists.)

Demo content — specimens, pairings, the rhetorical roster, animation
gallery, proof panels — overrides deliberately via inline `fontFamily` or a
`data-type-demo` ancestor. There, variety **is** the content.

## Tracking — four roles, four values

| Role | Track | Example |
|---|---|---|
| Hero kicker | `.38em` | "TYPESET.US — A NEW ERA…" |
| Section label | `.3em` | "01 — THE PROOF" |
| CTA link | `.25em` | "SEE THE PROOF" |
| UI mono | `.2em` | tabs, menu items, chips, table heads |

Display headings: `-0.01em` (element default; relaxed from `-0.02em`
2026-07-09 — Dustin's call: the tighter track reads cramped in Playfair at
display sizes). Body: normal. No fifth value exists;
`tracking-widest`/`tracking-wider` are banned.

## Sizes & color floors

- Reading text: **never below 14px** (`text-sm`); body runs 17–18px.
- Meant-to-be-read grays floor at `#8f8f8f`; body text `#b9b9b9–#c9c9c9`;
  headings `#ededed–#f2f2f2`. WCAG AA against `#050505` throughout.
- Gold is **#B8963E only** — labels, links, active states, markers. Any
  other gold-adjacent hue outside a demo is a bug.

## Craft details

- Prices: superior currency symbol (`$` at 55%, cap-aligned) — see /support.
- List markers hang in the gutter and share the line box (never nudged with
  margins) — the Silver Bullet pattern, used by the site itself.
- Every paragraph is composed by the engine through ONE path: `typeset()`.
- Range inputs: 28px minimum hit area, `touch-action: none`.

## The audit — how "no room for improvement" is proven

A collector crawls every route, fingerprints computed styles of every text
element, and flags: non-canon heading face/weight, non-canon body face,
reading text under 13.5px, uppercase-mono tracking off the four values, and
gold-adjacent strays. Exemptions: inline `fontFamily` within 4 ancestors, or
a `data-type-demo` ancestor.

2026-07-03 baseline: **284 deviations found → 0 remaining** across 18
routes. The collector lives in the session notes; re-run it after any
redesign. Deviations are bugs, not opinions.
