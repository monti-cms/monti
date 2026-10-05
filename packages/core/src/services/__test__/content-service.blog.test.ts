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
		// Pins the hash format. The value changed from the v1 vector ("ce4f8728…", which hashed the MDX string) on purpose when the
		// hash moved to the parsed body ("cms-snapshot-v2"). Only change it again together with a new tag and a stored-hash migration.
		expect(snap.contentHash).toBe("01812cb018b9a2ee5ce14f86763c7e6c5e11bafdd14301f603061d8a2348ff0a");
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
