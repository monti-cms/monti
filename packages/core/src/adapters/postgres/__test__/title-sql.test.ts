import { describe, expect, it } from "vitest";
import { defineCollection, defineConfig, fields } from "../../../index";
import { createSite } from "../../../site";
import { createDb } from "../db/kysely";
import { ROW_COLLECTION, titleExpr, translatedTitleExpr } from "../store/title-sql";

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

/** An expression as SQL: a query is compiled, never run (no connection is made), and its select is cut out. */
const compiled = (expression: ReturnType<typeof titleExpr>) => {
	const db = createDb({} as never, "s");
	const query = db.selectFrom("entry_bodies as b").select(expression.as("t")).compile();
	return { sql: /^select (.*) as "t" from /.exec(query.sql)?.[1] ?? query.sql, parameters: query.parameters };
};

describe("the SQL that reads a title", () => {
	it("reads the title field of the collection, found by role", () => {
		const expression = compiled(titleExpr(siteOf({ a: "headline" }), "w.metadata", { collection: "a" }));
		expect(expression.sql).toBe(`"w"."metadata"->>'headline'`);
		expect(expression.parameters).toEqual([]);
	});

	it("is one plain read across collections that name the title the same way", () => {
		const site = siteOf({ a: "title", b: "title" });
		expect(compiled(titleExpr(site, "b.metadata", ROW_COLLECTION)).sql).toBe(`"b"."metadata"->>'title'`);
	});

	it("tells the collections apart when they name the title differently", () => {
		const site = siteOf({ a: "headline", b: "name" });
		expect(compiled(titleExpr(site, "b.metadata", ROW_COLLECTION)).sql).toBe(
			`case "e"."collection" when 'a' then "b"."metadata"->>'headline' when 'b' then "b"."metadata"->>'name' end`,
		);
	});

	it("writes a key as an escaped string literal, never as a parameter or as SQL", () => {
		const site = siteOf({ a: "it's'; DROP TABLE entries; --" });
		const expression = compiled(titleExpr(site, "w.metadata", { collection: "a" }));
		expect(expression.sql).toBe(`"w"."metadata"->>'it''s''; DROP TABLE entries; --'`);
		expect(expression.parameters).toEqual([]);
	});

	it("reads the name of a display language of a record collection, falling back to the title, and binds the language", () => {
		const expression = compiled(translatedTitleExpr(siteOf({ a: "name" }), "b.metadata", "a", "en"));
		expect(expression.sql).toBe(
			`coalesce(nullif(btrim("b"."metadata"->'translations'->$1::text->>'name'), ''), "b"."metadata"->>'name')`,
		);
		expect(expression.parameters).toEqual(["en"]);
	});
});
