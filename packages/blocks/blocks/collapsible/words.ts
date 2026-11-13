/** The block's words (doc 18): its names in each admin language, and the words it shows readers in en / ko / ja. The site's own: change them here. */

export const words = {
	collapsible: { ko: "접기", en: "Collapsible" },
};

/** The title of a collapsible with none, in the entry's language (English when the site gives none). The site's own words: change them. */
const WORDS: Record<string, string> = { en: "Show more", ko: "펼치기", ja: "開く" };
export const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;
