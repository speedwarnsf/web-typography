# Benchmarks

*Measured 2026-07-29 — Chromium 149.0.7827.55 via Playwright,
Georgia 18px, a 30-paragraph page of real site text at 340/480/650px measures
(every sixth paragraph >120 tokens, exercising the BEAM=80 path). Times are for the full
pipeline per paragraph — quote education, beam-search composition, contour re-rank, spacing
pass, render, post-render self-checks — through the shipped go.js bundle. The 4x CPU
throttle row is a mid-range-phone proxy (CDP `Emulation.setCPUThrottlingRate`).
Reproduce with `npm run bench`.*

| CPU | Paragraphs (composed) | Words | Median / paragraph | p95 / paragraph | Max | Full page |
|---|---|---|---|---|---|---|
| 1x | 30 (30) | 2190 | 1.6 ms | 11.4 ms | 11.5 ms | 92.9 ms |
| 4x | 30 (30) | 2190 | 7.1 ms | 51.2 ms | 51.3 ms | 418.5 ms |

## Reading the numbers

- Composition is synchronous on the main thread and runs once per paragraph
  after `fonts.ready` (and again only when a paragraph's width actually
  changes by 2px+, or its face finishes loading late).
- The honest claim is therefore: **milliseconds per paragraph, tens of
  milliseconds for a full page** on a desktop core, and roughly 4x that on a
  throttled core. Not free — measured.
- These numbers are the budget for the open question in RESEARCH.md Part XI
  (dynamic content on a 16ms frame): a single paragraph fits a frame budget
  at 1x; a full page does not and should never run inside one frame.
