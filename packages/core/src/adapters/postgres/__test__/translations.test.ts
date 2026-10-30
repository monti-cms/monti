import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { secondLocale } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import type { ContentStore } from "../../../core/store";
import { second, translationHelpers } from "../../../core/store/__test__/contract/translation-fixtures";
import type { createContentService } from "../../../services/content-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

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

	it("gives the same result when migrated again (columns and primary key)", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const pk = await pool.query<{ column_name: string }>(
			`SELECT column_name FROM information_schema.key_column_usage
			 WHERE table_schema = $1 AND constraint_name = 'content_addresses_pkey' ORDER BY ordinal_position`,
			[schemaName],
		);
		expect(pk.rows.map((row) => row.column_name)).toEqual(["collection", "locale", "slug"]);
	});

	describe.skipIf(!secondLocale)("translations (two or more languages)", () => {
		const statusOf = async (id: string) =>
			(await pool.query<{ status: string }>(`SELECT status FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.status;
		const versionOf = async (id: string) =>
			(await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.version as number;

		it("permanently deleting the source also deletes trashed translations, and is rejected if a translation outside the trash exists", async () => {
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

		it("records one named deleted event for the source and for each translation it deletes with it", async () => {
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

		it("keeps a translation trashed on its own in the trash when the source is restored, even if it went a few microseconds before the source", async () => {
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
