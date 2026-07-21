# Show HN kit — Dustin posts, this is the ammunition

## The title (pick one, first is recommended)

1. `Show HN: The browser breaks lines greedily. I spent a year teaching it to read first`
2. `Show HN: Typeset.us – a self-verifying paragraph compositor for the web`
3. `Show HN: My browser typography engine grades its own output (and yours)`

Link: **https://typeset.us/essay**

## When

Weekday, 8:00–9:30am Pacific. Tuesday–Thursday best. Do NOT post and
leave — the first two hours of answering comments decide the thread.

## The first comment (post it immediately, from your account)

> Author here. Thirty years as an art director; I watched InDesign's
> Paragraph Composer win the print world with Knuth & Plass's 1981
> algorithm, and then watched the web spend forty years without it.
>
> What this is: a compositor that runs after browser layout. Beam search
> over whole-paragraph break configurations (48–80 retained candidates —
> not exhaustive DP, and the docs say so), scored meaning-first: no line
> may end on a function word, no orphaned last words, sentence openers
> can't strand at line ends. Then — the part I care most about — it
> re-measures every composition against the live rendering and throws
> itself away rather than ship a regression. `audit()` returns measured
> violations from the DOM as data. The essay page grades itself clean:
> `npx typeset.us audit https://typeset.us/essay`.
>
> What it doesn't do, so you don't have to find out: English prose only
> (it declines other languages rather than guess). Copied text carries a
> line break per composed line. Split links across lines are cloned per
> segment — hrefs survive, attached JS listeners don't. It runs ~1.4ms
> per paragraph on desktop, ~6.6ms on a throttled phone (benchmarks in
> the repo). MIT, 20KB, no dependencies: `npm i typeset.us` or one
> script tag.
>
> The paste-your-URL grader is at https://typeset.us/fix if you want to
> see your own site's paragraphs before/after.

## Predicted objections + answers (don't paste; internalize)

- **"text-wrap: pretty exists."** Credit it — it's in the essay with a
  live measured comparison. Chrome's scores the last four lines;
  Safari's scores the paragraph; neither knows what a preposition is,
  and the spec is untestable by design ("may try harder"). Ours is a
  claim you can assert on; that's the actual difference.
- **"JS for typography? No thanks."** Correct instinct — that's why it
  self-verifies and un-sets itself rather than ship worse-than-browser.
  If browsers absorb this, good: that's the stated victory condition,
  and audit() is the test harness the spec currently lacks.
- **"CLS / SEO?"** SSR HTML is intact pre-compose; composition is one
  pass after fonts.ready (~80ms for a 30-paragraph page). Reader-visible
  re-set exists and is on the roadmap (idle-time chunking).
- **"Accessibility?"** Line spans with newline text nodes between them —
  copy, find-in-page, and screen-reader word boundaries preserved. Known
  imperfect: role="text" is nonstandard; granularity changes; documented.
- **"It doesn't really 'read.'"** Agreed, and the essay says so: it runs
  the compositors' checklist, priced and searched. Neither did the
  composing room "understand" paragraphs. The list is the knowledge; the
  engine is the enforcement.
- **"Beam search isn't optimal."** Correct — docs say so explicitly
  (RESEARCH.md Part XIII). The guarantee moved from the search to the
  verifier on purpose.

## The receipts to have open in tabs

- `npx typeset.us audit https://typeset.us/essay` → clean: 0 violations
- Wikipedia's Typography article through the same command → 100+
- /fix on any commenter's blog, live in the thread
- github.com/speedwarnsf/web-typography — CI green, both engines
