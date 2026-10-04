import type { LanguageInput, ThemeRegistrationAny } from "shiki/core";
/** Default language list for code blocks. Change it with `createCodeHighlighter({ langs })`. */
export declare const DEFAULT_CODE_LANGS: LanguageInput[];
/** Default language aliases for code blocks. Change them with `createCodeHighlighter({ langAlias })`. */
export declare const DEFAULT_CODE_LANG_ALIAS: Record<string, string>;
/** Default light and dark themes for code blocks. Change them with `createCodeHighlighter({ themes })`. */
export declare const DEFAULT_CODE_THEMES: {
    light: ThemeRegistrationAny;
    dark: ThemeRegistrationAny;
};
