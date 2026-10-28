import { defineMessages, type MessageValue } from "@monti-cms/core";

/** Instructions for the model: the same in every language, and the result language follows the body. */
const modelText = {
	"ai.title.prompt": ({ limit }) =>
		[
			"Write 3 title candidates to show in search results.",
			`- At most ${limit} characters, in the same language as the body`,
			"- Put the question the content answers or its key keywords near the front",
			"- Do not use exaggerated or clickbait wording",
		].join("\n"),
	"ai.description.prompt": ({ limit }) =>
		[
			"Write the description to show under the title in search results.",
			`- At most ${limit} characters, 1 to 2 sentences, in the same language as the body`,
			"- Make clear what a searcher gets from this content",
		].join("\n"),
} satisfies Record<string, MessageValue>;

/**
 * Field labels, search preview and AI feature messages of the SEO extension. AI instructions are text given to the model, so they are the same English text in every language, and the
 * result language follows the body.
 */
export const seoMessages = defineMessages("cms-seo", {
	en: {
		"field.title": "SEO title",
		"field.description": "SEO description",
		"field.image": "Share image",
		"field.noindex": "Hide from search",
		"field.canonical": "Original URL",
		"option.index": "No",
		"option.noindex": "Yes",
		"same.title": "Same as the title",
		"same.description": "Same as the summary",
		"same.image": "Same as the default image",
		"ai.title.label": "Suggest search title",
		"ai.description.label": "Suggest search description",
		"ai.input.title": "Title",
		"ai.input.summary": "Summary",
		"ai.input.body": "Body",
		"ai.input.current": "Current value",
		...modelText,
	},
	ko: {
		"field.title": "SEO 제목",
		"field.description": "SEO 설명",
		"field.image": "공유 이미지",
		"field.noindex": "검색에서 숨기기",
		"field.canonical": "원본 주소",
		"option.index": "아니요",
		"option.noindex": "예",
		"same.title": "제목과 같음",
		"same.description": "요약과 같음",
		"same.image": "기본 이미지와 같음",
		"ai.title.label": "검색 제목 추천",
		"ai.description.label": "검색 설명 추천",
		"ai.input.title": "제목",
		"ai.input.summary": "요약",
		"ai.input.body": "본문",
		"ai.input.current": "현재 값",
		...modelText,
	},
});
