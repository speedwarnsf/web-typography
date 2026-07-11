# Inline Composition — design (branch: inline-composition)

Goal: paragraphs containing inline markup (links, em/strong, code chips)
compose through the full pipeline instead of falling back to Phase 1.
Zero regression on plain-text paragraphs. Merge only after fixtures +
dogfood + Dustin sign-off. Ship as 3.3.0.

## Concepts

- **InlineRun** `{ id, chain: HTMLElement[] (outer→inner, originals),
  fontString, letterSpacing, atomic }` — one run per innermost inline
  element instance; base text (direct text nodes) has runId null.
- **Token additions**: `runId?: number | null`, `parts?: {text, runId}[]`
  (composite tokens for boundaries without whitespace: `re<em>read</em>ing`,
  `(<a>link</a>)`, punctuation glued to a link).
- **Atomic runs**: any chain element with horizontal padding/border or
  non-transparent background (code chips), plus SUP/SUB/KBD → the run's
  ENTIRE text becomes one unbreakable token (spaces included). Never split
  across lines; padding never duplicates.

## Pipeline changes

1. **extractInlineContent(el)** → `{segments: {text, runId}[], runs} | null`.
   Allowlist: A EM STRONG I B CODE SPAN MARK SMALL ABBR CITE Q TIME SUP SUB
   U S DEL INS KBD SAMP VAR (computed display must be inline). Anything
   else (BR, IMG, block, unknown) → null → today's Phase-1 behavior.
   Styles read from LIVE elements at extraction time (recompose cycle
   restores first, so nodes are always connected when read).
2. **richTokenize(segments, runs, measure)** — refactor tokenize()'s
   classifier into `classifyWord(text)` shared by both paths. Pending-parts
   accumulator: segment boundary without whitespace continues the same
   word → composite token (width = Σ part widths in their fonts).
   Space tokens carry the runId of their segment (mono spaces are wider).
   NO quote education on rich paragraphs in v1 (documented).
3. **Run-aware measurer**: canvas font set per part's run (canvasFontString
   of the innermost element's computed style + letterSpacing, sentinel
   discipline as always). Canvas-reject fallback: probe span with explicit
   font cssText per run.
4. **renderRichFrozenLines**: per line, expand tokens→parts, group
   consecutive parts by runId; null → text node; run → nested
   cloneNode(false) chain (attributes/href preserved), innermost gets the
   text. A run spanning lines = one clone chain per line (split anchors:
   two <a> segments, same href — documented; attached JS listeners on
   inline elements do not survive — documented, href navigation works).
   FrozenLine.text unchanged → optical indent, audit, self-checks as-is.
5. **Canonical + restore**: `canonicalRich = WeakMap<el, string>` storing
   original innerHTML at first composition. Recompose cycle:
   restore innerHTML → extract from live DOM → compose → render.
   All failure paths (no-composition/validate/overflow/starved) restore
   innerHTML instead of textContent for rich elements. Mark composed rich
   elements `data-ts-rich="1"`.
6. **Integration**: typeset()'s canCompose() gate: when false, try
   extractInlineContent → rich path; null → Phase-1 (today's behavior).
   GlobalTypeset.tsx + typeset.standalone.ts restore sites
   (`el.textContent = original` in RO + loadingdone handlers) must SKIP
   rich elements (engine restores internally) — just clear
   data-typeset-done and re-run typeset().
   data-ts-raw override applies to plain paragraphs only.

## Invariants (Phase C — tests before merge)

- New go-test.html paragraphs: link mid-sentence; em+nested a; padded
  code chip; punctuation-glued link.
- Every href survives with same value; anchor text intact.
- Atomic chip: whole text within a single .ts-line.
- textContent word count preserved; audit() zero hard violations.
- Plain-paragraph zero-regression: existing 16 tests byte-for-byte green.
- Both engines (Chromium + WebKit).

## Dogfood (Phase D)

Essay paragraphs restored to natural markup (em/links/code) on this
branch → 11/11 composed WITH markup; /about credentials; /library.
Dustin reads on device. Then merge → deploy → npm 3.3.0.
