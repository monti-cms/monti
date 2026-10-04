/** Splits the slash menu search terms, written comma-separated in the dictionary, into a word list. */
export const keywordList = (text: string): string[] =>
	text
		.split(",")
		.map((word) => word.trim())
		.filter(Boolean);
