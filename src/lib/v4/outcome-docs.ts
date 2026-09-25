/**
 * What each outcome and feature status means, and what to do about it. This
 * table is documentation, not runtime code: nothing in the engine imports it.
 * `satisfies` makes TypeScript require exactly one row per code in
 * outcomes.ts. scripts/v4/outcomes-doc.mjs renders it as
 * packages/typeset-v4/OUTCOMES.md and docs/outcomes.md.
 */
import type { Outcome, FEATURE_STATUSES } from './outcomes';

export type OutcomeGroup = 'composed' | 'nothing to improve' | 'unsupported content' | "couldn't improve safely" | 'not processed';
export interface OutcomeRow {
  group: OutcomeGroup;
  /** What happened, in plain words. */
  meaning: string;
  /** True when this is a normal result that needs no action. */
  expected: boolean;
  /** What to do, if anything. */
  action: string;
}

export const OUTCOME_GROUPS: Record<OutcomeGroup, string> = {
  composed: 'Typeset chose the line breaks. The text, links and styling are unchanged.',
  'nothing to improve': 'Left as the browser set it, because Typeset had nothing to add. These are normal.',
  'unsupported content': 'Left as the browser set it, because the content or its CSS is outside what Typeset composes. Nothing is broken; Typeset stepped aside.',
  "couldn't improve safely": 'Left as the browser set it, because every candidate failed a limit or a check after rendering. Typeset shows the browser layout rather than a worse one.',
  'not processed': 'Typeset did not look at the element.',
};

export const OUTCOME_DOCS = {
  'composed': { group: 'composed', expected: true, meaning: 'Plain text composed and verified after rendering.', action: 'None.' },
  'composed:rich': { group: 'composed', expected: true, meaning: 'Text with links, emphasis or other inline markup composed and verified; author elements were kept, never cloned.', action: 'None.' },

  'native:fits': { group: 'nothing to improve', expected: true, meaning: 'The text fits on one line.', action: 'None.' },
  'native:empty': { group: 'nothing to improve', expected: true, meaning: 'The element has no text.', action: 'None, or narrow the selector.' },
  'native:sentence-aligned': { group: 'nothing to improve', expected: true, meaning: "The browser's lines already end at sentence or clause boundaries, so they were kept.", action: 'None.' },
  'native:paragraph-rhythm': { group: 'nothing to improve', expected: true, meaning: "The browser's rag was as good as the best candidate, so it was kept.", action: "None. density: 'editorial' lets Typeset use one more line for phrasing." },

  'native:language': { group: 'unsupported content', expected: true, meaning: 'The declared language is not English, French, German or Spanish (or, with lineBreaks: legacy, not English).', action: 'None; set lang correctly. Other languages are left to the browser.' },
  'native:mixed-language': { group: 'unsupported content', expected: true, meaning: 'Part of the block declares a different language.', action: 'None, or split the block by language.' },
  'native:script': { group: 'unsupported content', expected: true, meaning: 'The text contains non-Latin script or bidirectional controls.', action: 'None. Typeset composes Latin-script text only.' },
  'native:direction': { group: 'unsupported content', expected: true, meaning: 'The element is right-to-left or vertical.', action: 'None. RTL and vertical text are not supported.' },
  'native:transformed': { group: 'unsupported content', expected: true, meaning: 'The element or an ancestor is scaled, rotated, skewed or zoomed, so measured widths would not match what is drawn.', action: 'Remove the transform, or leave it native.' },
  'native:decorated': { group: 'unsupported content', expected: true, meaning: 'The element has ::before or ::after content that shares its lines.', action: 'Move the decoration outside the text box, or leave it native.' },
  'native:whitespace': { group: 'unsupported content', expected: true, meaning: 'white-space preserves spaces or prevents wrapping (pre, pre-wrap, nowrap, break-spaces).', action: 'None; preserved whitespace is left to the browser.' },
  'native:author-breaks': { group: 'unsupported content', expected: true, meaning: 'The text has its own line breaks (pre-line newlines or Unicode line separators).', action: 'None; authored breaks are kept.' },
  'native:soft-hyphen': { group: 'unsupported content', expected: true, meaning: 'The text contains soft hyphens (&shy;).', action: 'Remove soft hyphens to let Typeset compose it; Typeset does not hyphenate.' },
  'native:auto-hyphens': { group: 'unsupported content', expected: true, meaning: 'hyphens: auto is set, so the browser may hyphenate.', action: 'Use hyphens: manual or none to let Typeset compose it.' },
  'native:break-policy': { group: 'unsupported content', expected: true, meaning: 'word-break, line-break or overflow-wrap asks for breaks Typeset does not model (for example overflow-wrap: anywhere).', action: 'None, or use overflow-wrap: break-word, which Typeset supports.' },
  'native:clamped': { group: 'unsupported content', expected: true, meaning: 'The text is clamped or truncated with an ellipsis.', action: 'None.' },
  'native:inline': { group: 'unsupported content', expected: true, meaning: 'The target is display: inline, so it has no box of its own to compose.', action: 'Target the block that contains it.' },
  'native:ui': { group: 'unsupported content', expected: true, meaning: "mode: 'ui' (or data-typeset-mode=\"ui\") marks interface text, which is never composed.", action: 'None.' },
  'native:rich-element': { group: 'unsupported content', expected: true, meaning: 'The block contains an element other than inline text markup (a, b, strong, em, i, span, small, u, s, del, mark, abbr, cite, code), such as an image, button or nested block.', action: 'None, or compose the text blocks inside it separately.' },
  'native:rich-excluded': { group: 'unsupported content', expected: true, meaning: 'The block contains hidden, aria-hidden, editable or data-no-typeset content.', action: 'None.' },
  'native:rich-direction': { group: 'unsupported content', expected: true, meaning: 'An inline element changes direction, bidi or writing mode, or is not visible.', action: 'None.' },
  'native:rich-whitespace': { group: 'unsupported content', expected: true, meaning: 'Inline markup preserves whitespace, is indented, or changes text advances (a transform).', action: 'None.' },
  'native:rich-layout': { group: 'unsupported content', expected: true, meaning: 'An inline element is not a plain inline box (inline-block, positioned, or not on the baseline).', action: 'None.' },
  'native:rich-box': { group: 'unsupported content', expected: true, meaning: 'An inline element has negative padding, borders or margins, or box-decoration-break: clone.', action: 'None.' },
  'native:rich-decorated': { group: 'unsupported content', expected: true, meaning: 'An inline element has ::before or ::after content.', action: 'None.' },
  'native:rich-tokens': { group: 'unsupported content', expected: false, meaning: 'The words could not be matched to text positions in the markup.', action: 'Report it with auditJSON output; this should be rare.' },
  'native:react-component': { group: 'unsupported content', expected: true, meaning: 'TypesetRichText has a custom component child, whose rendering React owns.', action: 'Use host elements (a, strong, em, span) inside TypesetRichText.' },

  'native:budget': { group: "couldn't improve safely", expected: true, meaning: 'The block is longer than the composition budget (500 words or 12,000 characters).', action: 'None; very long blocks are left to the browser.' },
  'native:no-candidate': { group: "couldn't improve safely", expected: false, meaning: 'No arrangement of the allowed breaks fits the width and line limits. result.constraint says why: an unbreakable run wider than the box, a line budget, or the search.', action: 'Read result.constraint; widen the box, allow overflow-wrap: break-word, or raise maxLines.' },
  'native:line-budget': { group: "couldn't improve safely", expected: true, meaning: 'Every candidate needs more lines than allowed (maxLines, or the native line count plus the body allowance).', action: "None, or raise maxLines or use density: 'editorial'." },
  'native:quality': { group: "couldn't improve safely", expected: true, meaning: 'The composed result would have created a one-word last line the browser did not have, so it was discarded.', action: 'None.' },
  'native:render-failed': { group: "couldn't improve safely", expected: false, meaning: 'Rendering the chosen lines threw an error; the original nodes were put back.', action: 'Report it with the page and auditJSON output.' },
  'native:verification': { group: "couldn't improve safely", expected: false, meaning: 'After rendering, the lines, text or styling did not match the plan (a font or width changed, or CSS moved text), so the browser layout was restored.', action: 'Usually transient; mount() recomposes when the cause settles. Persistent cases: report with auditJSON output.' },

  'skipped:excluded': { group: 'not processed', expected: true, meaning: 'The element is inside data-no-typeset, code, pre, a form control, nav, a button or editable content.', action: 'None.' },
  'skipped:framework': { group: 'not processed', expected: true, meaning: 'TypesetRichText owns this element, so imperative typeset() and mount() leave it alone.', action: 'None; keep one owner per element.' },
  'unmeasurable': { group: 'not processed', expected: false, meaning: 'The element has no line boxes to measure (it is hidden, display: none or zero width).', action: 'None if hidden on purpose; mount() composes it when it is shown.' },
} as const satisfies Record<Outcome, OutcomeRow>;

type Status<F extends keyof typeof FEATURE_STATUSES> = typeof FEATURE_STATUSES[F][number];

/** Feature statuses: the same words mean the same thing for every feature. */
export const FEATURE_DOCS = {
  quotes: {
    'off': 'smartQuotes was not requested.',
    'enabled': 'TypesetRichText converts quotes during render (React reports this before layout).',
    'applied': 'Straight quotes were converted to curly quotes.',
    'unchanged': 'There were no straight quotes to convert.',
    'native:quotes-scope': 'Quotes were left alone: the block or part of it declares a language other than English, or it contains code, pre, kbd, samp, form fields, or excluded or editable content.',
  },
  hanging: {
    'off': 'opticalHanging was not requested.',
    'applied': 'Opening punctuation and capitals hang into the margin on every eligible line.',
    'applied:partial': 'Hanging applied on some lines; others had no room inside the clip.',
    'unchanged': 'No line starts with a character that hangs.',
    'native:hanging-layout': 'Not applied: the text is centered, right-aligned, justified or indented.',
    'native:hanging-clipped': 'Not applied: the glyph would be clipped by overflow, padding or a scroll container.',
    'native:hanging-font': 'Not applied: the font could not be measured reliably (for example custom font-feature-settings such as onum).',
    'native:hanging-uncomposed': 'Not applied: the paragraph itself was left native.',
    'native:hanging-verification': 'Rolled back: the hung glyphs did not land where measured.',
  },
  spacing: {
    'off': 'spacing: false.',
    'applied': 'Word spaces were adjusted within -20% to +33% of their natural width to even the rag.',
    'unchanged': 'No adjustment was needed.',
    'native:spacing-layout': 'Not applied: the text is not left-aligned horizontal LTR.',
    'native:spacing-measurement': 'Not applied: a word space could not be measured reliably.',
    'native:spacing-mode': 'Not applied: titles and headings are not spaced.',
    'native:spacing-uncomposed': 'Not applied: the paragraph itself was left native.',
    'native:spacing-verification': 'Rolled back: the spaced lines did not verify; the composed breaks were kept without spacing.',
  },
  tracking: {
    'off': 'tracking: false, or spacing: false.',
    'applied': 'Letter spacing was adjusted by at most 0.01em per line after word spacing.',
    'unchanged': 'No adjustment was needed.',
    'native:tracking-layout': 'Not applied: the text is not left-aligned horizontal LTR.',
    'native:tracking-measurement': 'Not applied: letter or word spacing could not be resolved to pixels.',
    'native:tracking-budget': 'Not applied: more than 256 styled runs.',
    'native:tracking-script': 'Not applied: the letters are outside the Latin script, which is never tracked.',
    'native:tracking-mode': 'Not applied: titles and headings are not tracked.',
    'native:tracking-uncomposed': 'Not applied: the paragraph itself was left native.',
    'native:tracking-verification': 'Rolled back: tracking did not verify; word spacing was kept.',
  },
} as const satisfies { [F in keyof typeof FEATURE_STATUSES]: Record<Status<F>, string> };
