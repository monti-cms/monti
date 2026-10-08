/** Reading speed used for the estimate: words per minute. */
export const WORDS_PER_MINUTE = 200;

/**
 * Whole minutes to read a text, never less than one. `Intl.Segmenter` finds the words of any language (Korean and Japanese have no spaces to count),
 * so the same function serves every locale of the site.
 */
export function readingMinutes(text: string, locale = "en"): number {
	let words = 0;
	for (const part of new Intl.Segmenter(locale, { granularity: "word" }).segment(text)) if (part.isWordLike) words += 1;
	return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
