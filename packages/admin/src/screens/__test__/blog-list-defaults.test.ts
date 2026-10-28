import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { columnsFor } from "../list-columns";

/**
 * The reference blog config has no list setting; the default columns are what its lists show until a writer chooses their own.
 * The slug rides beside the title, so item collections do not default to a slug column. Runs only with the reference blog example config (`packages/core/test/cms.config.ts`).
 */
describe("reference blog list default columns", () => {
	it.each([
		["post", ["title", "categoryId", "tagIds", "locale", "status", "updatedAt"]],
		["memo", ["title", "tagIds", "locale", "status", "updatedAt"]],
		["category", ["title", "locale", "status", "updatedAt"]],
		["tag", ["title", "locale", "status", "updatedAt"]],
		["collection", ["title", "locale", "status", "updatedAt"]],
	])("%s shows these default columns", (collection, columns) => {
		expect(columnsFor(testSite, collection).defaults).toEqual(columns);
	});
});
