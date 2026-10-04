import { defineConfig } from "@monti-cms/core";
import { category, memo, post, series, tag } from "../../../core/test/cms.config";
import { blocks } from "../index";

/**
 * 공개 화면 그리기 테스트가 쓰는 설정. 본체 예시 설정과 같은 컬렉션에 블록을 정의가 아니라 플러그인(`blocks()`)으로 넣어,
 * `@monti-cms/core/render`가 각 플러그인의 공개 컴포넌트(`render`)를 불러오게 한다.
 */
export default defineConfig({
	collections: { post, memo, category, tag, collection: series },
	locales: [
		{ code: "ko", name: "한국어", label: "한국어" },
		{ code: "en", name: "English", label: "영어" },
	],
	defaultLocale: "ko",
	site: { url: "https://example.com", name: "example" },
	timeZone: "Asia/Seoul",
	plugins: [...blocks()],
});
