/** The block's words (doc 18): its names in each admin language, and the words it shows readers in en / ko / ja. The site's own: change them here. */
import type { Tone } from "./site";

export const words = {
	tools: { ko: "콜아웃 도구", en: "Callout tools" },
	kind: { ko: "종류", en: "Kind" },
	title: { ko: "제목", en: "Title" },
	tones: {
		note: { ko: "노트", en: "Note" },
		tip: { ko: "팁", en: "Tip" },
		info: { ko: "정보", en: "Info" },
		warning: { ko: "경고", en: "Warning" },
		danger: { ko: "위험", en: "Danger" },
	},
	callout: { ko: "콜아웃", en: "Callout" },
};

/** A callout with no title is titled by its kind, in the entry's language (English when the site gives none). The site's own words: change them. */
const WORDS: Record<string, Record<Tone, string>> = {
	en: { note: "Note", tip: "Tip", info: "Info", warning: "Warning", danger: "Danger" },
	ko: { note: "노트", tip: "팁", info: "정보", warning: "경고", danger: "위험" },
	ja: { note: "ノート", tip: "ヒント", info: "情報", warning: "警告", danger: "危険" },
};
export const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;
