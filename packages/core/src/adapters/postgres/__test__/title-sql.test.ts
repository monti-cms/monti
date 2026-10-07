import { describe, expect, it } from "vitest";
import { defineCollection, defineConfig, fields } from "../../../index";
import { createSite } from "../../../site";
import { createDb } from "../db/kysely";
import { ROW_COLLECTION, titleExpr, titleSql, translatedTitleExpr, translatedTitleSql } from "../store/title-sql";

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

/** The Kysely form of an expression, as SQL: a query is compiled, never run (no connection is made), and its select is cut out. */
const compiled = (expression: ReturnType<typeof titleExpr>) => {
	const db = createDb({} as never, "s");
	const query = db.selectFrom("entry_bodies as b").select(expression.as("t")).compile();
	return { sql: /^select (.*) as "t" from /.exec(query.sql)?.[1] ?? query.sql, parameters: query.parameters };
};
/** Quotes, case and the number of a bind placeholder do not change what an expression says. */
const normalized = (text: string) => text.replaceAll('"', "").replace(/\$\d+/g, "$n").toLowerCase();

describe("the Kysely form of the title expression", () => {
	it("says the same as the SQL text for one collection", () => {
		const site = siteOf({ a: "headline" });
		const expression = compiled(titleExpr(site, "b.metadata", { collection: "a" }));
		expect(normalized(expression.sql)).toBe(normalized(titleSql(site, "b.metadata", { collection: "a" })));
		expect(expression.parameters).toEqual([]);
	});

	it("says the same across collections that name the title the same way, and across those that do not", () => {
		for (const keys of [
			{ a: "title", b: "title" },
			{ a: "headline", b: "name" },
		]) {
			const site = siteOf(keys);
			expect(normalized(compiled(titleExpr(site, "b.metadata", ROW_COLLECTION)).sql)).toBe(
				normalized(titleSql(site, "b.metadata", ROW_COLLECTION)),
			);
		}
	});

	it("writes a key as an escaped string literal, never as a parameter or as SQL", () => {
		const site = siteOf({ a: "it's'; DROP TABLE entries; --" });
		const expression = compiled(titleExpr(site, "w.metadata", { collection: "a" }));
		expect(expression.sql).toBe(`"w"."metadata"->>'it''s''; DROP TABLE entries; --'`);
		expect(expression.parameters).toEqual([]);
	});

	it("says the same as the SQL text for the name in a display language, which it binds", () => {
		const site = siteOf({ a: "name" });
		const expression = compiled(translatedTitleExpr(site, "b.metadata", "a", "en"));
		expect(normalized(expression.sql)).toBe(normalized(translatedTitleSql(site, "b.metadata", "a", "$3")));
		expect(expression.parameters).toEqual(["en"]);
	});
});
