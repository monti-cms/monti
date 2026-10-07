import { describe, expect, it } from "vitest";
import { defineCollection, defineConfig, fields } from "../../../index";
import { createSite } from "../../../site";
import { ROW_COLLECTION, titleSql, translatedTitleSql } from "../store/title-sql";

const collection = (titleKey: string) =>
	defineCollection({
		label: "Collection",
		kind: "item",
		fields: { [titleKey]: fields.text({ label: "Title", role: "title" }) },
	});
const siteOf = (keys: Record<string, string>) =>
	createSite(
		defineConfig({
			collections: Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, collection(key)])),
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}),
	);

describe("the SQL that reads a title", () => {
	it("reads the title field of the collection, found by role", () => {
		expect(titleSql(siteOf({ a: "headline" }), "w.metadata", { collection: "a" })).toBe("w.metadata->>'headline'");
	});

	it("is one plain read across collections that name the title the same way", () => {
		const site = siteOf({ a: "title", b: "title" });
		expect(titleSql(site, "b.metadata", ROW_COLLECTION)).toBe("b.metadata->>'title'");
	});

	it("tells the collections apart when they name the title differently", () => {
		const site = siteOf({ a: "headline", b: "name" });
		expect(titleSql(site, "b.metadata", ROW_COLLECTION)).toBe(
			"CASE e.collection WHEN 'a' THEN b.metadata->>'headline' WHEN 'b' THEN b.metadata->>'name' END",
		);
	});

	it("writes a key as an escaped string literal, never as SQL", () => {
		const site = siteOf({ a: "it's'; DROP TABLE entries; --" });
		expect(titleSql(site, "w.metadata", { collection: "a" })).toBe("w.metadata->>'it''s''; DROP TABLE entries; --'");
	});

	it("reads the name of a display language of a record collection, falling back to the title", () => {
		expect(translatedTitleSql(siteOf({ a: "name" }), "b.metadata", "a", "$3")).toBe(
			"COALESCE(NULLIF(btrim(b.metadata->'translations'->$3::text->>'name'), ''), b.metadata->>'name')",
		);
	});
});
