import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection, recordRelationField } from "../../../test/any-site";
import { storedFields } from "../../schema/derive";
import {
	COLLECTIONS,
	DEFAULT_COLLECTION,
	DOCUMENT_COLLECTIONS,
	isDocumentCollection,
	isItemCollection,
	taxonomyFieldsOf,
} from "../collections";

/**
 * Collection helper rules that do not depend on the config. Collection and field names are looked up in the current config (`test/any-site.ts`).
 * `collections.blog.test.ts` checks the collection list of the reference blog config as is.
 */
describe("collection helpers", () => {
	it("the default collection is the first declared document collection", () => {
		expect(DEFAULT_COLLECTION).toBe(COLLECTIONS.find((name) => !isItemCollection(name)));
		expect(DOCUMENT_COLLECTIONS[0]).toBe(DEFAULT_COLLECTION);
		expect(isDocumentCollection(contentCollection)).toBe(true);
		expect(isDocumentCollection(recordCollection)).toBe(false);
		expect(isDocumentCollection("nope")).toBe(false);
	});

	it("classification fields are relation fields pointing to a classification (record) collection", () => {
		const first = recordRelationField(contentCollection);
		if (first) expect(taxonomyFieldsOf(contentCollection)[0]).toMatchObject({ name: first.name, to: first.to });

		for (const collection of COLLECTIONS) {
			const relations = storedFields(collection).flatMap((stored) =>
				stored.field.kind === "relation" ? [{ name: stored.name, to: stored.field.to }] : [],
			);
			// Only relations pointing to item collections remain, in declaration order; relations pointing to document collections (post lists, etc.) are excluded.
			expect(taxonomyFieldsOf(collection).map((stored) => [stored.name, stored.to])).toEqual(
				relations.filter(({ to }) => isItemCollection(to)).map(({ name, to }) => [name, to]),
			);
		}
		expect(taxonomyFieldsOf("nope")).toEqual([]);
	});
});
