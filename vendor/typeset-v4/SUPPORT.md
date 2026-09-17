# Candidate support contract

4.0.0-beta.1 is distributed from typeset.us with its npm publication guard
retained. Local tests are not certification for every device, browser, font,
or sentence. Existing V3 URLs and npm releases remain separate.

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

Smart quotes are explicit English, quotes-only. Optical hanging applies to
eligible left-aligned leading glyphs, not clipped/transformed/indented/centered
or justified contexts. It does not increase solver width, permit right overflow,
or change chosen source line spans. List styling uses external CSS and native
::marker. Compose leaf prose separately from lists containing nested lists.

Before stable: record physical iOS/Android, VoiceOver/NVDA, OS plain/rich
clipboard, representative-device repeated p95/long-task budgets, and a remote
clean CI run for the exact artifact. Emulation and synthetic clipboard events
are not substitutes. No universal flawless-results or speed claim is made.

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

Where external acceptance resources are unavailable, keep the build an
evaluation beta within this declared range. A clean local Node 22 workflow
or CPU throttle must never be labeled remote CI or representative-device proof.

No install hooks, telemetry, page-content uploads or required runtime service.
The audit CLI navigates only your explicit URL and reports locally; --apply
changes only an isolated preview, never a deployed site.
