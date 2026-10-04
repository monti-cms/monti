import { defineMessages } from "@monti-cms/core";

/**
 * Field labels, search preview and AI feature messages of the SEO extension. AI instructions are text given to the model, so there is only an English one, and the result language
 * follows the body.
 */
export const seoMessages = defineMessages("cms-seo", {
	en: {
		"field.title": "Search title",
		"field.description": "Search description",
		"field.image": "Share image",
		"field.noindex": "Hide from search engines",
		"field.canonical": "Original URL",
		"option.index": "Show",
		"option.noindex": "Hide",
		"preview.search": "Search result preview",
		"preview.share": "Share preview",
		"preview.noTitle": "Untitled",
		"preview.noDescription": "No description",
		"preview.hidden": "Hidden from search engines",
		"ai.title.label": "Suggest search title",
		"ai.description.label": "Suggest search description",
		"ai.input.title": "Title",
		"ai.input.summary": "Summary",
		"ai.input.body": "Body",
		"ai.input.current": "Current value",
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
	},
	ko: {
		"field.title": "검색 제목",
		"field.description": "검색 설명",
		"field.image": "공유 이미지",
		"field.noindex": "검색엔진에 숨기기",
		"field.canonical": "원본 주소",
		"option.index": "노출",
		"option.noindex": "숨기기",
		"preview.search": "검색 결과 미리보기",
		"preview.share": "공유 미리보기",
		"preview.noTitle": "제목 없음",
		"preview.noDescription": "설명 없음",
		"preview.hidden": "검색엔진에 숨김",
		"ai.title.label": "검색 제목 추천",
		"ai.description.label": "검색 설명 추천",
		"ai.input.title": "제목",
		"ai.input.summary": "요약",
		"ai.input.body": "본문",
		"ai.input.current": "현재 값",
	},
});
