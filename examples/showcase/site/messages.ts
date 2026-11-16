// The words the site draws of its own, in each of its languages: change them here. A language the site has no words for reads the source
// language's (Korean). A value of a choice field (a topic, a season, a role) is said by `options`; one with no word here is shown as it is stored.

const ko = {
	site: { name: "Monti showcase", nav: "사이트" },
	sections: { articles: "글", tags: "태그", people: "사람", series: "연재" },
	more: "스무 편이 넘습니다. 나머지는 리더가 나눠 읽습니다.",
	contents: "목차",
	pinned: "고정",
	preview: "미리보기",
	untitled: "제목 없음",
	related: "관련 글",
	notFound: "페이지를 찾을 수 없습니다",
	bar: { back: "글로 돌아가기", preview: "미리보기", exit: "끝내기" },
	fields: {
		series: "연재",
		authors: "글쓴이",
		tags: "태그",
		attachment: "첨부 파일",
		format: "형식",
		video: "영상",
		layout: "배치",
		poster: "대표 사진",
		link: "링크",
	},
	options: {
		guide: "안내",
		news: "소식",
		opinion: "생각",
		spring: "봄",
		summer: "여름",
		autumn: "가을",
		winter: "겨울",
		text: "글",
		video: "영상",
		gallery: "사진첩",
		link: "링크",
		grid: "격자",
		carousel: "넘겨 보기",
		writer: "글쓴이",
		photographer: "사진가",
		editor: "편집자",
	} as Record<string, string>,
};

type Words = typeof ko;

const en: Words = {
	site: { name: "Monti showcase", nav: "Site" },
	sections: { articles: "Articles", tags: "Tags", people: "People", series: "Series" },
	more: "More than twenty: the reader pages them.",
	contents: "Contents",
	pinned: "Pinned",
	preview: "Preview",
	untitled: "Untitled",
	related: "Related",
	notFound: "Page not found",
	bar: { back: "Back to the article", preview: "Preview", exit: "Exit" },
	fields: {
		series: "Series",
		authors: "Authors",
		tags: "Tags",
		attachment: "Attachment",
		format: "Format",
		video: "Video",
		layout: "Layout",
		poster: "Poster",
		link: "Link",
	},
	options: {
		guide: "Guide",
		news: "News",
		opinion: "Opinion",
		spring: "Spring",
		summer: "Summer",
		autumn: "Autumn",
		winter: "Winter",
		text: "Text",
		video: "Video",
		gallery: "Gallery",
		link: "Link",
		grid: "Grid",
		carousel: "Carousel",
		writer: "Writer",
		photographer: "Photographer",
		editor: "Editor",
	},
};

const ja: Words = {
	site: { name: "Monti showcase", nav: "サイト" },
	sections: { articles: "記事", tags: "タグ", people: "人", series: "連載" },
	more: "20本を超えています。残りはリーダーが分けて読みます。",
	contents: "目次",
	pinned: "固定",
	preview: "プレビュー",
	untitled: "無題",
	related: "関連記事",
	notFound: "ページが見つかりません",
	bar: { back: "記事に戻る", preview: "プレビュー", exit: "終了" },
	fields: {
		series: "連載",
		authors: "執筆者",
		tags: "タグ",
		attachment: "添付ファイル",
		format: "形式",
		video: "動画",
		layout: "配置",
		poster: "代表写真",
		link: "リンク",
	},
	options: {
		guide: "ガイド",
		news: "ニュース",
		opinion: "意見",
		spring: "春",
		summer: "夏",
		autumn: "秋",
		winter: "冬",
		text: "文章",
		video: "動画",
		gallery: "ギャラリー",
		link: "リンク",
		grid: "グリッド",
		carousel: "カルーセル",
		writer: "執筆者",
		photographer: "写真家",
		editor: "編集者",
	},
};

const dictionaries: Record<string, Words> = { ko, en, ja };

/** The site's words in a language (`en`, `en-US`). */
export const wordsIn = (locale: string): Words => dictionaries[locale.toLowerCase().split(/[-_]/)[0] ?? ""] ?? ko;

/** What a stored choice is called: its word, or the value itself when there is none. */
export const optionName = (locale: string, value: string): string => wordsIn(locale).options[value] ?? value;
