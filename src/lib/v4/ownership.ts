/** Which lifecycle owner may write a target: one mount() controller or the
 * React adapters' registry. Controllers share composition state, so only one
 * may write a given element; the others wait to be woken when it is released. */
export const mountOwners = new WeakMap<HTMLElement, symbol>();
export const mountWaiters = new WeakMap<HTMLElement, Set<() => void>>();

/** Release `element` if `identity` owns it, and wake whoever was waiting. */
export function releaseOwner(element: HTMLElement, identity: symbol): void {
  if (mountOwners.get(element) !== identity) return;
  mountOwners.delete(element);
  const waiters = mountWaiters.get(element);
  mountWaiters.delete(element);
  for (const wake of waiters || []) wake();
}
