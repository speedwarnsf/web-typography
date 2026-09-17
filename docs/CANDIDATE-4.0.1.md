# Private 4.0.1 Candidate

Historical candidate record. This development line was selected for public
release 4.1.0, following 4.0.0; the private labels below are not public pins.
Current release support and installation are documented in packages/typeset-v4.

Status: unpublished development work. `4.0.1-dev.2` identifies the source
candidate, not a new public release. The npm package, website deployment,
version-pinned downloads, V3 archive, and earlier candidate remain unchanged.

## Reproduced Failures

- The utility paragraph stranded `By` after a full stop at a 343px content
  width. The compact five-line budget excluded the much better six-line result.
- The essay's `rule: fill` break was actually composed, not a loader failure.
  The sentence-opener penalty and audit did not recognize colon-led clauses.
- `/proof` measured a `display:none` panel as zero-width. Changing controls
  while the browser panel was selected left Typeset `unmeasurable`; the table
  then reported zero lines as though this were an improvement.
- The essay comparison attempted composition while its Typeset panel was
  `visibility:hidden`. The homepage comparison had a corresponding inactive
  transform problem.
- Three essay paragraphs were wholly retained as native because of inline
  code. Their `overflow-wrap:break-word` rule, CODE tag, and horizontal padding
  each independently failed the rich-text support checks.
- The captured SceneF board uses identity transform matrices on many cards.
  Released V4 rejected these as transformed even though advances were unchanged.

## Engine Changes

- Sentence and colon-led clause openers share a penalty and audit classifier.
  By default, an extra body-text line is eligible when repairing a stranded
  opener. Explicit compact settings, title constraints, and line limits remain
  respected. No forced breaks or site-specific phrase replacements are used.
- Inline code with normal whitespace, emergency `break-word` wrapping, and
  nonnegative sliced padding/borders/margins is measured in place. Measurements
  include the inline boxes, not just their text. Links and author nodes remain
  intact. Overlong indivisible runs retain native emergency wrapping with a
  constraint report; arbitrary break policies are not silently overridden.
- Identity and two-dimensional translation transforms are accepted. Scale,
  rotation, perspective, and nonzero Z translation remain unsupported.
- Simple one-line text uses one Range read. Hidden boxes avoid futile word
  measurements. Rich planning reuses the already-measured native layout when
  no generated markers need to be suppressed.
- Mounts discover changes locally instead of rescanning the document on every
  mutation. Composition still runs for changed text, fonts, width, and context.
- Queued work yields to the browser, with an initial near-viewport priority.
  Intersection observations are one-shot, not permanent per-text subscriptions.
  Resize notifications use a target-to-dependent index, not an all-pairs scan.

## Tracking and Clipping

- `tracking` defaults on with the body-text word-space finish. `tracking: false`
  disables only tracking; `spacing: false` disables both finishing passes.
- Tracking closes the residual distance to the existing neighbor/median rag
  target, with a maximum additive adjustment of +/-0.01em in each styled run.
  It preserves chosen breaks and the last line. Author tracking is retained;
  code runs and joining scripts are not letter-spaced indiscriminately.
- Contiguous text runs receive reversible inline spans, not per-letter nodes.
  Original links, emphasis, event handlers, source text, and copy semantics are
  preserved. React renders its own tracking spans through its owned adapter.
- Word spacing compensates for tracking's contribution to spaces. Tests measure
  repeated spaces in their actual styled context to avoid WebKit's rounding of
  individual Range edges; measured space advances agree within 0.03px.
- Every tracked result is remeasured for line membership, overflow, line geometry,
  and movement toward its target. Interference rolls back tracking while retaining
  the verified composition and word-space finish.
- Hanging tests the actual room inside overflow clips, scrollports, and paint
  containment. Padding, borders, supported clip margins, conservative rounded
  corners, and measurable italic ink overhang are accounted for. No overflow
  styles are overridden. A full glyph either fits or is not hung; a paragraph
  can report `applied:partial` when only some line openings fit.
- Unknown masks/clip paths and unmatched font geometry retain an explicit native
  outcome. Pixel comparisons test that clipped and unclipped italic specimens
  render identically when hanging is reported as applied.

Implementation references: [CSS Text letter spacing](https://drafts.csswg.org/css-text-3/#letter-spacing-property)
and [CSS Overflow clipping](https://drafts.csswg.org/css-overflow-3/#overflow-clip-margin).
Draft properties are accepted only when their computed geometry is supported;
these references do not imply identical support in every browser.

## Site Integration

The three demonstrations measure their real columns in an untransformed,
measurable state, then restore inactive presentation synchronously. `/proof`
keeps both columns laid out and reports the engine's actual outcome rather
than calling every fallback "binding." Edited source is restored before being
replaced. Widths exclude the decorative edge border. The proof counters use
the same clause-opener classifier as the engine.

The site does not need a special density override to fix the reported `By`
break. No essay wrapping CSS or marketing copy was changed to hide the defects.

## SceneF Performance Method

`scripts/v4/benchmark-scenef.mjs` uses a script-free snapshot of the public
`https://scenef.com/week` page, with its CSS and fonts. Images/media are not
loaded. The captured page has about 40,000 elements and 5,070 multiword text
targets, including hidden responsive duplicates. This is a composition test,
not server timing, hydration timing, or a physical-phone load test.

The comparison includes:

1. The immutable released 4.0.0 bundle.
2. The candidate compositor with the released scheduler substituted in memory.
3. The full candidate.

The second and third must have identical output hashes and target counts.
Faster results obtained by composing fewer elements are not accepted. The
test also measures long tasks, completion time, event-loop gaps, and full-page
scans after unrelated mutations. Word-space finishing, smart quotes, and optical
hanging are enabled, with per-feature native fallbacks counted explicitly. Results are in
`output/scenef-composition-benchmark-4x.json`. CPU throttling is an approximation,
not a representative-device certification.

An initial attempt with persistent intersection observation increased total
blocking under throttling. It was rejected and replaced by one-shot observation.
Released V4's zero-composition result on this fixture is a compatibility failure,
not a performance success. The same-compositor control is the meaningful timing
comparison.

## Verification

The existing craft, spacing, composition, and accessibility suites accept
`TYPESET_BUNDLE` so an unpublished bundle can be tested without replacing
published artifacts. New inline-code and controller suites are part of
`npm test`; real site flows have their own `verify-site-repairs.mjs` suite.

The private production preview uses port 4211. The site still links to the
public 4.0.0 downloads; those links are not candidate installers.

The `dev.2` source passed 9,529 automated assertions: 9,475 engine checks and
54 real-site checks across Chromium, Firefox, and WebKit. The final production
build and TypeScript validation passed. Tracking applied in 69 of 72 dedicated
paragraph cases; the other three needed no residual adjustment. No case changed
its chosen line membership or final-line width, and the largest tracking render
used 14 run wrappers, not per-character elements. Tests cover React updates and
toggles, author-node restoration, selection/copy, relative-spacing rejection,
style interference, and no canvas allocation for unsupported optical fonts.
Clipped and unclipped italic specimens produced identical screenshots in all
three browsers. This is local automated evidence, not physical-device or
screen-reader certification.

The preceding `dev.1` local run passed 8,707 assertions across Chromium, WebKit, and
Firefox: 8,659 engine checks and 48 real-site checks. The production build and
TypeScript validation also passed. These are automated assertions, not 8,707
independent designer judgments.

The preceding `dev.1` 4x CPU-throttled snapshot run produced identical composition hashes
for the candidate and same-compositor control, with 212 composed targets out
of 5,070 inspected targets in each. Measured blocking was 213ms versus 914ms;
the longest task was 72ms versus 313ms. Full completion took 17.9s versus
29.4s. Unrelated mutations triggered no full-document scans or composition
passes in the candidate, versus 12 scans and eight passes in the control.
These are single-run fixture measurements, not live SceneF load-time claims.

For that earlier candidate, 23 targets received smart quotes and 11
received word-space adjustments. No target received optical hanging on this
fixture because the clipping/uncomposed guards retained native alignment.
That earlier report is preserved as
`output/scenef-composition-benchmark-dev1-4x.json`. The current detailed outcome
counts and source/fixture hashes are in `output/scenef-composition-benchmark-4x.json`;
faster scheduling does not resolve every remaining compatibility limit.

The final `dev.2` 4x run again produced identical output hashes for the candidate
and same-compositor control: 212 composed targets, with tracking applied to 121
of them and word spacing applied to 11. Candidate/control blocking was
507ms/1,394ms, longest task 86ms/247ms, and full completion 24.3s/37.5s.
The candidate still had a 391ms maximum heartbeat gap, so the batch budget is
not a guarantee of frame-perfect responsiveness. Unrelated mutations caused
zero scans/passes versus 12 scans/eight passes in the control.

No SceneF target received hanging in this run. Of the optical-font fallbacks,
1,200 share `Fraunces` with `font-feature-settings: "onum"`; this is the separate
font-verification guard, not the repaired clipping-geometry guard. Supporting
that font-feature context needs additional glyph validation. The successful
clipped-container and pixel tests use supported font contexts. These new
features do additional work; the timings above compare equal output within
one run, not the old candidate's simpler feature workload across different runs.

## Still Open

- Tracking adjusts letter spacing, not individual kerning pairs. Joining scripts,
  code runs, extreme run counts, and unverifiable styles retain explicit limits.
- The throttled large-page test still has long tasks. An eight-millisecond job
  batch target is not a hard bound on an individual composition, initial
  discovery, observer delivery, layout, or paint.
- Live SceneF hydration, input/scroll latency, orientation changes at full
  board scale, and long-session memory behavior need acceptance testing. No
  SceneF source or deployment was changed by this work.
- CODE with `white-space:nowrap`, cloned box decoration, arbitrary emergency
  break policies, and non-unit transforms still have declared native fallbacks.
- Arbitrary clip paths/masks and unsupported font controls still decline hanging.
  Rounded corners use conservative bounds rather than claiming exact arbitrary
  shape intersection. A tight clip with no margin cannot contain a full hung glyph.
- No public release, remote CI acceptance, or physical-device certification is
  implied by local automated checks.
