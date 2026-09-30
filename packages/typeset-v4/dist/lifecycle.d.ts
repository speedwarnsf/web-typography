/** Document-level lifecycle signals, shared by every controller and adapter in
 * a document: one set of listeners however many blocks are mounted. */
export interface LifecycleClient {
    /** A font face finished loading, or the font set settled. */
    fonts?(): void;
    /** The window resized, or printing ended. Runs before the frame's layout. */
    resize?(): void;
    /** A transition or animation of text metrics, or of a transform, ended on `target`. */
    metrics?(target: Element): void;
    /** A stylesheet was added, removed, edited or switched. */
    styles?(): void;
    /** A content-visibility:auto subtree under `target` stopped being skipped. */
    visibility?(target: Element): void;
    /** Machine translation of the document started or ended. */
    translation?(active: boolean): void;
}
/** Google Translate and Chrome's built-in translation mark the root element;
 * Edge marks the nodes it rewrites, and translators wrap text in <font>
 * (markTranslated). Translators segment text at element boundaries and hold
 * references to the Text nodes they fill, so composition steps aside. */
export declare function translationActive(doc: Document): boolean;
/** Whether a mutation in <head> can change how text is laid out: a
 * stylesheet added, removed, edited or switched. A ticking <title>, an
 * injected <script> or <meta>, a preconnect or a favicon badge's href moves
 * nothing, and rechecking every block for each cost continuous main-thread
 * time. The registry's own MutationObserver uses the same test. */
export declare function styleMutation(record: MutationRecord): boolean;
/** A translator's mark inside composed text: a <font> wrapper or an Edge
 * _msttexthash attribute. Holds until the root's translation class goes. */
export declare function markTranslated(doc: Document): void;
/** Whether a style attribute changed only by a translation (the transform or
 * translate property) or opacity: a JavaScript animation (a screen push,
 * parallax, a smooth-scroll wrapper) writes one every frame, and none of them
 * moves a line. A scale, rotation or any other declaration is a real change. */
export declare function movedOnly(before: string | null, after: string | null): boolean;
export declare function printing(doc: Document): boolean;
/** Whether an element's text is laid out now: it has boxes and is not in a
 * skipped content-visibility subtree. Measuring anything else is guesswork. */
export declare function rendered(element: Element): boolean;
/** Watches whether elements are within a viewport height of what shows them. */
export interface NearObserver {
    observe(element: Element): void;
    unobserve(element: Element): void;
    disconnect(): void;
    /** Until the observer first reports on an observed element, whether its
     * box (read by the caller, before any write) is within a viewport height of
     * what shows it; false once it has reported, or if it has no box. */
    nearBeforeReport(element: Element, box: DOMRectReadOnly): boolean;
}
/** IntersectionObservers that report an element within a viewport height of
 * what shows it: the window, or the nearest scroll container it scrolls in.
 * An app shell's overflow:auto pane clips its content, and a root margin on
 * the window does not reach past that clip, so text below the fold there
 * was never near until it was on screen. One observer per scrollport, held
 * only while it observes something, so a scroll container a route removed
 * is not kept alive; an element's scrollport is found once. The first report
 * on an element comes in a task after the next rendering update, and a
 * page's own animation frame can scroll the element in before it, so until
 * then nearBeforeReport answers from the element's box. Null without
 * IntersectionObserver. */
export declare function nearObserver(doc: Document, callback: (entries: IntersectionObserverEntry[]) => void): NearObserver | null;
/** Re-arm font notifications. WebKit fires no loading events for fonts a
 * stylesheet requests, so every face still loading is watched directly. */
export declare function armFonts(doc: Document): void;
/** Whether a stylesheet or root class change is still queued: made, and
 * laid out, but not yet delivered to the hub's MutationObserver. WebKit
 * delivers the records of a mutation that an about:blank page makes in its
 * same-origin iframe after that frame's ResizeObserver callbacks, which call
 * this. The records are taken and handled in the next task, since those
 * callbacks must not write; until then every caller is told of them. */
export declare function signalQueued(doc: Document): boolean;
/** Receive this document's lifecycle signals until the returned function runs. */
export declare function subscribe(doc: Document, client: LifecycleClient): () => void;
/** Hooks for authors and for the engine's own transient states:
 * --ts-break-display drives every generated break, [data-ts-stale] shows a
 * block's native wrapping while its composition waits to be redone, and print
 * wraps natively at the paper's width. dist/styles.css ships the same rules
 * for engines without constructable stylesheets.
 *
 * First, the declarations every spacing and hanging marker and every
 * tracking wrapper shares, which 4.3 wrote into each one's style attribute:
 * 18 per marker, and a wrapper's all: unset, which browsers serialize as
 * every longhand (5 to 8 KB per wrapper). Only the per-marker value stays
 * inline: a marker's margin-left, a wrapper's letter-spacing and
 * word-spacing. The markers' rules are !important in a named cascade layer,
 * which page CSS reaches no more easily than it reached the inline
 * declarations: an unlayered !important rule, which beat those, loses to a
 * layered one. The wrappers' rule is not important, as their inline
 * declarations were not: an !important all: unset would also hide their
 * inline spacing from page !important rules (the WCAG text-spacing
 * override) and the stale and print rules below, which must reach it. Its
 * three :not(#_) outweigh any selector with fewer than three ids, so
 * ordinary page rules do not reach a wrapper, as they did not reach its
 * inline all: unset. Where this sheet cannot apply (no constructable
 * stylesheets), markers carry the same declarations inline, as in 4.3 (see
 * markerRules). Breaks keep their one inline declaration: !important
 * inline, it is the one thing no rule can override. One literal, not a
 * concatenation of constants, so bundlers can drop it with the functions. */
export declare const LIFECYCLE_CSS: string;
/** One constructable stylesheet per document: no <style> element, so a strict
 * style-src policy is not involved. Skipped where unsupported. A page that
 * assigns document.adoptedStyleSheets (a theme switcher, the MDN example)
 * drops it; installing again, and ensureLifecycleStyles() as printing starts,
 * before stale mode and in each pass, put it back. */
export declare function installLifecycleStyles(doc: Document, element?: Element): void;
/** A document's stylesheets do not reach into shadow trees: text composed
 * inside a shadow root (mount(shadowRoot, ...), a component's own markup)
 * gets the same sheet adopted by that root, or stale mode and the print
 * rules would not apply to it. Installs nothing new. */
export declare function lifecycleStylesFor(element: Element): void;
/** Whether the engine's marker rules (in LIFECYCLE_CSS) reach markers inside this
 * element: the lifecycle sheet is installed, first if need be, and adopted by
 * the element's document or shadow root. When they do not, markers carry
 * their shared declarations inline. With `install` false, only reads. */
export declare function markerRules(element: Element, install?: boolean): boolean;
/** Put an installed lifecycle sheet back if the page's own assignment to
 * document.adoptedStyleSheets removed it. Installs nothing new. */
export declare function ensureLifecycleStyles(doc: Document): void;
