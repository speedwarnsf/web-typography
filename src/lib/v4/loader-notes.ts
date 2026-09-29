import { languageOf } from './language';

/** Outcomes that mean there was nothing to improve: not a reason for a note. */
export const NOTHING_TO_IMPROVE: ReadonlySet<string> = new Set(['native:fits', 'native:empty', 'native:sentence-aligned', 'native:paragraph-rhythm']);

/** The most common outcome among `elements`, with its count. */
export function commonest(elements: readonly HTMLElement[]): [string, number] {
  const counts = new Map<string, number>();
  for (const el of elements) counts.set(el.dataset.tsOutcome!, (counts.get(el.dataset.tsOutcome!) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0];
}

/**
 * What a loader says after its first pass, as at most two console.info lines
 * and never a warning or an error: that composed text declares no language,
 * so English line-end preferences are off; and that none of the blocks it
 * matched was composed, with the most common reason. 4.3 said nothing in
 * either case, so a page whose lang read as another language (en_US before
 * 4.4) got no composition and no word about it.
 */
export function loaderNotes(name: string, selector: string): void {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(el => el.dataset.tsOutcome);
  const composed = blocks.filter(el => el.dataset.tsOutcome!.startsWith('composed'));
  if (composed.some(el => languageOf(el.closest('[lang]')?.getAttribute('lang')) === 'und')) {
    console.info(name + ': no lang attribute, so English line-end preferences are off; add lang="en" to <html> if the page is in English.');
  }
  const declined = blocks.filter(el => !NOTHING_TO_IMPROVE.has(el.dataset.tsOutcome!));
  if (!composed.length && declined.length) {
    const [outcome, count] = commonest(declined);
    console.info(name + ': none of the ' + blocks.length + ' matched blocks was composed; most common: ' + outcome + ' ×' + count + '; see https://typeset.us/docs');
  }
}
