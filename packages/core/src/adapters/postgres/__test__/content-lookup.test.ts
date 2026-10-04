import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { createContentLookup } from "../store/content-lookup";

/** 받은 질의를 기록하고 정해진 줄을 돌려주는 연결(DB 없이). */
function fakePool(rows: Array<{ slug: string }>) {
	const query = vi.fn(async (_sql: string, _params: unknown[]) => ({ rows }));
	return { pool: { query } as unknown as Pool, query };
}

describe("본체 콘텐츠 조회", () => {
	it("같은 컬렉션·언어에서 쓰는 주소를 묻고, 고치는 항목 자신은 뺀다", async () => {
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
		// 주소를 잃은 줄(entry_id가 없는 줄)도 쓰는 주소로 본다.
		expect(sql).toContain("entry_id IS DISTINCT FROM");
		expect(params).toEqual(["post", "en", ["used", "free"], "11111111-1111-4111-8111-111111111111"]);
	});

	it("주소가 없으면 묻지 않고, 뺄 항목이 없으면 모두 본다", async () => {
		const { pool, query } = fakePool([]);
		const lookup = createContentLookup({ pool, schema: "cms" });
		expect(await lookup.slugsInUse({ collection: "post", locale: "ko", slugs: [] })).toEqual(new Set());
		expect(query).not.toHaveBeenCalled();
		await lookup.slugsInUse({ collection: "post", locale: "ko", slugs: ["a"] });
		expect(query.mock.calls[0]?.[1]).toEqual(["post", "ko", ["a"], null]);
	});
});
