# Changelog

`go@x.y.z.js` URLs are **permanent**. Once a version is published its bytes
never change and the file is never removed, so a pinned `<script>` with an
integrity hash keeps working forever. Upgrading means changing the version in
your tag; nothing upgrades under you.

Hashes for every published version live in
[`public/sri.json`](public/sri.json).

---

## 3.4.2 — 2026-07-28

### Changed — `playwright-core` is now an optional peer dependency

The engine in `dist/` never touches it; only the `npx typeset.us audit` CLI
does. Declaring it a hard dependency made every `npm install typeset.us`
pull an 8.9 MB headless-browser harness to get a 152 KB compositor — a
silent install-time bail point for exactly the people the package is for.
Installing for browser use now gets the engine alone.

**The one user-visible break:** the CLI now requires
`npm i -D playwright-core` (it drives your installed Chrome or Edge and
downloads no browsers). Run without it, the CLI prints that instruction and
exits 2 — "could not grade," per its documented contract.

**No engine changes.** `go@3.4.1.js` remains the current pin; no file under
`public/` or `dist/` changed bytes. Sites — pinned, evergreen, or
vendored — have nothing to update.

---

## 3.4.1 — 2026-07-28

### Fixed — author `<br>` was silently destroyed, and could weld words

The plain compositor path admitted `<br>` children (a leftover allowance for
a renderer that no longer emits them) and then read the paragraph through
`textContent`, where `<br>` contributes nothing. A deliberate break —
poetry, an address — was silently discarded, and `bay<br>and` composed as
`bayand` with `data-ts-outcome="composed"`. Paragraphs containing `<br>` now
defer to the Phase-1 path, which preserves every node.

### Fixed — the readiness contract, this time at the wrapper

3.4.0 promised `data-typeset-done` on every outcome, but go.js's own
eligibility gate (short, centered, and `pre`/`code`/`.demo` paragraphs)
rejected elements *before* the engine ran and marked nothing — so the
documented poll still hung on any real page. Wrapper skips now record
`skipped:short` / `skipped:excluded` / `skipped:centered` and set the flag;
a thrown compose records `fallback:error` and sets the flag. Elements opted
out with `data-no-typeset` (self or ancestor) remain untouched — that is the
author's exclusion, not the engine's decision.

### Fixed — spurious recomposes from unseeded width tracking

The resize observers (go.js and the site pipeline) discarded whole entry
batches while the engine's own writes were in flight, without recording
widths. The first later event for such an element — including a pure height
change, the exact case the width filter exists to ignore — read as a width
change and forced a flatten-and-recompose of a paragraph whose measure never
moved. Widths are now recorded on every delivery; first sight seeds
silently. The one deliberate exception: an element composed while
`unmeasurable` that arrives with real width recomposes immediately — the
0 → N retry is the reason the flag exists.

### Fixed — possessive closed bigrams never bound

`New York’s` split at any weight: the follower trim only strips trailing
punctuation, and a possessive ends in a letter. The partner lookup now also
strips `’s`/`'s`, so `New York’s subway` binds exactly like `New York,`.

### Fixed — accessibility and injection

Rich-composed paragraphs no longer get `role="text"`, which flattened their
links out of the accessibility tree in WebKit/VoiceOver. And
`Typeset.auto()`'s heading branch no longer round-trips element text through
`innerHTML` — escaped user text could re-enter the DOM as live markup.

### Changed — hung list markers are now actually automatic, for prose lists

The docs said any list on a page running typeset() gets `ts-styled`
automatically; the engine only applied it when handed the `<ul>` itself,
which go.js never does. `typeset()` on an `<li>` now styles its parent
`<ul>` — but only a PROSE list: items still rendering as `list-item`,
markers still browser-default (`list-style-type` not already `none`), and
not inside `nav`/menu landmarks. A list the author already restyled — navs,
menus, card grids, flex layouts — is design, not typography, and is never
touched. Pinned versions are unaffected, as always.

### Build — pins are now enforced, not just promised

`build:dist` refuses to rewrite a committed `go@x.y.z.js` whose bytes
differ — an engine change without a version bump fails the build instead of
silently rewriting a published pin out from under its integrity hashes.
Version substitution now also covers prose references
(`typeset.us@x.y.z`), which had advertised 3.0.0 in the agent docs for four
releases. Declaration files ship NodeNext-safe relative imports.

### Site

The homepage hero and manifesto — self-composed for the line-by-line
reveal — now recompose when their width changes, so a load in a hidden or
zero-width context (embedded panes, background tabs) no longer leaves the
flagship headline browser-wrapped forever. Reading paragraphs that carried a
blanket `data-no-typeset` are back in the pipeline, so "every paragraph on
this page is set live by the engine" is true again, including the paragraph
that says it.

---

## 3.4.0 — 2026-07-24

### Added — phrase binding

The compositor now penalises a line break that splits a two-word place name,
so `San / Francisco` stays whole where the rag allows it. It is a **cost, not
a weld**: where the pair genuinely cannot fit, the penalty is outbid and the
break still happens.

Two rules, chosen for precision over reach:

- **open** — `san`, `santa` + any Title-Case word;
- **closed** — exact bigrams for everything else (`new`+`York`,
  `mount`+`Sinai`, …), which cannot false-positive.

Default weight `1600`, derived by sweeping 85 real paragraphs × 7 measures in
Chromium and WebKit. At that weight the feature is measurably free: no change
to short lines, weak line ends, or fill variance. Full method, evidence, and
an unusually long list of what the evidence does *not* support:
[`docs/BINDING.md`](docs/BINDING.md).

No published typographic authority prescribes this rule. It is an original
design decision and is documented as one.

### Fixed — `data-typeset-done` was never set on non-success paths

`data-typeset-done` was set only when a paragraph composed successfully. Every
`fallback:*`, `skipped:*`, and `unmeasurable` outcome left the flag unset, so
a paragraph the engine had already finished with looked permanently pending.

Anything polling that flag — the documented readiness check, test harnesses,
integrations — waited forever on a decided paragraph.

**If you poll `data-typeset-done`, this is the fix you want.** The flag now
means *the engine is finished with this element*, whatever it decided. Read
`data-ts-outcome` to find out what that decision was.

This also fixes a second, quieter bug: the `ResizeObserver` only re-runs
elements that already carry the flag, so a paragraph that was hidden or
zero-width when the engine first ran was skipped forever and never composed
once it became visible.

### Fixed — a published version could be deleted by the next release

The build removed older `go@x.y.z.js` files so the repo would carry exactly
one. Shipping 3.4.0 therefore 404'd `go@3.3.2.js` and broke every pin to it.

Old versions are now kept permanently and hashed into `sri.json` alongside
the current one. `go@3.3.2.js` has been restored, byte-for-byte identical to
what was published (verified against its original integrity hash).

### Performance

The binding test runs once per token at tokenise time rather than per
candidate break, where it measured 18% of compositor time in Chromium and 33%
in Firefox — and was paid even with the feature switched off.

### Known issue — Firefox composition is not deterministic

Roughly 1 page load in 30, Firefox composes a page differently from every
other load. Chromium and WebKit are byte-identical across every run.

This is **not new in 3.4.0** — it reproduces with phrase binding switched off
and is present in earlier versions. A fix was attempted, A/B tested, found to
make no difference, and removed rather than shipped as decoration. The
refuted hypothesis is written down in
[`docs/BINDING.md` §6](docs/BINDING.md) so the next attempt does not repeat
it. Reproduce with `tools-firefox-determinism.mjs` (needs ≥30 reps).

Scope CI rag gates per engine.

---

## 3.3.3 — 2026-07-23

`audit` CLI grades the settled rendering rather than a mid-composition frame,
and shares the engine's own weak-word vocabulary. Never released as a
`go@` drop-in; `go@3.3.2.js` remained the published pin.

## 3.3.2

npm `funding` field points at typeset.us/support.

## 3.3.1, 3.3.0

Inline composition: paragraphs containing links, `<em>`, and `<code>` compose
instead of falling back to Phase 1.

## 3.2.1 and earlier

See the git history.
