import type { LayoutMetrics } from './layout-metrics.js';
export interface OpticalHang {
    offset: number;
    px: number;
}
export interface OpticalPlan {
    outcome: string;
    hangs: OpticalHang[];
}
/** Optical alignment is a rendering pass, never an extra line-breaking allowance. */
export declare function planOpticalHanging(element: HTMLElement, layout: LayoutMetrics): OpticalPlan;
export declare function opticalMarkerStyle(px: number): Record<string, string>;
export declare function opticalVerified(element: HTMLElement, before: LayoutMetrics, after: LayoutMetrics, hangs: OpticalHang[]): boolean;
