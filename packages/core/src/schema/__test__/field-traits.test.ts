import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { DEFAULT_TITLE_FIELD, fieldTraits, isStoredField, SUMMARY_ROLE, TITLE_ROLE } from "../fields";
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
			const stored = valueFieldsOf(schema);
			expect(testSite.roleField(collection, SUMMARY_ROLE)).toEqual(
				stored.find((item) => item.field.role === SUMMARY_ROLE),
			);
			const title =
				stored.find((item) => item.field.role === TITLE_ROLE) ??
				stored.find((item) => item.name === DEFAULT_TITLE_FIELD);
			expect(title, collection).toMatchObject({ field: { kind: "text" } });
			expect(testSite.titleField(collection)).toEqual(title);
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
