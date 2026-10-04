import { COLLECTION_DEFINITIONS, schemaOf } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { AI_ACTIONS } from "../../../ai/src/registry";
import { seoOf } from "..";

/** Example blog config (`seoFields({ keys })`): stored field names and value shapes are the same as before the SEO extension. */
describe("blog SEO fields", () => {
	it("field names and storage format are the same as before (only the share image is a media field)", () => {
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

	it("search title and description suggestions have the same names, lengths and collections as before", () => {
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

	it("the public page helper reads the blog fields by role", () => {
		expect(
			seoOf(schemaOf("post"), { title: "글", summary: "요약", seoRobots: "noindex", canonicalUrl: "/posts/a" }),
		).toEqual({ title: "글", description: "요약", canonical: "/posts/a", noindex: true });
	});
});
