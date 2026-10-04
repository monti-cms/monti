import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECTION, isDocumentCollection, taxonomyFieldsOf } from "../collections";

/**
 * Checks the collection list of the reference blog config (`test/cms.config.ts`) as is (does not run with other site configs).
 * Posts (one category, many tags), memos (tags), and classification tags, categories and compilations. Rules independent of the config are in `collections.test.ts`.
 */
describe("collection helpers (reference blog config)", () => {
	it("the default collection is the first declared document collection", () => {
		expect(DEFAULT_COLLECTION).toBe("post");
		expect(isDocumentCollection("memo")).toBe(true);
		expect(isDocumentCollection("tag")).toBe(false);
		expect(isDocumentCollection("nope")).toBe(false);
	});

	it("classification fields are relation fields pointing to a classification (record) collection", () => {
		expect(taxonomyFieldsOf("post").map((stored) => [stored.name, stored.to])).toEqual([
			["categoryId", "category"],
			["tagIds", "tag"],
		]);
		expect(taxonomyFieldsOf("memo").map((stored) => stored.name)).toEqual(["tagIds"]);
		// A compilation's post list points to a document collection, so it is not a classification field.
		expect(taxonomyFieldsOf("collection")).toEqual([]);
		expect(taxonomyFieldsOf("nope")).toEqual([]);
	});
});
