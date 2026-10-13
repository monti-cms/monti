import { describe, expect, it } from "vitest";
import { fieldSetsOf, freshSetFields, hasFieldSet } from "../field-sets";

const seo = {
	id: "seo",
	label: "SEO",
	roles: ["seoTitle", "ogImage"],
	fields: { seoTitle: { kind: "text", role: "seoTitle" }, seoImage: { kind: "media", role: "ogImage" } },
};

describe("field sets of plugins", () => {
	it("reads the sets from the plugins' contributions and skips malformed ones", () => {
		const sets = fieldSetsOf([
			{ name: "seo", contributes: { fieldSets: [seo, { id: 1 }, "x"] } },
			{ name: "other", contributes: { layout: [] } },
			{ name: "none" },
		]);
		expect(sets).toHaveLength(1);
		expect(sets[0]).toMatchObject({ id: "seo", plugin: "seo" });
	});

	it("knows a collection has the set when a field carries one of its roles", () => {
		expect(hasFieldSet(seo, { title: { kind: "text" } })).toBe(false);
		expect(hasFieldSet(seo, { metaTitle: { kind: "text", role: "seoTitle" } })).toBe(true);
	});

	it("gives the added fields names the collection does not use yet", () => {
		const added = freshSetFields(seo, { seoTitle: { kind: "text" }, seoTitle2: { kind: "text" } });
		expect(Object.keys(added)).toEqual(["seoTitle3", "seoImage"]);
		expect(added.seoTitle3).toEqual(seo.fields.seoTitle);
		expect(added.seoTitle3).not.toBe(seo.fields.seoTitle);
	});
});
