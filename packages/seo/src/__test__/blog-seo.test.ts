import { COLLECTION_DEFINITIONS, schemaOf } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { AI_ACTIONS } from "../../../ai/src/registry";
import { seoOf } from "..";

/** 블로그 예시 설정(`seoFields({ keys })`): 저장된 필드 이름·값 모양이 SEO 확장 전과 같다. */
describe("블로그 SEO 필드", () => {
	it("필드 이름과 저장 형식이 예전과 같다(공유 이미지만 미디어 필드)", () => {
		for (const collection of ["post", "memo"] as const) {
			expect(COLLECTION_DEFINITIONS[collection].fields).toMatchObject({
				seoTitle: "string",
				seoDescription: "string",
				canonicalUrl: "string",
				ogImageId: "string",
				seoRobots: "string",
			});
			const fields = schemaOf(collection).fields;
			expect(fields.searchPreview).toMatchObject({ kind: "view", view: "search", tab: "SEO" });
			expect(fields.ogImageId).toMatchObject({ kind: "media", label: "공유 이미지", localized: true });
			expect(fields.seoRobots).toMatchObject({ options: { index: "노출", noindex: "숨기기" }, defaultValue: "index" });
			expect(fields.canonicalUrl).toMatchObject({ label: "원본 주소", placeholder: "https://", localized: true });
		}
	});

	it("검색 제목·설명 추천은 예전과 같은 이름·길이·컬렉션이다", () => {
		expect(AI_ACTIONS.seoTitle).toMatchObject({
			label: "검색 제목 추천",
			checks: [{ kind: "maxLength", max: 60 }],
			attach: [{ slot: "field", field: "seoTitle", collections: ["post", "memo"] }],
		});
		expect(AI_ACTIONS.seoDescription).toMatchObject({
			label: "검색 설명 추천",
			checks: [{ kind: "maxLength", max: 155 }],
			attach: [{ slot: "field", field: "seoDescription", collections: ["post", "memo"] }],
		});
	});

	it("공개 화면 도우미가 블로그 필드를 역할로 읽는다", () => {
		expect(
			seoOf(schemaOf("post"), { title: "글", summary: "요약", seoRobots: "noindex", canonicalUrl: "/posts/a" }),
		).toEqual({ title: "글", description: "요약", canonical: "/posts/a", noindex: true });
	});
});
