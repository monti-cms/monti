import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection } from "../../../test/any-site";
import { testSite } from "../../../test/site";

/**
 * Collection helper rules that do not depend on the config. Collection and field names are looked up in the current config (`test/any-site.ts`).
 * `collections.blog.test.ts` checks the collection list of the reference blog config as is.
 */
describe("collection helpers", () => {

	it("LIST-F2 classification fields are relation fields pointing to a classification (record) collection", () => {
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
