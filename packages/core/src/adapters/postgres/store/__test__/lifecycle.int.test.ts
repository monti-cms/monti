import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, fillRequiredMetadata, recordCollection, secondLocale } from "../../../../../test/any-site";
import { testSite } from "../../../../../test/site";
import { docOf } from "../../../../../test/stored-content";
import type { ContentStore } from "../../../../core/store";
import { second, translationHelpers } from "../../../../core/store/__test__/contract/translation-fixtures";
import { publishDraft, seedEntry } from "../../../../core/store/__test__/seed";
import type { createContentService } from "../../../../services/content-service";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "../../__test__/test-database";
import { createContentStore, migrateContentStore } from "../../content-store";

/** Collection names are looked up in the current config (`test/any-site.ts`). Posts are the document collection with a body; tags are the item collection. */
const content = contentCollection;
const record = recordCollection;

describe("Publishing, Lifecycle & Published-References Contracts", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		// Values needed to publish an entry (such as the reference blog's category) are irrelevant to this file's scenarios, so the store fills them in.
		fillRequiredMetadata(store);
	});

	/** How many connections wait for a lock in a query on this schema. */
	const lockWaiters = async () =>
		(
			await pool.query<{ count: number }>(
				"SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE $1",
				[`%"${schemaName}"%`],
			)
		).rows[0]?.count ?? 0;

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	describe("2. Transactional Target Recheck & Published References Rollback", () => {
		it("TRASH-T9 lets a trash wait for a concurrent draft reference save to the tag, then go through", async () => {
			const tagDraft = await seedEntry(store, {
				collection: record,
				slug: `tag-race-${randomUUID()}`,
				metadata: { title: "Race tag" },
				text: "",
				contentHash: randomUUID(),
			});
			const tag = await publishDraft(testSite, store, { id: tagDraft.id, expectedVersion: tagDraft.version });
			const post = await seedEntry(store, {
				collection: content,
				slug: `post-tag-race-${randomUUID()}`,
				metadata: { title: "Concurrent draft" },
				text: "Draft.",
				contentHash: randomUUID(),
			});
			const coordinator = await pool.connect();
			try {
				await coordinator.query("BEGIN");
				await coordinator.query(`SELECT id FROM "${schemaName}".entries WHERE id = $1 FOR SHARE`, [tag.id]);
				const trash = store.trashEntry({ id: tag.id, expectedVersion: tag.version });
				// The trash waits for the coordinator's lock on the tag.
				await expect.poll(lockWaiters).toBe(1);
				const save = await store.saveWorkingWithReferences({
					entryId: post.id,
					expectedVersion: post.version,
					snapshot: {
						collection: content,
						slug: post.workingSlug,
						metadata: { title: "Concurrent draft" },
						doc: docOf("Draft."),
						contentHash: randomUUID(),
						issues: [],
						references: [],
						imageSources: [],
					},
					references: [{ kind: "entry", targetId: tag.id, isStale: false, occurrences: [] }],
				});
				await coordinator.query("COMMIT");
				await expect(trash).resolves.toMatchObject({ status: "trashed" });
				expect(save.version).toBeGreaterThan(post.version);
			} catch (error) {
				await coordinator.query("ROLLBACK").catch(() => undefined);
				throw error;
			} finally {
				coordinator.release();
			}
		});
	});
});

/** Translation behavior that depends on how Postgres stores things: rows are read and rewritten with SQL, and legacy data is made by hand. */
describe("translation groups (postgres storage)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService>;
	let createPost: ReturnType<typeof translationHelpers>["createPost"];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		({ service, createPost } = translationHelpers(store));
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	describe.skipIf(!secondLocale)("translations (two or more languages)", () => {
		const statusOf = async (id: string) =>
			(await pool.query<{ status: string }>(`SELECT status FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.status;
		const versionOf = async (id: string) =>
			(await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.version as number;

		it("TRASH-D6 permanently deleting the source also deletes trashed translations, and is rejected if a translation outside the trash exists", async () => {
			const source = await createPost("delete-source");
			const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
			const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });

			// Legacy data where only the source is in the trash and the translation is alive.
			await pool.query(`UPDATE "${schemaName}".entries SET status = 'draft', deleted_at = NULL WHERE id = $1`, [
				translation.id,
			]);
			await expect(
				store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version }),
			).rejects.toMatchObject({ code: "has_translations" });

			await store.trashEntry({ id: translation.id, expectedVersion: await versionOf(translation.id) });
			await store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version });
			expect(await statusOf(source.id)).toBeUndefined();
			expect(await statusOf(translation.id)).toBeUndefined();
		});

		it("EVENT-D4 records one named deleted event for the source and for each translation it deletes with it", async () => {
			const source = await createPost("delete-events");
			const translation = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
			const trashedTranslation = await store.trashEntry({
				id: translation.id,
				expectedVersion: await versionOf(translation.id),
			});
			const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });
			await store.permanentDeleteEntry({ id: source.id, expectedVersion: trashed.version });

			const { rows } = await pool.query<{
				entry_id: string;
				locale: string;
				payload: { title?: string | null; workingSlug?: string | null };
			}>(
				`SELECT entry_id, locale, payload FROM "${schemaName}".cms_events WHERE kind = 'deleted' AND entry_id = ANY($1::uuid[])`,
				[[source.id, translation.id]],
			);
			expect(rows.map((row) => row.entry_id).sort()).toEqual([source.id, translation.id].sort());
			expect(new Set(rows.map((row) => row.locale)).size).toBe(2);
			// The entries are gone, so what the event kept (the title, or the address for a translation that has no title of its own) is what still names them.
			expect(rows.find((row) => row.entry_id === source.id)?.payload).toMatchObject({
				title: source.working.metadata.title,
				workingSlug: source.workingSlug,
			});
			expect(rows.find((row) => row.entry_id === translation.id)?.payload).toMatchObject({
				workingSlug: translation.workingSlug,
			});
			expect(trashedTranslation.status).toBe("trashed");
		});

		it("TRASH-R2 keeps a translation trashed on its own in the trash when the source is restored, even if it went a few microseconds before the source", async () => {
			const source = await createPost("trash-same-millisecond");
			const apart = (await service.createTranslation({ sourceId: source.id, locale: second })).entry;
			await store.trashEntry({ id: apart.id, expectedVersion: apart.version });
			const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });
			// Two trashes inside one millisecond: the times differ only below it, where a JavaScript Date cannot tell them apart.
			await pool.query(`UPDATE "${schemaName}".entries SET deleted_at = $2 WHERE id = $1`, [
				apart.id,
				"2026-01-01 00:00:00.000200+00",
			]);
			await pool.query(`UPDATE "${schemaName}".entries SET deleted_at = $2 WHERE id = $1`, [
				source.id,
				"2026-01-01 00:00:00.000500+00",
			]);

			await store.restoreEntry({ id: source.id, expectedVersion: trashed.version });
			expect(await statusOf(source.id)).toBe("draft");
			expect(await statusOf(apart.id)).toBe("trashed");
		});
	});
});
