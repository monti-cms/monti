import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	contentCollection,
	fillRequiredMetadata,
	otherContentCollection,
	recordCollection,
	requiredMetadata,
} from "../../../../test/any-site";
import type { Collection } from "../../../core/collections";
import { CmsError, createContentStore, migrateContentStore } from "../content-store";
import { publishDraft, seedEntry, seedSave } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * Working slug lookup for the admin preview only.
 *
 * The public read (`getPublishedEntryBySlug`) never returns a draft. This pins down that only the admin path can find drafts,
 * without touching that contract.
 */
describe("getWorkingEntryBySlug", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let relationTarget: (to: Collection) => Promise<string>;
	/** Another collection to try the same slug in (memos in the reference blog). A config with a single document collection uses an item collection. */
	const elsewhere = otherContentCollection ?? recordCollection;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		// Required-for-publish values (such as the reference blog's category) are looked up in the config and filled in.
		relationTarget = fillRequiredMetadata(store).relationTarget;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	async function seedDraft(slug: string, mdx: string, metadata: Record<string, unknown> = { title: slug }) {
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: null,
			metadata,
			mdx,
			schemaVersion: 1,
			contentHash: `hash-${slug}`,
		});

		return await seedSave(store, entry.id, {
			expectedVersion: entry.version,
			slug,
			metadata,
			mdx,
			schemaVersion: 1,
			contentHash: `hash-${slug}-saved`,
		});
	}

	it("returns the draft with its working body; the public read cannot see the same slug", async () => {
		await seedDraft("draft-only-post", "초안 본문");

		const found = await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "draft-only-post" });

		expect(found?.status).toBe("draft");
		expect(found?.workingSlug).toBe("draft-only-post");
		expect(found?.working.mdx).toBe("초안 본문");
		expect(found?.working.metadata).toEqual(
			await requiredMetadata(contentCollection, "draft-only-post", relationTarget),
		);

		// The public path still does not return the draft (this change did not widen the public contract).
		expect(await store.getPublishedEntryBySlug({ collection: contentCollection, slug: "draft-only-post" })).toEqual({
			status: "not_found",
		});
	});

	it("shows the latest working copy in the preview after the working body is edited post-publish", async () => {
		const draft = await seedDraft("edited-after-publish", "발행 전 본문");

		await publishDraft(store, { id: draft.id, expectedVersion: draft.version });

		const edited = await store.getEntry(draft.id);
		await seedSave(store, draft.id, {
			expectedVersion: edited.version,
			slug: "edited-after-publish",
			metadata: { title: "편집된 제목" },
			mdx: "발행 후 편집 본문",
			schemaVersion: 1,
			contentHash: "hash-edited-after-publish",
		});

		const found = await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "edited-after-publish" });

		expect(found?.status).toBe("published");
		expect(found?.working.mdx).toBe("발행 후 편집 본문");
		expect(found?.published?.mdx).toBe("발행 전 본문");
	});

	it("returns null for a missing slug", async () => {
		expect(await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "does-not-exist" })).toBeNull();
	});

	it("does not find the same slug in another collection", async () => {
		const other = await seedEntry(store, {
			collection: elsewhere,
			slug: "shared-slug",
			metadata: { title: "메모" },
			mdx: "메모 본문",
			schemaVersion: 1,
			contentHash: "hash-memo-shared",
		});
		expect(other.workingSlug).toBe("shared-slug");

		expect(await store.getWorkingEntryBySlug({ collection: elsewhere, slug: "shared-slug" })).not.toBeNull();
		expect(await store.getWorkingEntryBySlug({ collection: contentCollection, slug: "shared-slug" })).toBeNull();
	});

	it("rejects invalid input with invalid_input instead of silently returning null", async () => {
		await expect(store.getWorkingEntryBySlug({ collection: contentCollection, slug: "" })).rejects.toBeInstanceOf(
			CmsError,
		);
		await expect(store.getWorkingEntryBySlug({ collection: contentCollection, slug: "  " })).rejects.toMatchObject({
			code: "invalid_input",
		});
		await expect(store.getWorkingEntryBySlug({ collection: contentCollection } as never)).rejects.toMatchObject({
			code: "invalid_input",
		});
	});
});
