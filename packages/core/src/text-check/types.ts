/**
 * Common shape of spelling and sentence check extensions. The core ships no checker at all. A site or extension builds the checkers it needs
 * and puts them in the admin extension point `textCheckers` (`CmsAdminComponentsProvider`), and the editor draws the buttons, underlines and result window.
 *
 * Positions are always UTF-16 positions within a paragraph (the check unit) (JS string indexes). A checker that gives byte, code point or sentence based positions
 * converts them on the checker side before returning.
 */

/** One check unit. The text of one editor paragraph (a block that holds text, such as a heading, list item or table cell). */
export interface TextCheckSegment {
	/** A name that does not change while the text is the same. Results (`TextIssue.segmentId`) point to the paragraph by this name. */
	readonly id: string;
	readonly text: string;
	/** Language of the text (a language code of the site config, such as `ko` or `en`). */
	readonly locale: string;
}

export type TextIssueSeverity = "error" | "warning" | "info";

/** Common categories. A checker may use other names. */
export type TextIssueCategory = "spelling" | "spacing" | "grammar" | "style" | "term" | (string & {});

/** One check result. `start` and `end` are UTF-16 positions within that paragraph, and `end` is exclusive. */
export interface TextIssue {
	readonly segmentId: string;
	readonly start: number;
	readonly end: number;
	readonly message: string;
	/** Replacement candidates. An empty array if none. */
	readonly suggestions: readonly string[];
	readonly severity: TextIssueSeverity;
	readonly ruleId?: string;
	readonly category?: TextIssueCategory;
	/** Name of the checker that produced the result. If empty, the editor fills it with the checker `id`. */
	readonly source?: string;
	/** Rule description address. */
	readonly url?: string;
}

export interface TextCheckerLimits {
	/** Upper limit of characters (UTF-16) to send at once. If exceeded, it is split into several sends. A paragraph longer than this is sent on its own. */
	readonly maxChars?: number;
	/** Upper limit of paragraphs to send at once. */
	readonly maxSegments?: number;
}

export interface TextCheckContext {
	/** Cancels on a re-check or when the edit screen closes. Passed to `fetch` as is. */
	readonly signal: AbortSignal;
}

export interface TextChecker {
	readonly id: string;
	/** Toolbar button name and the source in the result window. Example: "Spell checker". */
	readonly label: string;
	/**
	 * Toolbar button icon. A lucide component or an icon name (including names registered in the admin extension `icons`). If absent, the spelling icon.
	 * One button is created per checker.
	 */
	readonly icon?: string | import("react").ComponentType<{ className?: string }>;
	/** Languages it can check. If absent, all languages. `ko` also matches `ko-KR`. */
	readonly locales?: readonly string[];
	/** When editing stops, only changed paragraphs are checked automatically. Off by default (considering paid or rate-limited APIs, checking is by button only). */
	readonly auto: boolean;
	readonly limits?: TextCheckerLimits;
	readonly check: (segments: readonly TextCheckSegment[], context: TextCheckContext) => Promise<readonly TextIssue[]>;
}

export interface TextCheckerOptions extends Omit<TextChecker, "auto"> {
	readonly auto?: boolean;
}

/** Creates a checker. Runs in the browser. A checker that needs an API key goes through the site server route with `remoteTextChecker`. */
export function defineTextChecker(options: TextCheckerOptions): TextChecker {
	if (!/^[a-z0-9][a-z0-9_-]*$/i.test(options.id)) throw new Error(`text checker: invalid id "${options.id}"`);
	for (const [key, value] of Object.entries(options.limits ?? {})) {
		if (value !== undefined && (!Number.isInteger(value) || value <= 0))
			throw new Error(`text checker "${options.id}": limits.${key} must be a positive integer`);
	}
	return Object.freeze({ ...options, auto: options.auto ?? false });
}

/** First part of a language code (`ko-KR` → `ko`). */
const baseLanguage = (locale: string) => locale.toLowerCase().split(/[-_]/)[0] ?? "";

/** Whether the text's language can be checked. */
export function supportsLocale(checker: TextChecker, locale: string): boolean {
	if (!checker.locales || checker.locales.length === 0) return true;
	const target = locale.toLowerCase();
	return checker.locales.some((code) => code.toLowerCase() === target || baseLanguage(code) === baseLanguage(locale));
}
