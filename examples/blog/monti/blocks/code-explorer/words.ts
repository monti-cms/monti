/** The block's words (doc 18): its names in each admin language, and the words it shows readers in en / ko / ja. The site's own: change them here. */

export const words = {
	codeExplorer: { ko: "코드 탐색기", en: "Code explorer" },
};

/** The explorer's own words, in the entry's language (English when the site gives none). The site's own: change them. */
const WORDS: Record<string, { files: string; toggle: string }> = {
	en: { files: "Files", toggle: "Show or hide the file list" },
	ko: { files: "파일", toggle: "파일 목록 열기 또는 닫기" },
	ja: { files: "ファイル", toggle: "ファイル一覧を開閉" },
};
export const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;
