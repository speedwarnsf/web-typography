# Typeset 4.1.0 support contract

4.1.0 is released with owner approval within the range below. Local tests
are not certification for every device, browser, font, or sentence.

- Horizontal LTR Latin prose/titles; declared English, French, German and
  Spanish. Untagged Latin uses neutral preferences.
- Ordinary inline links, bold, italics and supported semantic spans. Author
  elements are not cloned/reparented by the imperative rich renderer.
- React 19.2.3 is the local target. React 18 is not declared supported. Next
  acceptance requires a real packed consumer build with the version recorded.
- Chromium, WebKit and Firefox through Playwright. Reports record versions;
  no untested historical minimum is inferred.
- Intl.Segmenter, ResizeObserver, MutationObserver, document.fonts and CSS
  text-wrap required. Node 22+ for CLI/tooling.
- ESM/CommonJS core; ESM-only client React entry; optional browser global.

Never imperatively mount framework-owned text. Stateful custom React children
remain native. Unsupported CSS/scripts, mixed-language blocks, automatic/soft
hyphens and editable content remain native. Native text may have authored
overflow or an orphan: fallback means declined intervention, not perfection.

Word-spacing finishing applies to composed, left-aligned body text. Its delta
is bounded to -20%/+33% of each run's measured natural space; existing authored
tracking/word spacing is preserved. Large out-of-reach contractions are skipped.
Title layout and native-retained paragraphs are unchanged. Empty, aria-hidden
space markers do not alter source characters, links, emphasis or final lines.
CSS that decorates or resizes those markers causes a verified unspaced fallback.
Audit feature outcomes distinguish that fallback from successful finishing.

Default Unicode body rendering adds verified per-line letter tracking after
word spacing, bounded to +/-0.01em of each eligible run's authored value.
Reversible wrappers cover contiguous styled text runs, not individual letters;
original links/emphasis retain identity. Word spacing compensates for tracking's
space contribution. Final lines and chosen source spans stay unchanged.
Code/kbd/samp, joining scripts, unresolved relative spacing and more than 256
runs retain untracked rendering. Legacy plain rendering does not use this pass.
Tracking failure rolls back tracking only; it is not silently reported applied.

Ordinary inline code with normal whitespace, emergency overflow-wrap:break-word
and nonnegative sliced padding/borders/margins is measured with its surrounding
text. Unsupported box decoration remains native. Identity and pure 2D translation
transforms are supported; scale, rotation, perspective and nonzero Z are not.

Smart quotes are explicit English, quotes-only. Optical hanging applies to
eligible left-aligned leading glyphs, not indented/centered or justified contexts.
Clipped containers are supported only when the full glyph's measured geometry
fits the available clip, padding and scrollport. Rounded clips are conservative;
unknown clip paths/masks decline. No overflow CSS is overridden. Partial
application is reported when only some lines fit. It does not increase solver width, permit right overflow,
or change chosen source line spans. List styling uses external CSS and native
::marker. Compose leaf prose separately from lists containing nested lists.

Capital alignment samples the actual font's rasterized left contour relative
to its upright H, bounded to 0.08em. Opening punctuation uses its full measured
DOM advance. The canvas and DOM advance must agree within the browser's
single-character rounding envelope. Unsupported custom font-feature/variation
settings and unavailable ink measurements report `native:hanging-font`; no
fixed per-letter offset is substituted. Standard variable-font weights selected
through font-weight use the browser's font rendering. Optical geometry is
verified after render, including React's native-fitting single-line path.
For example, custom font-feature-settings: "onum" currently retains
native:hanging-font even where the clip geometry itself is supported.

Every composed line is checked for its source span and actual fit. Existing
native overflow is never extra room for a newly composed line. The 0.5px
layout rounding allowance remains; fallback is reported instead of presenting
unprocessed native text as successful composition.

Outstanding independent acceptance: physical iOS/Android, spoken VoiceOver/NVDA,
non-macOS and native-application rich clipboard, and representative-device
repeated p95/long-task budgets. Emulation and synthetic clipboard events are
not substitutes. No universal flawless-results or speed claim is made.

Additional local coverage includes accessibility-tree comparisons with native
text, keyboard navigation, emulated touch/rotation, 200%/400% text sizing,
delayed variable fonts, source updates and no-JavaScript rendering. The macOS
clipboard suite uses headed Chromium/WebKit/Firefox, trusted copy/paste events
and the native NSPasteboard, including cross-paragraph and partial selections.
It covers plain text and HTML pasted into browser editors, not Word/Pages,
mobile selection handles, Windows clipboard, or spoken screen-reader output.
Cross-paragraph copying retains native paragraph/authored-break boundaries;
generated line breaks and engine metadata are excluded. Relative copied links
resolve against the source page. Site copy handlers retain precedence.

At extreme text sizes, an unbreakable word can exceed the authored column.
That remains a reported overflow, never a passing audit. Typeset does not
shrink text or silently add word splits. Authors can opt into native emergency
wrapping with overflow-wrap:anywhere; this intentionally retains native layout
with native:break-policy. Text-size stress tests are not OS zoom certification.

The release owner accepted these documented external-testing limitations.
A clean local Node 22 workflow or CPU throttle must never be labeled remote
CI or representative-device proof. Pilot within your actual site and devices.

No install hooks, telemetry, page-content uploads or required runtime service.
Mount's incremental discovery, initial visible-text priority and yielded batches
reduce redundant work; real text, font and width changes still recompose.
The 8ms batch target cannot preempt one paragraph or a browser layout.
Large-document discovery/layout can still create long tasks. Static SceneF
snapshot benchmarking is not live hydration, server, or physical-device proof.
The audit CLI navigates only your explicit URL and reports locally; --apply
changes only an isolated preview, never a deployed site.
