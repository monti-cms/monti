import { describe, expect, it } from "vitest";
import config from "../../../test/cms.config";
import { createSite } from "../../site";

const site = createSite(config);

/**
 * Checks the collection list of the reference blog config (`test/cms.config.ts`) as is (does not run with other site configs).
 * Posts (one category, many tags), memos (tags), and classification tags, categories and compilations. Rules independent of the config are in `collections.test.ts`.
 */
describe("collection helpers (reference blog config)", () => {
	it("the default collection is the first declared document collection", () => {
		expect(site.DEFAULT_COLLECTION).toBe("post");
		expect(site.isDocumentCollection("memo")).toBe(true);
		expect(site.isDocumentCollection("tag")).toBe(false);
		expect(site.isDocumentCollection("nope")).toBe(false);
	});

	it("classification fields are relation fields pointing to a classification (record) collection", () => {
		expect(site.taxonomyFieldsOf("post").map((stored) => [stored.name, stored.to])).toEqual([
			["categoryId", "category"],
			["tagIds", "tag"],
		]);
		expect(site.taxonomyFieldsOf("memo").map((stored) => stored.name)).toEqual(["tagIds"]);
		// A compilation's post list points to a document collection, so it is not a classification field.
		expect(site.taxonomyFieldsOf("collection")).toEqual([]);
		expect(site.taxonomyFieldsOf("nope")).toEqual([]);
	});
});
