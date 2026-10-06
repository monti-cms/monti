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
				format: "mdx",
				body: "Hello",
			},
			{ schemaVersion: 1 },
		);
		// Pins the hash format. The value changed from the v1 vector ("ce4f8728…", which hashed the MDX string) on purpose when the
		// hash moved to the parsed body ("cms-snapshot-v2"), and again when it moved to the stored document ("cms-snapshot-v3"). The hashed document
		// carries its format version, so raising it (version 2: a code block as its code and annotations) changed the value once more, with a migration
		// that recomputes stored hashes (`0015_code_annotations`). Only change it again together with a stored-hash migration.
		expect(snap.contentHash).toBe("6e29aef176a7373f4c2bad69f73e5f77f2302a7285b94d0e6ee0a9ce6ebbe14d");
	});

	it("extracts only supported prose links and keeps the block of each", async () => {
		const snapshot = await prepareSnapshot({
			collection: "memo",
			slug: "memo",
			metadata: { title: "Memo" },
			format: "mdx",
			body: [
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
			expect.objectContaining({
				collection: "post",
				slug: "draft-post",
				position: { blockId: expect.any(String) },
			}),
			expect.objectContaining({
				collection: "memo",
				slug: "xxx-equal",
				position: { blockId: expect.any(String) },
			}),
			expect.objectContaining({
				collection: "post",
				slug: "old slug",
				position: { blockId: expect.any(String) },
			}),
		]);
	});
});
