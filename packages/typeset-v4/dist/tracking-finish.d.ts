import type { LayoutMetrics } from './layout-metrics.js';
import type { RichOutput } from './rich-text.js';
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
export declare function trackingStyle(run: TrackingRun): Record<string, string>;
/** Wrap contiguous text/engine-space runs only, never author elements. */
export declare function renderTracking(element: HTMLElement, plan: TrackingPlan): RichOutput;
export declare function trackingVerified(element: HTMLElement, plan: TrackingPlan, after: LayoutMetrics): boolean;
