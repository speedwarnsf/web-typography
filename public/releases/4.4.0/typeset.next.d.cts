import { contentWidth, measureLayout } from './layout-metrics.cjs';
import type { LayoutMetrics } from './layout-metrics.cjs';
import { planRichText } from './rich-text.cjs';
import type { RichPlan } from './rich-text.cjs';
export { analyzeBreaks, UNICODE_VERSION } from './break-opportunities.cjs';
import type { Outcome, QuoteStatus, HangingStatus, SpacingStatus, TrackingStatus } from './outcomes.cjs';
import type { Coverage } from './coverage.cjs';
export declare const VERSION = "4.4.0";
export type Mode = 'body' | 'heading' | 'title' | 'ui';
/**
 * Composition options. Defaults are those of the typeset.us package entry
 * points (typeset, typesetAll, mount, planRichText and the React adapters).
 * The same options are accepted by every entry point.
 */
export interface Options {
    /** Where lines may break. Default `'unicode'`: Unicode 17 line-break
     * opportunities with English, French, German and Spanish preferences from
     * the declared `lang`. `'legacy'` is the earlier English-only research path,
     * kept for comparison; it is not identical to 3.x. */
    lineBreaks?: 'legacy' | 'unicode';
    /** Default `false`. `'en'` converts straight quotes and apostrophes to curly
     * ones in English text: declared English, or untagged (quotes only; same
     * length, so offsets and copying stay aligned). `'en-declared'` converts
     * them only where the element or an ancestor declares English (the auto
     * loader's default), so an untagged German or French page keeps its
     * quotes. Changes the copied text. */
    smartQuotes?: 'en' | 'en-declared' | false;
    /** Default `false`. `true` hangs opening punctuation and measured capitals
     * into the left margin, reversibly, when the glyph fits inside any clip. */
    opticalHanging?: boolean;
    /** Default `true`. Adjusts word spaces on composed, left-aligned body text
     * within -20% to +33% of their natural width. `false` also turns off
     * `tracking`. */
    spacing?: boolean;
    /** Default `true` (while `spacing` is on). Adjusts letter spacing by at most
     * 0.01em per line after word spacing. `false` keeps word spacing only. */
    tracking?: boolean;
    /** Default `'finished'`: ranks candidates by their predicted rag after
     * spacing. `'natural'` ranks by natural widths, the earlier ranking, kept
     * for comparison. */
    contour?: 'natural' | 'finished';
    /** Default `'body'`, or `'title'` inside h1-h6; also read from
     * `data-typeset-mode`. `'title'` and `'heading'` balance short display text
     * and never add a line; `'body'` composes paragraphs; `'ui'` never composes
     * (outcome `native:ui`). */
    mode?: Mode;
    /** Default none. Phrases whose words should stay on one line, such as
     * `['New York']`. Matching ignores case, treats NBSP and runs of spaces as
     * one space and ignores punctuation around the phrase. In body text a kept
     * phrase that fits the measure is never split, a phrase the browser splits
     * can earn one extra line (not with `density: 'compact'`), and a longer
     * phrase is split as few times as possible. Titles and headings keep
     * phrases within their minimum line count. The browser's lines are kept
     * as they are only when they split no kept phrase. */
    keep?: readonly string[];
    /** Default none. The most lines a composition may use; a result that needs
     * more is declined with `native:line-budget`. */
    maxLines?: number;
    /** Default (omitted): body text keeps the browser's line count, or uses one
     * more line to repair a one-word last line or a stranded sentence or
     * clause opener. `'compact'`: one more line only to repair a one-word last
     * line. `'editorial'`: one more line allowed for better phrasing. */
    density?: 'compact' | 'editorial';
    /** Default `'core'`, which composes what 4.3.1 composed. `'extended'`
     * opts in to composing more: text declared in any Latin-script language
     * (neutral line-end preferences, as for untagged text), paragraphs with a
     * descendant declared in another Latin-script language, `time`, `dfn`,
     * `kbd`, `ins`, visually hidden text, and `sup` and `sub`, which `'core'`
     * leaves native. Also `data-typeset-coverage`. */
    coverage?: Coverage;
    /** Default `true`. `false` makes mount(), typesetAll() and the loaders
     * (`data-typeset-headings="false"`) leave h1 to h6, `role="heading"` and
     * anything inside them untouched, with no outcome written: a composed
     * heading that wraps has a line break inside it, which a screen reader may
     * read as two items (not yet checked by ear). typeset() composes the
     * element it is given. */
    headings?: boolean;
    /** Default `true`: a document copy handler puts the source text on the
     * clipboard, without the generated line breaks (and, for rich text, the
     * markup without engine markers). `false` leaves this element's copying to
     * the browser, whose copied text then has a line break at every composed
     * line end. The handler is installed only when some composed element has
     * copy on, and it yields to any copy handler the page registered first. */
    copy?: boolean;
    /** Current author text. Framework adapters pass this on updates. */
    text?: string;
}
/** What typeset() did to one element. `outcome` is also written to
 * `data-ts-outcome`; OUTCOMES.md explains every value. */
export interface Result {
    /** One of OUTCOMES; typed so that a future code still compiles. */
    outcome: Outcome | (string & {});
    mode: Mode;
    /** Line boxes before and after, as measured in the browser. */
    before: LayoutMetrics;
    after: LayoutMetrics;
    /** True when the DOM was changed (composed, or quotes converted). */
    changed: boolean;
    durationMs: number;
    /** Why no candidate fitted, when outcome is `native:no-candidate`. */
    constraint?: RichPlan['constraint'];
    /** Candidate-search evidence for rich composition. */
    search?: RichPlan['search'];
    /** Finishing-feature statuses (also `data-ts-quotes`, `-hanging`, `-spacing`, `-tracking`). */
    features?: {
        quotes: QuoteStatus | (string & {});
        hanging: HangingStatus | (string & {});
        spacing: SpacingStatus | (string & {});
        tracking: TrackingStatus | (string & {});
    };
}
/** Release this engine's output. Original nodes, attributes, and listeners survive. */
export declare function restore(element: HTMLElement): void;
/** Compose supported text while preserving source content and live elements. */
export declare function typeset(element: HTMLElement, options?: Options): Result;
export declare function typesetAll(selector?: string, options?: Options): Result[];
export interface AuditIssue {
    element: HTMLElement;
    type: string;
    severity: 'error' | 'review';
    detail: string;
}
export interface AuditReport {
    examined: number;
    outcomes: Record<string, number>;
    features: Record<'quotes' | 'hanging' | 'spacing' | 'tracking', Record<string, number>>;
    issues: AuditIssue[];
}
export declare function auditReport(selector?: string): AuditReport;
export declare function audit(selector?: string): AuditIssue[];
/** JSON-safe evidence for agents and CI. Review items are not hard failures;
 * an empty selector match is never reported as a successful audit. */
export declare function auditJSON(selector?: string): {
    schemaVersion: number;
    engineVersion: string;
    examined: number;
    pass: boolean;
    errors: number;
    reviews: number;
    unprocessed: number;
    outcomes: Record<string, number>;
    features: Record<"hanging" | "spacing" | "tracking" | "quotes", Record<string, number>>;
    issues: {
        target: string;
        type: string;
        severity: "error" | "review";
        detail: string;
    }[];
};
export interface Controller {
    ready: Promise<void>;
    refresh: () => void;
    disconnect: (restoreContent?: boolean) => void;
    stats: {
        passes: number;
        compositions: number;
        maxBatchMs: number;
        readonly overlappingTargets: number;
    };
}
/** One lifecycle owner per mount. Observers are disconnected during our writes.
 * mount('article p', options) is mount(document, 'article p', options). */
export declare function mount(selector: string, options?: Options): Controller;
export declare function mount(root?: ParentNode, selector?: string, options?: Options): Controller;
export { measureLayout, contentWidth, planRichText };
export type { RichPlan } from './rich-text.cjs';
export { typesetText, typesetHeading, measureCh, safeWrite, shouldIgnoreMutation } from './typeset.cjs';
