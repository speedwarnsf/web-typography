export type Priority = 'auto' | 'sync';
export type Reason = 'mount' | 'force' | 'check';
export interface AdapterEntry {
    element: HTMLElement;
    priority: Priority;
    /** Compose now. `inCommit` is true inside a React commit (layout effects),
     * where state updates are already synchronous. */
    compose(reason: Reason, inCommit: boolean): void;
    /** Whether the host's layout key differs from its last composition. */
    changed(fonts: string): boolean;
    /** The widest composed line in px; 0 when there is nothing to double-wrap. */
    widest(): number;
    /** Show native lines until the next composition. */
    stale(): void;
    /** A composition request was deferred: make the host correct in the meantime. */
    deferred?(reason: Reason): void;
    /** Nothing can be composed or kept correct here (jsdom, happy-dom, an engine
     * without the observers): report 'native:environment' and leave the text. */
    unsupported(): void;
    /** Machine translation of the document started or ended. */
    translation?(active: boolean): void;
}
export declare const COMMIT_BUDGET_MS = 6;
interface Registry {
    identity: symbol;
    entries: Map<HTMLElement, AdapterEntry>;
    add(entry: AdapterEntry): void;
    remove(entry: AdapterEntry): void;
    request(entry: AdapterEntry, reason: Reason, inCommit: boolean): void;
    writing<T>(write: () => T): T;
}
export declare function adapterRegistry(doc: Document): Registry;
export {};
