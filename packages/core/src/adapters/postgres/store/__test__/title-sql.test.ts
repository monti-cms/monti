import { describe, expect, it } from "vitest";
import { defineCollection, defineSite, fields } from "../../../../index";
import { createSite } from "../../../../site";
import { createDb } from "../../db/kysely";
import { ROW_COLLECTION, titleExpr } from "../title-sql";

const collection = (titleKey: string) =>
	defineCollection({
		label: "Collection",
		kind: "item",
		fields: { [titleKey]: fields.text({ label: "Title", role: "title" }) },
	});
const configOf = (keys: Record<string, string>) => ({
	collections: Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, collection(key)])),
	locales: [{ code: "en", name: "English" }],
	defaultLocale: "en" as const,
});
const siteOf = (keys: Record<string, string>) => createSite(defineSite(configOf(keys)));

/** An expression as SQL: a query is compiled, never run (no connection is made), and its select is cut out. */
const compiled = (expression: ReturnType<typeof titleExpr>) => {
	const db = createDb({} as never, "s");
	const query = db.selectFrom("entry_bodies as b").select(expression.as("t")).compile();
	return { sql: /^select (.*) as "t" from /.exec(query.sql)?.[1] ?? query.sql, parameters: query.parameters };
};

describe("the SQL that reads a title", () => {
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
});
