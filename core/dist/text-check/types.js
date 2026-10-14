/**
 * Common shape of spelling and sentence check extensions. The core ships no checker at all. A site or extension builds the checkers it needs
 * and puts them in the admin extension point `textCheckers` (`CmsAdminComponentsProvider`), and the editor draws the buttons, underlines and result window.
 *
 * Positions are always UTF-16 positions within a paragraph (the check unit) (JS string indexes). A checker that gives byte, code point or sentence based positions
 * converts them on the checker side before returning.
 */
/** The limits when a checker names none: 100 paragraphs and 20,000 characters per request. */
export const DEFAULT_TEXT_CHECKER_LIMITS = { maxSegments: 100, maxChars: 20_000 };
/**
 * Fills in the limits of a checker with defaults and rejects values that are not positive integers (`label` names the checker in the error). The server route and
 * the browser checker both read the result, so a limit means the same on both sides.
 */
export function resolveTextCheckerLimits(limits = {}, defaults = DEFAULT_TEXT_CHECKER_LIMITS, label = "text checker") {
    const resolved = { ...defaults, ...limits };
    for (const [key, value] of Object.entries(resolved)) {
        if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
            throw new Error(`${label}: limits.${key} must be a positive integer`);
        }
    }
    return resolved;
}
/** Creates a checker. Runs in the browser. A checker that needs an API key goes through the site server route with `remoteTextChecker`. */
export function defineTextChecker(options) {
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(options.id))
        throw new Error(`text checker: invalid id "${options.id}"`);
    for (const [key, value] of Object.entries(options.limits ?? {})) {
        if (value !== undefined && (!Number.isInteger(value) || value <= 0))
            throw new Error(`text checker "${options.id}": limits.${key} must be a positive integer`);
    }
    return Object.freeze({ ...options, auto: options.auto ?? false });
}
/** First part of a language code (`ko-KR` → `ko`). */
const baseLanguage = (locale) => locale.toLowerCase().split(/[-_]/)[0] ?? "";
/** Whether the text's language can be checked. */
export function supportsLocale(checker, locale) {
    if (!checker.locales || checker.locales.length === 0)
        return true;
    const target = locale.toLowerCase();
    return checker.locales.some((code) => code.toLowerCase() === target || baseLanguage(code) === baseLanguage(locale));
}
