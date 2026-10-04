import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { createContentLookup } from "../store/content-lookup";

/** A connection that records the queries it receives and returns canned rows (no DB). */
function fakePool(rows: Array<{ slug: string }>) {
	const query = vi.fn(async (_sql: string, _params: unknown[]) => ({ rows }));
	return { pool: { query } as unknown as Pool, query };
}

describe("core content lookup", () => {
	it("asks for slugs used in the same collection and language, excluding the entry being edited", async () => {
		const { pool, query } = fakePool([{ slug: "used" }]);
		const lookup = createContentLookup({ pool, schema: "cms" });
		const taken = await lookup.slugsInUse({
			collection: "post",
			locale: "en",
			slugs: ["used", "free"],
			excludeEntryId: "11111111-1111-4111-8111-111111111111",
		});
		expect(taken).toEqual(new Set(["used"]));
		const [sql, params] = query.mock.calls[0] ?? [];
		expect(sql).toContain('"cms".content_addresses');
		// A row that lost its entry (no entry_id) still counts as a used slug.
		expect(sql).toContain("entry_id IS DISTINCT FROM");
		expect(params).toEqual(["post", "en", ["used", "free"], "11111111-1111-4111-8111-111111111111"]);
	});

	it("skips the query when there are no slugs, and checks all when there is nothing to exclude", async () => {
		const { pool, query } = fakePool([]);
		const lookup = createContentLookup({ pool, schema: "cms" });
		expect(await lookup.slugsInUse({ collection: "post", locale: "ko", slugs: [] })).toEqual(new Set());
		expect(query).not.toHaveBeenCalled();
		await lookup.slugsInUse({ collection: "post", locale: "ko", slugs: ["a"] });
		expect(query.mock.calls[0]?.[1]).toEqual(["post", "ko", ["a"], null]);
	});
});
