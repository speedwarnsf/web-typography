/** Outcomes that mean there was nothing to improve: not a reason for a note. */
export declare const NOTHING_TO_IMPROVE: ReadonlySet<string>;
/** The most common outcome among `elements`, with its count. */
export declare function commonest(elements: readonly HTMLElement[]): [string, number];
/**
 * What a loader says after its first pass, as at most two console.info lines
 * and never a warning or an error: that composed text declares no language,
 * so English line-end preferences are off; and that none of the blocks it
 * matched was composed, with the most common reason. 4.3 said nothing in
 * either case, so a page whose lang read as another language (en_US before
 * 4.4) got no composition and no word about it.
 */
export declare function loaderNotes(name: string, selector: string): void;
