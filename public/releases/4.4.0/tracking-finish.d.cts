import type { LayoutMetrics } from './layout-metrics.cjs';
import type { RichOutput } from './rich-text.cjs';
export declare const TRACK_ATTRIBUTE = "data-ts-track";
export declare const MAX_TRACKING_EM = 0.01;
export interface TrackingRun {
    start: number;
    end: number;
    line: number;
    px: number;
    fontSize: number;
    letterSpacing: number;
    wordSpacing: number;
}
export interface TrackingPlan {
    outcome: string;
    runs: TrackingRun[];
    before: LayoutMetrics;
    targets: number[];
}
/** A bounded residual finish: chosen breaks and existing word spaces stay fixed. */
export declare function planTrackingFinish(element: HTMLElement, layout: LayoutMetrics, targets: number[]): TrackingPlan;
/** A wrapper's own letter and word spacing. `all: unset` and display come
 * from the engine's stylesheet (LIFECYCLE_CSS in lifecycle.ts); `inline` (where
 * that sheet cannot apply, see markerRules) writes them on the wrapper, as 4.3
 * did. */
export declare function trackingStyle(run: TrackingRun, inline: boolean): Record<string, string>;
/** Wrap contiguous text runs and space markers, never author elements.
 * An author Text node that a framework finds by position (Solid, Lit; see
 * positional) or removes through its parent (React) stays where it is: its
 * text is split off into an engine node that moves, the empty author node
 * stays in place, and the run's wrappers are split around it (see
 * shieldWhitespace for the accessibility side). A node after another comment
 * (see afterComment) keeps its place and its text, unwrapped: the run's
 * wrappers are split around it. Other author Text nodes move into the
 * wrapper as in 4.2: frameworks that hold them write to them in place, and
 * some (Solid) skip a write when the node's text already equals the new
 * value, which an emptied node would always do for ''. */
export declare function renderTracking(element: HTMLElement, plan: TrackingPlan, copy?: boolean): RichOutput;
export declare function trackingVerified(element: HTMLElement, plan: TrackingPlan, after: LayoutMetrics): boolean;
