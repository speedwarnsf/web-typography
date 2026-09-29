# Outcomes

<!-- Generated from src/lib/v4/outcome-docs.ts by scripts/v4/outcomes-doc.mjs. Edit that file, then run npm run docs:outcomes. -->

Every element Typeset looks at gets an outcome: `result.outcome` from
`typeset()`, and `data-ts-outcome` on the element. `auditJSON()` counts
them. Excluded content and live regions get no attribute: `typeset()`
returns `skipped:excluded` or `native:live-region` for them, and
`auditJSON()` counts them as `excluded` and `native:live-region`.
A `native:` outcome is not an error: it means Typeset left the
browser's layout in place, and says why. The TypeScript types are
`Outcome` and `FeatureStatus`, and `OUTCOMES` lists every code at runtime.

"Expected" means the outcome is a normal result that needs no action.

## Composed

Typeset chose the line breaks. The text, links and styling are unchanged.

| Outcome | What happened | Expected | What to do |
| --- | --- | --- | --- |
| `composed` | Plain text composed and verified after rendering. | Yes | None. |
| `composed:rich` | Text with links, emphasis or other inline markup composed and verified; author elements were kept, never cloned. | Yes | None. |

## Nothing to improve

Left as the browser set it, because Typeset had nothing to add. These are normal.

| Outcome | What happened | Expected | What to do |
| --- | --- | --- | --- |
| `native:fits` | The text fits on one line. | Yes | None. |
| `native:empty` | The element has no text. | Yes | None, or narrow the selector. |
| `native:sentence-aligned` | The browser's lines already end at sentence or clause boundaries, so they were kept. | Yes | None. |
| `native:paragraph-rhythm` | The browser's rag was as good as the best candidate, so it was kept. | Yes | None. density: 'editorial' lets Typeset use one more line for phrasing. |

## Unsupported content

Left as the browser set it, because the content or its CSS is outside what Typeset composes. Nothing is broken; Typeset stepped aside.

| Outcome | What happened | Expected | What to do |
| --- | --- | --- | --- |
| `native:language` | The declared language is not English, French, German or Spanish (with lineBreaks: legacy, not English). With coverage: 'extended', only a language written in a script other than Latin (Arabic, Hebrew, Chinese, Japanese, Korean, Thai, Hindi, Greek, Serbian in Cyrillic) is left native. A lang such as en_US, en_US.UTF-8 or english is read as the language it names. | Yes | None; set lang correctly. coverage: 'extended' composes other Latin-script languages; other scripts are left to the browser. |
| `native:mixed-language` | Part of the block declares a different language (a Spanish phrase in English), or, with coverage: 'extended', a language written in another script (a Japanese phrase in English). | Yes | None, or split the block by language. |
| `native:script` | The text contains non-Latin script or bidirectional controls. Greek and Cyrillic letters in runs of up to three inside Latin text (5 μg, α-synuclein, ΔG) are allowed. | Yes | None. Typeset composes Latin-script text only. |
| `native:direction` | The element is right-to-left or vertical. | Yes | None. RTL and vertical text are not supported. |
| `native:transformed` | The element or an ancestor is scaled, rotated, skewed or zoomed, so measured widths would not match what is drawn. A composition made before an ancestor transform is kept (lines do not move); this outcome is for text first composed while one applied. | Yes | None while it animates: mount() and the React adapters compose the text when the transition or animation ends. For a lasting transform, remove it or leave the text native. |
| `native:decorated` | The element has ::before or ::after content that shares its lines. | Yes | Move the decoration outside the text box, or leave it native. |
| `native:whitespace` | white-space preserves spaces or prevents wrapping (pre, pre-wrap, nowrap, break-spaces). | Yes | None; preserved whitespace is left to the browser. |
| `native:author-breaks` | The text has its own line breaks (pre-line newlines or Unicode line separators). | Yes | None; authored breaks are kept. |
| `native:soft-hyphen` | The text contains soft hyphens (&shy;). | Yes | Remove soft hyphens to let Typeset compose it; Typeset does not hyphenate. |
| `native:auto-hyphens` | hyphens: auto is set, so the browser may hyphenate. | Yes | Use hyphens: manual or none to let Typeset compose it. |
| `native:break-policy` | word-break, line-break or overflow-wrap asks for breaks Typeset does not model (for example overflow-wrap: anywhere). | Yes | None, or use overflow-wrap: break-word, which Typeset supports. |
| `native:clamped` | The text is clamped or truncated with an ellipsis. | Yes | None. |
| `native:inline` | The target is display: inline, so it has no box of its own to compose. | Yes | Target the block that contains it. |
| `native:ui` | mode: 'ui' (or data-typeset-mode="ui") marks interface text, which is never composed. | Yes | None. |
| `native:justify` | The text is justified (text-align: justify or justify-all), or its text-align-last differs from text-align, and it runs to more than one line. A generated break ends its line, so every composed line would take the last-line alignment. | Yes | None; justified text is left to the browser. Set text-align: start (with the default text-align-last) to have it composed. |
| `native:live-region` | The element is inside a live region, or contains one (a result count or a "saved" status inside a paragraph): the nearest region has an aria-live value other than "off" (an empty one counts as absent), or role status, alert, log, marquee or timer, or is an <output>, without aria-live="off". Screen readers announce every change there, so Typeset never measures, breaks or rewrites it. Regions in open shadow roots count, such as a toast that wraps a <slot> in role="status". | Yes | None. If the element is not really a live region, remove the role or set aria-live="off". A role set through ElementInternals or in a closed shadow root cannot be seen: mark that text data-no-typeset. |
| `native:rich-element` | The block contains an element other than inline text markup (a, b, strong, em, i, span, small, u, s, del, mark, abbr, cite, code, and, with coverage: 'extended', time, dfn, kbd, ins, sup and sub), such as an image, a line break, button or nested block. | Yes | None, or compose the text blocks inside it separately. |
| `native:rich-excluded` | The block contains hidden, aria-hidden, editable or data-no-typeset content. With coverage: 'extended', visually hidden text (the sr-only pattern) and aria-hidden elements with no width take no room and are composed around. | Yes | None. |
| `native:rich-direction` | An inline element changes direction, bidi or writing mode, or is not visible. | Yes | None. |
| `native:rich-whitespace` | The block or its inline markup is indented (any text-indent, including a first-line indent such as p + p { text-indent: 1.5em } and a hanging indent), preserves whitespace, or changes text advances (a transform). | Yes | None; indented paragraphs keep the browser's layout. |
| `native:rich-layout` | An inline element is not a plain inline box (inline-block, positioned, or not on the baseline). With coverage: 'extended', raised text is measured in place: vertical-align super or sub, and sup or sub raised with position: relative and a top offset (normalize.css). | Yes | None. |
| `native:rich-box` | An inline element has negative padding, borders or margins, or box-decoration-break: clone. | Yes | None. |
| `native:rich-decorated` | An inline element has ::before or ::after content. | Yes | None. |
| `native:rich-tokens` | The words could not be matched to text positions in the markup. | No | Report it with auditJSON output; this should be rare. |
| `native:react-component` | TypesetRichText has a custom component child, whose rendering React owns. | Yes | Use host elements (a, strong, em, span) inside TypesetRichText. |

## Couldn't improve safely

Left as the browser set it, because every candidate failed a limit or a check after rendering. Typeset shows the browser layout rather than a worse one.

| Outcome | What happened | Expected | What to do |
| --- | --- | --- | --- |
| `native:budget` | The block is longer than the composition budget (500 words or 12,000 characters). | Yes | None; very long blocks are left to the browser. |
| `native:run-budget` | Some run of more than 500 characters has no line-break opportunity (a long string of one punctuation mark, letters with no space, text joined by no-break spaces). Measuring such a run costs the square of its length in WebKit (about 37 s for 11,000 closing quotes), so the block is declined before anything is measured; result.before and result.after hold no lines. Prose has no such runs; user-generated text can. | Yes | None; the browser wraps it. On containers of user-generated text, overflow-wrap: break-word lets the browser wrap such a run at the measure. |
| `native:no-candidate` | No arrangement of the allowed breaks fits the width and line limits. result.constraint says why: an unbreakable run wider than the box, a line budget, or the search. | No | Read result.constraint; widen the box, allow overflow-wrap: break-word, or raise maxLines. |
| `native:line-budget` | Every candidate needs more lines than allowed (maxLines, or the native line count plus the body allowance). | Yes | None, or raise maxLines or use density: 'editorial'. |
| `native:quality` | The composed result would have created a one-word last line the browser did not have, so it was discarded. | Yes | None. |
| `native:render-failed` | Rendering the chosen lines threw an error; the original nodes were put back. | No | Report it with the page and auditJSON output. |
| `native:verification` | After rendering, the lines, text or styling did not match the plan (a font or width changed, or CSS moved text), so the browser layout was restored. | No | Usually transient; mount() recomposes when the cause settles. Persistent cases: report with auditJSON output. |

## Not processed

Typeset did not look at the element.

| Outcome | What happened | Expected | What to do |
| --- | --- | --- | --- |
| `skipped:excluded` | The element is inside data-no-typeset, code, pre, a form control, nav, a button or editable content. | Yes | None. |
| `skipped:framework` | TypesetRichText owns this element, so imperative typeset() and mount() leave it alone. | Yes | None; keep one owner per element. |
| `unmeasurable` | The element has no line boxes to measure (display: none, zero width, or inside a content-visibility subtree the browser is skipping). A composition made while it was visible is kept while it is hidden. | No | None if hidden on purpose; mount() and the React adapters compose it when it is shown or scrolled into range. After a direct typeset() call, call it again once the element is rendered. |
| `native:translated` | The page is being machine-translated (the translated-ltr or translated-rtl class that Google Translate and Chrome set, a <font> wrapper inside composed text, or Edge's _msttexthash). Typeset removed its breaks by moving the existing Text nodes, and composes again when the translation ends. | Yes | None. TypesetRichText freezes instead: the breaks React rendered stay. |
| `native:environment` | Nothing can be measured or kept correct here: a DOM emulation such as jsdom or happy-dom (Jest, Vitest), or an engine without Intl.Segmenter, Range geometry, MutationObserver or ResizeObserver. The text is left as authored and nothing throws. | Yes | None in component tests. In a browser, see the support floor in SUPPORT.md. |

## Finishing features

Composed text can also get finishing passes. Each reports its own status in
`result.features` and in `data-ts-quotes`, `data-ts-hanging`, `data-ts-spacing`
and `data-ts-tracking`. A failed pass is rolled back on its own; the
composed breaks stay.

### quotes

| Status | Meaning |
| --- | --- |
| `off` | smartQuotes was not requested. |
| `enabled` | TypesetRichText converts quotes during render (React reports this before layout). |
| `applied` | Straight quotes were converted to curly quotes. |
| `unchanged` | There were no straight quotes to convert. |
| `native:quotes-scope` | Quotes were left alone: the block or part of it declares a language other than English, or, with smartQuotes: 'en-declared' (the auto loader's default), declares none; or it contains code, pre, kbd, samp, form fields, or excluded or editable content. |

### hanging

| Status | Meaning |
| --- | --- |
| `off` | opticalHanging was not requested. |
| `applied` | Opening punctuation and capitals hang into the margin on every eligible line. |
| `applied:partial` | Hanging applied on some lines; others had no room inside the clip. |
| `unchanged` | No line starts with a character that hangs. |
| `native:hanging-layout` | Not applied: the text is centered, right-aligned, justified or indented. |
| `native:hanging-clipped` | Not applied: the glyph would be clipped by overflow, padding or a scroll container. |
| `native:hanging-font` | Not applied: the font could not be measured reliably (for example custom font-feature-settings such as onum). |
| `native:hanging-uncomposed` | Not applied: the paragraph itself was left native. |
| `native:hanging-verification` | Rolled back: the hung glyphs did not land where measured. |

### spacing

| Status | Meaning |
| --- | --- |
| `off` | spacing: false. |
| `applied` | Word spaces were adjusted within -20% to +33% of their natural width to even the rag. |
| `unchanged` | No adjustment was needed. |
| `native:spacing-layout` | Not applied: the text is not left-aligned horizontal LTR. |
| `native:spacing-measurement` | Not applied: a word space could not be measured reliably. |
| `native:spacing-mode` | Not applied: titles and headings are not spaced. |
| `native:spacing-uncomposed` | Not applied: the paragraph itself was left native. |
| `native:spacing-verification` | Rolled back: the spaced lines did not verify; the composed breaks were kept without spacing. |

### tracking

| Status | Meaning |
| --- | --- |
| `off` | tracking: false, or spacing: false. |
| `applied` | Letter spacing was adjusted by at most 0.01em per line after word spacing. |
| `unchanged` | No adjustment was needed. |
| `native:tracking-layout` | Not applied: the text is not left-aligned horizontal LTR. |
| `native:tracking-measurement` | Not applied: letter or word spacing could not be resolved to pixels. |
| `native:tracking-budget` | Not applied: more than 256 styled runs. |
| `native:tracking-script` | Not applied: the letters are outside the Latin script, which is never tracked. |
| `native:tracking-comment` | Not applied: every line that needed tracking holds author text right after an HTML comment (a framework marker, a server-rendering separator), which keeps its place unwrapped. Lines without such text are tracked. |
| `native:tracking-mode` | Not applied: titles and headings are not tracked. |
| `native:tracking-uncomposed` | Not applied: the paragraph itself was left native. |
| `native:tracking-verification` | Rolled back: tracking did not verify; word spacing was kept. |
