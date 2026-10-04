import { describe, expect, it } from "vitest";
import { columnsFor } from "../list-columns";

/**
 * The reference blog config drops the list setting (`list.columns`) and uses the default columns. Checks that the default columns match the columns that were once written there.
 * Runs only with the reference blog example config (`packages/core/test/cms.config.ts`).
 */
describe("reference blog list default columns", () => {
	it.each([
		["post", ["title", "status", "locale", "categoryId", "tagIds", "updatedAt", "publishedAt"]],
		["memo", ["title", "status", "locale", "tagIds", "updatedAt", "publishedAt"]],
		["category", ["title", "slug", "locale", "status", "updatedAt"]],
		["tag", ["title", "slug", "locale", "status", "updatedAt"]],
		["collection", ["title", "slug", "locale", "status", "updatedAt"]],
	])("%s matches the previous list setting", (collection, columns) => {
		expect(columnsFor(collection).defaults).toEqual(columns);
	});
});
