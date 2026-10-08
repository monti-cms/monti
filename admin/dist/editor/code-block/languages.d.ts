import type { CodeLanguageOption } from "./types.js";
export declare const CODE_LANGUAGE_OPTIONS: CodeLanguageOption[];
/** The default language list followed by the site's extra languages (`codeBlock.languages`) that are not in it yet. The label of an extra language is its name. */
export declare const codeLanguageChoices: (extra: readonly string[]) => CodeLanguageOption[];
