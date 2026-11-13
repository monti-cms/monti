/** The block's words (doc 18): its names in each admin language, and the words it shows readers in en / ko / ja. The site's own: change them here. */

export const words = {
	tools: { ko: "코드 탐색기 도구", en: "Code explorer tools" },
	first: { ko: "처음 보일 파일", en: "File shown first" },
	firstFile: { ko: "첫 파일", en: "The first file" },
	addFile: { ko: "파일", en: "File" },
	addFolder: { ko: "폴더", en: "Folder" },
	remove: { ko: "{name} 지우기", en: "Delete {name}" },
	path: { ko: "파일 경로", en: "File path" },
	newFile: { ko: "src/new-file.ts", en: "src/new-file.ts" },
	newFolder: { ko: "src/new-folder/", en: "src/new-folder/" },
	codeExplorer: { ko: "코드 탐색기", en: "Code explorer" },
};

/** The explorer's own words, in the entry's language (English when the site gives none). The site's own: change them. */
const WORDS: Record<string, { files: string; toggle: string }> = {
	en: { files: "Files", toggle: "Show or hide the file list" },
	ko: { files: "파일", toggle: "파일 목록 열기 또는 닫기" },
	ja: { files: "ファイル", toggle: "ファイル一覧を開閉" },
};
export const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;
