/** The plugin's words in the admin's two languages: the names of its fields, and what its inputs and preview say. */
export const seoWords = {
	en: {
		tab: "SEO",
		title: "SEO title",
		description: "SEO description",
		image: "Share image",
		noindex: "Hide from search",
		hidden: "Hidden",
		canonical: "Canonical address",
		entryTitle: "Title",
		sameAs: (name: string) => `Same as ${name}`,
		searchPreview: "Search result",
		sharePreview: "Share card",
		noTitle: "No title",
		noDescription: "No description",
		hiddenFromSearch: "Hidden from search",
	},
	ko: {
		tab: "SEO",
		title: "SEO 제목",
		description: "SEO 설명",
		image: "공유 이미지",
		noindex: "검색에서 숨기기",
		hidden: "숨김",
		canonical: "대표 주소",
		entryTitle: "제목",
		// "과" after a closed syllable, "와" after an open one.
		sameAs: (name: string) => `${name}${endsClosed(name) ? "과" : "와"} 같음`,
		searchPreview: "검색 결과",
		sharePreview: "공유 카드",
		noTitle: "제목 없음",
		noDescription: "설명 없음",
		hiddenFromSearch: "검색에서 숨김",
	},
};

export type SeoLanguage = keyof typeof seoWords;

/** Whether a word's last Hangul syllable ends in a consonant. A word that ends in anything else reads as closed. */
function endsClosed(word: string): boolean {
	const last = word.trim().at(-1)?.charCodeAt(0);
	if (last === undefined || last < 0xac00 || last > 0xd7a3) return true;
	return (last - 0xac00) % 28 !== 0;
}
