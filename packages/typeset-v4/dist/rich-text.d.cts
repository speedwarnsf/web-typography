import type { ParagraphSearchEvidence } from './typeset.cjs';
import type { LayoutMetrics } from './layout-metrics.cjs';
import type { Options } from './typeset.next.cjs';
import type { OpticalHang } from './optical-hanging.cjs';
import type { SpaceAdjustment } from './spacing-finish.cjs';
export declare const BREAK_ATTRIBUTE = "data-ts-break";
export interface RichConstraint {
    kind: 'unbreakable-run' | 'line-budget' | 'search';
    availableWidth: number;
    requiredWidth: number;
    minimumLines: number | null;
    maxLines: number | null;
}
export interface RichPlan {
    source: string;
    breaks: number[];
    widths: number[];
    before: LayoutMetrics;
    outcome: string;
    styleSignature: string;
    constraint?: RichConstraint;
    search?: ParagraphSearchEvidence[];
}
/** Verify every chosen source span and width, not just the number of lines. */
export declare function richLayoutVerified(plan: RichPlan, after: LayoutMetrics): boolean;
/** Preserve forward/backward selections, including selections crossing the host. */
export declare function selectionBookmark(element: HTMLElement): () => void;
/**
 * A generated break ends its line, so every composed line takes the
 * paragraph's last-line alignment. That undoes text-align: justify, and
 * imposes any text-align-last that differs from text-align on every line.
 * Callers have already declined anything but left-to-right text.
 */
export declare function breaksChangeAlignment(style: CSSStyleDeclaration): boolean;
/** Read the real styled DOM. No clone can reproduce contextual selectors reliably. */
export declare function planRichText(element: HTMLElement, options?: Options, nativeLayout?: RichPlan['before'], spaceWidths?: Map<string, number>): RichPlan;
/** Whether this element is inside a live region. The nearest element with a
 * non-empty aria-live decides: "off" is not live, and any other value is
 * (Chromium announces an unknown value too). An empty aria-live counts as
 * absent; without one, a status, alert, log, marquee or timer role, or
 * <output>, is live. Assistive technology announces every change there, and
 * composing rewrites the text on each resize, font load and idle pass, so
 * screen readers repeated status messages whose words had not changed.
 * Ancestors are those of the flat tree: a design system's toast or alert
 * often puts the region on an open shadow root's wrapper around a <slot>.
 * A role or aria-live set through ElementInternals, or inside a closed
 * shadow root, cannot be read from outside (SUPPORT.md: data-no-typeset). */
export declare function inLiveRegion(element: Element): boolean;
/** Whether any of this element's text is in a live region: the element is
 * inside one, or contains one (a result count, a cart total or a "saved"
 * status inside a paragraph), or contains a component whose open shadow
 * root puts the text slotted into it in one. Composing it would rewrite the
 * region's text. */
export declare function liveText(element: Element): boolean;
/** Whether a generated break at `offset` stands in for a collapsed space. */
export declare function breakReplacesSpace(source: string, offset: number): boolean;
/** Text nodes the engine created by splitting author text. Frameworks hold
 * references only to their own nodes, never to these. */
export declare const engineText: WeakSet<Text>;
/** Chromium leaves a whitespace-only Text node out of its accessibility tree
 * when the node beside it, skipping comments and empty inline elements, is an
 * empty Text node, which joins the words around it. The engine leaves author
 * Text nodes empty in place (see renderRichText and renderTracking), so it
 * puts an empty <wbr> between: a line-break opportunity where a space already
 * is one, which Chromium does not skip. Returns the shields it inserted. */
export declare function shieldWhitespace(element: HTMLElement): HTMLElement[];
/** Whether a framework may find this author Text node by position rather
 * than by reference: Solid writes parent.firstChild.data for a lone text
 * child, and Lit writes the data of its part marker's next sibling (a
 * `<!--?lit$...$-->` comment). Such a node must keep its place: nothing may go
 * in front of it, and it may not move into a wrapper. Plain HTML text is
 * often a first child too; for it the treatment is equivalent (an empty node
 * in place, identical pixels). Other comments are not taken as part markers:
 * Solid ends each dynamic text with one and reads the node's current text to
 * skip unchanged writes, which an emptied node would defeat. */
export declare function positional(node: Text): boolean;
/** Whether this author Text node follows some other comment. Lit starts each
 * item of an iterable (an array, map(), repeat()) and a top-level render()
 * with an empty comment and writes a new string to the node after it; Solid
 * ends its dynamic text with one. Nothing may go between the comment and the
 * node, and the node may neither move nor be emptied (Solid skips a write
 * equal to the node's current text, so an emptied node would keep a stale
 * copy beside it): a marker at its start goes before the comment, which
 * renders nothing, and tracking leaves its text unwrapped. */
export declare function afterComment(node: Text): boolean;
/** React 17+ records its fiber on every Text node it renders, and removes or
 * inserts relative to that node through the parent it knows, which throws if
 * the node has moved into a wrapper. */
export declare function reactOwned(node: Text): boolean;
/** Split Text nodes, head first, with every part's data as rendered. */
export interface SplitRecord {
    head: Text;
    parts: Text[];
    expected: string[];
}
/** Undo splits. A head still holding its rendered fragment gets its tails
 * back. A head that was written to (a framework setting .data or .nodeValue)
 * or removed now holds the author's whole value, or nothing: its tails are
 * stale copies of the old text and are removed, never merged back. `written`
 * names heads a mutation record showed were written, for writes that left
 * the rendered value (an emptied author node set to '' again). */
export declare function releaseSplits(element: HTMLElement, splits: Iterable<SplitRecord>, written?: ReadonlySet<Node>): void;
/** Merge split Text nodes back only where every part is still in place,
 * in order, holding the text it was split into; anything else is left as it
 * is. For text a translator held (see yieldToTranslation in typeset.next):
 * its markers and wrappers are already gone, and nothing may be removed
 * that a merge would not put back. */
export declare function rejoinSplits(element: HTMLElement, splits: Iterable<SplitRecord>): void;
export interface RichOutput {
    /** Remove this output; `written` as in releaseSplits. */
    cleanup: (written?: ReadonlySet<Node>) => void;
    /** After a translator's release: rejoin this output's splits (see
     * rejoinSplits) and stop handling its copies. Markers and wrappers are
     * already gone; nothing else is touched. */
    rejoin: () => void;
    nodes: Node[];
    /** Text nodes this output split, including author nodes; see releaseSplits. */
    heads: ReadonlySet<Text>;
}
/** Insert breaks without moving or cloning author elements. Split Text nodes
 * are reversible; their original head object is retained for restoration.
 * Nothing is inserted in front of a positional author Text node (see
 * positional): a marker at its start goes after it, and the node is split
 * there and left empty, or the framework's next write would land on the
 * marker and be lost. Nor between a comment and the node after it (see
 * afterComment): such a marker goes before the comment. */
export declare function renderRichText(element: HTMLElement, breaks: readonly number[], hangs?: readonly OpticalHang[], spaces?: readonly SpaceAdjustment[]): RichOutput;
/** Source copying is independent of visual line breaks. Respect site handlers. */
export declare function preserveRichCopy(element: HTMLElement): () => void;
export declare function richFingerprint(element: HTMLElement): string;
