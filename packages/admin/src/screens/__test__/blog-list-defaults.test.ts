import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { columnsFor } from "../list-columns";

/**
 * The reference blog config has no list setting; the default columns are what its lists show until a writer chooses their own.
 * Runs only with the reference blog example config (`packages/core/test/cms.config.ts`).
 */
describe("reference blog list default columns", () => {
	it.each([
		["post", ["title", "status", "locale", "categoryId", "tagIds", "updatedAt", "publishedAt"]],
		["memo", ["title", "status", "locale", "tagIds", "updatedAt", "publishedAt"]],
		["category", ["title", "slug", "locale", "status", "updatedAt"]],
		["tag", ["title", "slug", "locale", "status", "updatedAt"]],
		["collection", ["title", "slug", "locale", "status", "updatedAt"]],
	])("%s shows these default columns", (collection, columns) => {
		expect(columnsFor(testSite, collection).defaults).toEqual(columns);
	});
});
