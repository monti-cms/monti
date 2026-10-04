import { describe, expect, it } from "vitest";
import { prepareSnapshot } from "../index";

/**
 * The part of `content-service.test.ts` that checks values of the reference blog setup (`cms.config.ts`) as they are.
 * The site address (`example.dev`), the collection paths (`/posts`, `/memos`) and the hash value fixed with `tagIds` do not exist in other site configs.
 */
describe("ContentService Contract (blog config)", () => {
	it("computes exact known SHA-256 vector", async () => {
		const snap = await prepareSnapshot(
			{
				collection: "post",
				slug: "a",
				metadata: {
					title: "A",
					tagIds: ["123e4567-e89b-12d3-a456-426614174002", "123e4567-e89b-12d3-a456-426614174001"],
				},
				mdx: "Hello",
			},
			{ schemaVersion: 1 },
		);
		expect(snap.contentHash).toBe("ce4f87281290c44253cb7844dd84e45cecc65aacb0bf2dfa5768da7e26ef921e");
	});

	it("extracts only supported prose links and keeps source positions", async () => {
		const snapshot = await prepareSnapshot({
			collection: "memo",
			slug: "memo",
			metadata: { title: "Memo" },
			mdx: [
				"[relative](/posts/draft-post)",
				"[absolute](https://example.dev/memos/xxx-equal)",
				"[www](https://www.example.dev/posts/old%20slug)",
				"[external](https://example.com/posts/not-internal)",
				"```md",
				"[code](/posts/not-a-link)",
				"```",
			].join("\n"),
		});
		expect((snapshot as any).internalLinks).toEqual([
			expect.objectContaining({ collection: "post", slug: "draft-post", position: { line: 1, column: 1 } }),
			expect.objectContaining({ collection: "memo", slug: "xxx-equal", position: { line: 2, column: 1 } }),
			expect.objectContaining({ collection: "post", slug: "old slug", position: { line: 3, column: 1 } }),
		]);
	});
});
