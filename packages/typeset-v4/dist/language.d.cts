/**
 * The language a lang attribute declares: 'und' when it declares none, the
 * language subtag of a BCP 47 tag ('en' for en-GB), 'unsupported' for a tag
 * that names a script other than Latin, and 'invalid' for one Intl.Locale
 * cannot read. An underscore is read as a hyphen (en_US, as CMS and PHP
 * templates write it, also as en_US.UTF-8) and a language's name as its code
 * (english, Deutsch): 4.3 read these as other languages and left every block
 * native.
 */
export declare function languageOf(tag: string | null | undefined): string;
/** Whether a declared language is written in the Latin script: its tag names
 * Latn, or names no script and Latin is the language's likely one
 * (Intl.Locale's maximize(): pt, vi, sw and sr-Latn are; sr, el and ja are
 * not). An undeclared or unreadable tag counts as Latin: the check on the
 * text's own script decides. */
export declare function latinTag(tag: string | null | undefined): boolean;
