import { createSite } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { aiRegistryOf } from "../../../ai/src/registry";
import blog from "../../test/cms.config";
import { seoOf } from "..";

const site = createSite(blog);
const AI_ACTIONS = aiRegistryOf(site).actions;

/** Example blog config (`seoFields({ keys })`): stored field names and value shapes are the same as before the SEO extension. */
describe("blog SEO fields", () => {
	it("field names and storage format are the same as before (only the share image is a media field)", () => {
		for (const collection of ["post", "memo"] as const) {
			expect(site.COLLECTION_DEFINITIONS[collection].fields).toMatchObject({
				seoTitle: "string",
				seoDescription: "string",
				canonicalUrl: "string",
				ogImageId: "string",
				seoRobots: "string",
			});
			const fields = site.schemaOf(collection).fields;
			expect(fields.searchPreview).toMatchObject({ kind: "view", view: "search" });
			expect(fields.ogImageId).toMatchObject({ kind: "media", localized: true });
			expect(fields.seoRobots).toMatchObject({ defaultValue: "index" });
			expect(fields.canonicalUrl).toMatchObject({ localized: true });
		}
	});

	it("search title and description suggestions attach to the same fields and collections as before", () => {
		expect(AI_ACTIONS.seoTitle).toMatchObject({
			attach: [{ slot: "field", field: "seoTitle", collections: ["post", "memo"] }],
		});
		expect(AI_ACTIONS.seoDescription).toMatchObject({
			attach: [{ slot: "field", field: "seoDescription", collections: ["post", "memo"] }],
		});
	});

	it("the public page helper reads the blog fields by role", () => {
		expect(
			seoOf(site.schemaOf("post"), { title: "글", summary: "요약", seoRobots: "noindex", canonicalUrl: "/posts/a" }),
		).toEqual({ title: "글", description: "요약", canonical: "/posts/a", noindex: true });
	});
});
