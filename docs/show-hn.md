# Show HN kit — Dustin posts, this is the ammunition

Post only after 4.3.0 ships. Every number below comes from a script in the
repository; commenters will check. The cost figures are from the 4.3.0
benchmark (docs/BENCHMARKS.md) and the homepage counts from
scripts/field/sweep-homepage.mjs run on the 4.3.0 candidate.

## The title (pick one, first is recommended)

1. `Show HN: The browser breaks lines greedily. I spent a year teaching it to read first`
2. `Show HN: Typeset.us – grammar-aware line breaks that check themselves`
3. `Show HN: My browser typography engine grades its own output (and yours)`

Link: **https://typeset.us/proof**, the live playground (the essay is the
second link, in the first comment).

## When

Weekday, 8:00–9:30am Pacific. Tuesday–Thursday best. Do NOT post and
leave — the first two hours of answering comments decide the thread.

## The first comment (post it immediately, from your account)

> Author here. Thirty years as an art director; I watched InDesign's
> Paragraph Composer win the print world with Knuth & Plass's 1981
> algorithm, and then watched the web spend forty years without it.
>
> Use CSS first: `text-wrap: balance` for headlines, `text-wrap: pretty` for
> paragraphs. Typeset is for what they don't do: it won't leave "a", "the"
> or "of" stranded at a line end, it keeps names and numbers with their
> words, it gives Firefox (which has no `pretty`) the same result, and it
> keeps links, emphasis and React-rendered text exactly as authored. On the
> homepage demo, across 96 widths, words left hanging at line ends went from
> 215 to 38 against Chrome's `pretty` and from 216 to 28 against Safari's;
> Firefox left a one-word last line at 30 widths, Typeset at none.
>
> How: after the browser lays out a paragraph, Typeset measures it, searches
> whole-paragraph break candidates (a bounded search, not exhaustive, and
> the docs say so), renders the best, and re-measures. If the result doesn't
> verify, it restores the browser's layout and records why, as an outcome
> like `native:fits` or `native:no-candidate`. `auditJSON()` turns that into
> something your CI can assert; `npx typeset-audit --url <page>` runs it
> from the command line.
>
> What it doesn't do: hyphenation, justification, right-to-left or non-Latin
> scripts. Languages: English, French, German, Spanish. Cost: about 5 ms
> per paragraph on an M2 laptop, about 21 ms with the CPU slowed 4x; the
> first screen of a 200-paragraph article is done in about 55 ms. 55 KB
> gzipped for the script tag, no dependencies, no telemetry. MIT.
>
> Try it on your own site at https://typeset.us/fix. If it breaks a line
> badly, the issue form asks for exactly what I need to fix it.

## Predicted objections + answers (don't paste; internalize)

- **"text-wrap: pretty exists."** Agree, and recommend it. The README's
  first table says when CSS is enough. Pretty doesn't know a preposition from
  a noun, Firefox doesn't ship it, and "may try harder" isn't something a CI
  can assert.
- **"JS for typography? No thanks."** Correct instinct. That's why it
  verifies every result after rendering and keeps the browser's layout when
  it can't do better, and why the baseline CSS stays for readers without
  JavaScript.
- **"Accessibility?"** The suite reads the accessibility tree Chromium and
  WebKit actually build, on every run, and Firefox's nightly, and requires
  the words and every link and heading name to match the source. A
  generated break that replaces a space is exposed, so a screen reader meets
  a line boundary there, as at any line end; 4.2.0 hid them and joined the
  words. Spoken VoiceOver and NVDA output has not been checked by a person
  yet. Find-in-page across a generated break is a known limitation
  (SUPPORT.md).
- **"CLS / SEO?"** The server HTML is unchanged. Composition keeps the line
  count except one line to fix a stranded word or opener, which about 1 in 6
  paragraphs take at 320 px (1 in 11 at 375 px, almost none on desktop); one
  taken in the first screen is a small layout shift, at most 0.05 in our
  tests, under the 0.1 "good" threshold. It waits for web fonts.
- **"Why should I trust a script tag?"** Pinned files with integrity hashes
  that never change, an append-only ledger of every published file checked in
  CI, npm provenance from 4.3, SECURITY.md, and STABILITY.md's promise about
  what a minor release may change.
- **"It doesn't really 'read.'"** Agreed, and the essay says so: it runs
  the compositors' checklist, priced and searched. Neither did the
  composing room "understand" paragraphs.
- **"Beam search isn't optimal."** Correct, and documented. The guarantee
  lives in the verifier, not the search.

## The receipts to have open in tabs

- https://typeset.us/proof with a commenter's text pasted in
- `npx typeset-audit --url https://typeset.us/essay --selector 'article p'`
  → pass, with every paragraph's outcome
- `node scripts/field/sweep-homepage.mjs` output for the 215 → 38 numbers
- /fix on any commenter's blog, live in the thread
- github.com/speedwarnsf/web-typography — CI green, three engines
