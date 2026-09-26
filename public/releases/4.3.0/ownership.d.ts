/** Which lifecycle owner may write a target: one mount() controller or the
 * React adapters' registry. Controllers share composition state, so only one
 * may write a given element; the others wait to be woken when it is released. */
export declare const mountOwners: WeakMap<HTMLElement, symbol>;
export declare const mountWaiters: WeakMap<HTMLElement, Set<() => void>>;
/** Release `element` if `identity` owns it, and wake whoever was waiting. */
export declare function releaseOwner(element: HTMLElement, identity: symbol): void;
