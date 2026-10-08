/** Reading languages out of file and folder names (`hello.ko.mdx`, `ko/hello.mdx`), for `monti init` (which languages the site has). */
/**
 * Whether a name is the code of a real language, as a file or folder name writes it: two letters (`ko`, `pt-BR`). Three-letter codes are left out on purpose, because
 * too many of them are also ordinary words in a file name (`min`, `dev`, `ref`).
 */
export declare function isLanguageCode(value: string): boolean;
/** A language code the way a site writes it: the language in lower case, the rest as given, joined with `-` (`pt_BR` -> `pt-BR`). */
export declare function normalizeLanguageCode(value: string): string;
/** A language found in the content files. */
export interface DetectedLocale {
    readonly code: string;
    /** Files in this language. */
    readonly files: number;
    /** Files that have no counterpart in another language. */
    readonly unpaired: number;
}
/**
 * Puts the default language first: the one whose files have no pair (a blog written in one language with some posts translated has its originals there), the
 * one with the most such files when several have; with no unpaired files, or a tie, the first one. The rest keep their order.
 */
export declare function defaultFirst(locales: readonly DetectedLocale[]): DetectedLocale[];
/**
 * The languages named by the suffixes of the files of one folder (`hello.ko.mdx` and `hello.en.mdx`), default first, or `undefined` when fewer than two files carry one
 * (a lone `notes.it.md` is more likely a name than a language).
 */
export declare function localesFromFileNames(names: readonly string[]): DetectedLocale[] | undefined;
