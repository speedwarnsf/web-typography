import { contentWidth, measureLayout } from './layout-metrics.js';
import type { LayoutMetrics } from './layout-metrics.js';
import { planRichText } from './rich-text.js';
import type { RichPlan } from './rich-text.js';
export { analyzeBreaks, UNICODE_VERSION } from './break-opportunities.js';
export declare const VERSION = "4.0.0-beta.1";
export type Mode = 'body' | 'heading' | 'title' | 'ui';
export interface Options {
    /** Opt-in Unicode 17 break opportunities; default preserves the legacy path. */
    lineBreaks?: 'legacy' | 'unicode';
    /** Explicit English text transformation. Off unless requested. */
    smartQuotes?: 'en' | false;
    /** Reversible leading punctuation/capital alignment. Off unless requested. */
    opticalHanging?: boolean;
    mode?: Mode;
    keep?: readonly string[];
    maxLines?: number;
    /** Compact preserves native line count, except one extra line to fix an
     * orphan. Editorial permits one additional line for prose phrasing. */
    density?: 'compact' | 'editorial';
    /** Current author text. Framework adapters should pass this on updates. */
    text?: string;
}
export interface Result {
    outcome: string;
    mode: Mode;
    before: LayoutMetrics;
    after: LayoutMetrics;
    changed: boolean;
    durationMs: number;
    constraint?: RichPlan['constraint'];
    features?: {
        quotes: string;
        hanging: string;
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
    features: Record<'quotes' | 'hanging', Record<string, number>>;
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
    features: Record<"quotes" | "hanging", Record<string, number>>;
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
    };
}
/** One lifecycle owner per mount. Observers are disconnected during our writes. */
export declare function mount(root?: ParentNode, selector?: string, options?: Options): Controller;
export { measureLayout, contentWidth, planRichText };
export type { RichPlan } from './rich-text.js';
export { typesetText, typesetHeading, measureCh, safeWrite, shouldIgnoreMutation } from './typeset.js';
