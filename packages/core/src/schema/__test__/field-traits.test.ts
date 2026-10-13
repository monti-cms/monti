import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { fieldTraits, isStoredField } from "../fields";
import { valueFieldsOf } from "../walk";

describe("field traits", () => {
	it("say which kinds hold a value the way the walk lists stored fields", () => {
		for (const collection of testSite.COLLECTIONS) {
			const schema = testSite.schemaOf(collection);
			const topLevelStored = Object.entries(schema.fields)
				.filter(([, field]) => isStoredField(field))
				.map(([name]) => name);
			const listed = valueFieldsOf(schema)
				.filter((stored) => stored.when === undefined)
				.map((stored) => stored.name);
			expect(listed).toEqual(topLevelStored);
		}
	});

	it("keep the address, the back link and the view out of what is stored and what is per language", () => {
		for (const kind of ["slug", "backlink", "view"] as const) {
			expect(fieldTraits[kind].stored, kind).toBe(false);
			expect(fieldTraits[kind].localizable, kind).toBe(false);
		}
		expect(fieldTraits.conditional.stored).toBe(true);
		expect(fieldTraits.backlink.entersValue).toBe(false);
		expect(fieldTraits.slug.entersValue).toBe(true);
	});

	it("find a role field and a title the same way for the pure helpers and for the site", () => {
		for (const collection of testSite.COLLECTIONS) {
			const schema = testSite.schemaOf(collection);
			expect(testSite.roleField(collection, "summary")).toEqual(
				valueFieldsOf(schema).find((stored) => stored.field.role === "summary"),
			);
			expect(testSite.titleField(collection).name).toBeTruthy();
			expect(testSite.localizedSet(collection)).toEqual(
				new Set(
					Object.entries(schema.fields)
						.filter(([, field]) => fieldTraits[field.kind].localizable && field.localized)
						.map(([name]) => name),
				),
			);
		}
	});
});
