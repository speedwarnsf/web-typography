/** Conservative English attachments, not a general syntactic parser. */
import type { LayoutMetrics } from './layout-metrics.js';
export interface PhraseGroup {
    start: number;
    end: number;
    kind: 'nominal' | 'infinitive' | 'name';
}
/** `text` without the run of `chars` it ends with, as /[…]+$/u would
 * remove it, read backwards: that unanchored pattern retries from every
 * position of a long punctuation run, which costs the run's length squared. */
export declare const stripEnd: (text: string, chars: string) => string;
/** English sentence boundaries. Created on first use and shared. */
export declare const sentences: () => Intl.Segmenter;
/** "Dr.", "Fig.", "a.m.", "U.S." and initials such as "J." end no sentence.
 * Capital "I." and "A." are left as sentence ends ("so did I."). */
export declare function isAbbreviation(text: string): boolean;
/** A colon can introduce a thought without introducing a new sentence.
 * The period of an abbreviation ends no sentence (see boundaryBefore). */
export declare const proseBoundary: (text: string) => boolean;
/** proseBoundary with the next word as context: an abbreviation that is not
 * an honorific also ends its sentence when a capitalized common sentence
 * opener follows it. "etc." ends one before any capitalized word, "a.m." and
 * "p.m." before any but a day, a month or a time zone, and "No." before any
 * but a roman numeral (a label takes a number, "No. 5"); the opener list
 * stays for the ambiguous rest (initials, "St.", "U.S."). */
export declare function boundaryBefore(text: string, next: string | undefined): boolean;
export type BoundPair = 'unit' | 'honorific' | 'label' | 'designator';
/**
 * The kind of unit `next` forms with `previous`, if a line break between them
 * would split it. `before` is the word ahead of `previous`, if any: a capital
 * "I" is a designator only after a capitalized head that takes a roman
 * numeral ("World War I") or a name after a regnal title ("King Henry I");
 * elsewhere it is the pronoun ("When I", "In March I").
 */
export declare function boundPair(previous: string, next: string, before?: string): BoundPair | null;
/**
 * Where author `keep` phrases occur in a run of break units: [start, end)
 * unit ranges spanning at least one break. Matching ignores case, treats
 * NBSP and runs of spaces as one space, ignores punctuation around the
 * phrase, and joins a unit that ends in a hyphen or dash to the next.
 *
 * From each start, units are joined (with a space, or none after a hyphen,
 * dash or slash) and the joined text, less its opening and closing marks,
 * is compared with the phrases. That text only ever grows at its end as
 * units are added, and it takes in the closing marks it passed over (an en
 * dash run, say) once any other character follows them, so it is walked
 * down a trie of the phrases character by character instead of being
 * rebuilt: the walk from a start ends as soon as no phrase can be reached.
 * Rebuilding and rescanning the joined text at every unit cost the cube of
 * a run of dash units, which strip to nothing and so never ended the
 * search: 1,000 em dash units took 4.6 s.
 */
export declare function keptPhrases(texts: readonly string[], keep: readonly string[] | undefined): {
    start: number;
    end: number;
}[];
export declare function strandedOpener(line: string): boolean;
/** Retain naturally aligned sentences only when there is no geometric defect. */
export declare function retainSentenceLayout(source: string, before: LayoutMetrics, chosenEnds: readonly number[]): boolean;
export declare function englishPhraseGroups(texts: readonly string[], width: number, measure: (start: number, end: number) => number): PhraseGroup[];
export declare function phraseBreakCosts(texts: readonly string[], groups: readonly PhraseGroup[], title: boolean): number[];
