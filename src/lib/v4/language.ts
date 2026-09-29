/** Language names that pages put in lang instead of a code ("english",
 * "Deutsch"), mapped to the code. Only names that cannot mean anything else. */
const names: Record<string, string> = {
  english: 'en', french: 'fr', 'français': 'fr', francais: 'fr', german: 'de', deutsch: 'de',
  spanish: 'es', 'español': 'es', espanol: 'es', portuguese: 'pt', 'português': 'pt', portugues: 'pt',
  italian: 'it', italiano: 'it', dutch: 'nl', nederlands: 'nl',
};

/** A lang value as a BCP 47 tag: a POSIX locale's charset or modifier
 * dropped (en_US.UTF-8), underscores read as hyphens, and a language's name
 * as its code (english_UK is en-UK). '' when it declares nothing. */
function normalized(tag: string | null | undefined): string {
  const parts = (tag?.trim() ?? '').replace(/[.@].*$/u, '').replace(/_/g, '-').split('-');
  parts[0] = names[parts[0].toLowerCase()] ?? parts[0];
  return parts.join('-');
}

/**
 * The language a lang attribute declares: 'und' when it declares none, the
 * language subtag of a BCP 47 tag ('en' for en-GB), 'unsupported' for a tag
 * that names a script other than Latin, and 'invalid' for one Intl.Locale
 * cannot read. An underscore is read as a hyphen (en_US, as CMS and PHP
 * templates write it, also as en_US.UTF-8) and a language's name as its code
 * (english, Deutsch): 4.3 read these as other languages and left every block
 * native.
 */
export function languageOf(tag: string | null | undefined): string {
  const text = normalized(tag);
  if (!text) return 'und';
  try {
    const locale = new Intl.Locale(text);
    return locale.script && locale.script !== 'Latn' ? 'unsupported' : locale.language || 'und';
  } catch { return 'invalid'; }
}
