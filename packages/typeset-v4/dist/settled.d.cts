export interface SettleOptions {
    /** Give up after this many milliseconds and resolve { settled: false } if
     * work is still queued then. Default 10,000. */
    timeout?: number;
}
export interface Settled {
    /** false: composition work was still queued or timed when the timeout ran out. */
    settled: boolean;
}
type Busy = () => boolean;
/** Register a source of composition work; returns its removal. */
export declare function trackWork(busy: Busy): () => void;
/** Resolves once every mount() controller and React adapter host has its
 * outcome and no composition work is queued or timed. Where nothing can be
 * composed (jsdom, happy-dom, no document) it resolves { settled: true } at
 * once. */
export declare function whenSettled(options?: SettleOptions): Promise<Settled>;
export {};
