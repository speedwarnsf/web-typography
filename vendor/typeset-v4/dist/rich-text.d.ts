import type { LayoutMetrics } from './layout-metrics.js';
import type { Options } from './typeset.next.js';
import type { OpticalHang } from './optical-hanging.js';
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
}
/** Preserve forward/backward selections, including selections crossing the host. */
export declare function selectionBookmark(element: HTMLElement): () => void;
/** Read the real styled DOM. No clone can reproduce contextual selectors reliably. */
export declare function planRichText(element: HTMLElement, options?: Options): RichPlan;
export interface RichOutput {
    cleanup: () => void;
    nodes: Node[];
}
/** Insert breaks without moving or cloning author elements. Split Text nodes
 * are reversible; their original head object is retained for restoration. */
export declare function renderRichText(element: HTMLElement, breaks: readonly number[], hangs?: readonly OpticalHang[]): RichOutput;
/** Source copying is independent of visual line breaks. Respect site handlers. */
export declare function preserveRichCopy(element: HTMLElement): () => void;
export declare function richFingerprint(element: HTMLElement): string;
