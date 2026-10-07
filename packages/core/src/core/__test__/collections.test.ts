import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection, recordRelationField } from "../../../test/any-site";
import { testSite } from "../../../test/site";

/**
 * Collection helper rules that do not depend on the config. Collection and field names are looked up in the current config (`test/any-site.ts`).
 * `collections.blog.test.ts` checks the collection list of the reference blog config as is.
 */
describe("collection helpers", () => {
	it("the default collection is the first declared document collection", () => {
		expect(testSite.DEFAULT_COLLECTION).toBe(testSite.COLLECTIONS.find((name) => !testSite.isItemCollection(name)));
		expect(testSite.DOCUMENT_COLLECTIONS[0]).toBe(testSite.DEFAULT_COLLECTION);
		expect(testSite.isDocumentCollection(contentCollection)).toBe(true);
		expect(testSite.isDocumentCollection(recordCollection)).toBe(false);
		expect(testSite.isDocumentCollection("nope")).toBe(false);
	});

	it("classification fields are relation fields pointing to a classification (record) collection", () => {
		const first = recordRelationField(contentCollection);
		if (first)
			expect(testSite.taxonomyFieldsOf(contentCollection)[0]).toMatchObject({ name: first.name, to: first.to });

		for (const collection of testSite.COLLECTIONS) {
			const relations = testSite
				.storedFields(collection)
				.flatMap((stored) => (stored.field.kind === "relation" ? [{ name: stored.name, to: stored.field.to }] : []));
			// Only relations pointing to item collections remain, in declaration order; relations pointing to document collections (post lists, etc.) are excluded.
			expect(testSite.taxonomyFieldsOf(collection).map((stored) => [stored.name, stored.to])).toEqual(
				relations.filter(({ to }) => testSite.isItemCollection(to)).map(({ name, to }) => [name, to]),
			);
		}
		expect(testSite.taxonomyFieldsOf("nope")).toEqual([]);
	});
});
