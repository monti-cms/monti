import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata } from "../../../../test/any-site";
import { type ContentChange, createContentStore, migrateContentStore } from "../content-store";
import { seedEntry } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** 저장 뒤 알림(M14-7): 커밋된 변경만, 실패한 알림이 저장을 되돌리지 않는다. */
describe("저장 뒤 알림 afterCommit", () => {
	let pool: Pool;
	let schemaName: string;
	const changes: ContentChange[] = [];
	let failNext = false;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, {
			schema: schemaName,
			afterCommit: (change) => {
				if (failNext) {
					failNext = false;
					throw new Error("hook failed");
				}
				changes.push(change);
			},
		});
		fillRequiredMetadata(store);
	});

	beforeEach(() => {
		changes.length = 0;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const create = (slug: string) =>
		seedEntry(store, { collection: contentCollection, slug, metadata: { title: slug }, mdx: "본문" });

	it("만들기·발행·보관·휴지통·복원·영구 삭제를 커밋 뒤에 알린다", async () => {
		const entry = await create("after-commit-flow");
		// 필수 관계 대상을 처음 만들 때 그 항목도 "created"로 온다. 이 글의 알림만 본다.
		expect(changes.at(-1)).toMatchObject({ kind: "created", entryId: entry.id, status: "draft" });
		changes.length = 0;
		const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });
		const archived = await store.archiveEntry({ id: entry.id, expectedVersion: published.version });
		const trashed = await store.trashEntry({ id: entry.id, expectedVersion: archived.version });
		const restored = await store.restoreEntry({ id: entry.id, expectedVersion: trashed.version });
		const again = await store.trashEntry({ id: entry.id, expectedVersion: restored.version });
		await store.permanentDeleteEntry({ id: entry.id, expectedVersion: again.version });

		expect(changes.map((change) => change.kind)).toEqual([
			"published",
			"archived",
			"trashed",
			"restored",
			"trashed",
			"deleted",
		]);
		expect(changes[0]).toMatchObject({
			entryId: entry.id,
			collection: contentCollection,
			locale: entry.locale,
			translationGroupId: entry.id,
			status: "published",
			publishedSlug: "after-commit-flow",
		});
	});

	it("되돌린 변경(판 충돌)은 알리지 않는다", async () => {
		const entry = await create("after-commit-conflict");
		changes.length = 0;
		await expect(store.publishEntry({ id: entry.id, expectedVersion: entry.version + 5 })).rejects.toMatchObject({
			code: "conflict",
		});
		expect(changes).toEqual([]);
	});

	it("알림이 실패해도 저장은 커밋된 그대로다", async () => {
		const entry = await create("after-commit-failing-hook");
		failNext = true;
		const published = await store.publishEntry({ id: entry.id, expectedVersion: entry.version });
		expect(published.status).toBe("published");
		expect((await store.getEntry(entry.id)).status).toBe("published");
	});
});
