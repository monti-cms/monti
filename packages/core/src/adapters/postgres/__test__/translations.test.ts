import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, secondLocale } from "../../../../test/any-site";
import type { ContentStore, Entry } from "../../../core/store";
import { second, translationHelpers } from "../../../core/store/__test__/contract/translation-fixtures";
import type { createContentService } from "../../../services/content-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** Translation behavior that depends on how Postgres stores things: rows are read and rewritten with SQL, and legacy data is made by hand. */
describe("translation groups (postgres storage)", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;
	let service: ReturnType<typeof createContentService<Entry>>;
	let createPost: ReturnType<typeof translationHelpers>["createPost"];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		({ service, createPost } = translationHelpers(store));
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	it("gives the same result when migrated again (columns and primary key)", async () => {
		await migrateContentStore(pool, { schema: schemaName });
		const pk = await pool.query<{ column_name: string }>(
			`SELECT column_name FROM information_schema.key_column_usage
			 WHERE table_schema = $1 AND constraint_name = 'content_addresses_pkey' ORDER BY ordinal_position`,
			[schemaName],
		);
		expect(pk.rows.map((row) => row.column_name)).toEqual(["collection", "locale", "slug"]);
	});

	describe.skipIf(!secondLocale)("translations (two or more languages)", () => {
		it("reads a version 2 translation status as version 4 with the document of its source, and writes version 4", async () => {
			const source = await createPost("legacy-state-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			await pool.query(`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2`, [
				JSON.stringify({ version: 2, baseSource: "예전 기준" }),
				translation.id,
			]);
			const legacy = await store.getEntry(translation.id);
			expect(legacy.working.translation?.version).toBe(4);
			expect(legacy.working.translation).not.toHaveProperty("baseSource");
			expect(legacy.working.translation?.baseDoc.content[0]).toMatchObject({ type: "paragraph" });
			expect(JSON.stringify(legacy.working.translation?.baseDoc)).toContain("예전 기준");

			const resent = await service.saveDraft(translation.id, {
				collection: contentCollection,
				slug: "legacy-state-source",
				metadata: { title: "Only the title" },
				format: "mdx",
				body: "",
				translation: { version: 2, baseSource: "예전 기준" } as never,
				expectedVersion: legacy.version,
			});
			expect(resent.working.translation?.version).toBe(4);
			const stored = await pool.query<{ translation: { version: number; baseDoc: unknown } }>(
				`SELECT translation FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
				[translation.id],
			);
			expect(stored.rows[0]?.translation.version).toBe(4);
			expect(JSON.stringify(stored.rows[0]?.translation.baseDoc)).toContain("예전 기준");
		});

		const statusOf = async (id: string) =>
			(await pool.query<{ status: string }>(`SELECT status FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.status;
		const versionOf = async (id: string) =>
			(await pool.query<{ version: number }>(`SELECT version FROM "${schemaName}".entries WHERE id = $1`, [id])).rows[0]
				?.version as number;

		it("permanently deleting the source also deletes trashed translations, and is rejected if a translation outside the trash exists", async () => {
			const source = await createPost("delete-source");
			const translation = await service.createTranslation({ sourceId: source.id, locale: second });
			const trashed = await store.trashEntry({ id: source.id, expectedVersion: source.version });

			// Legacy data where only the source is in the trash and the translation is alive.
			await pool.query(`UPDATE "${schemaName}".entries SET status = 'draft', trashed_at = NULL WHERE id = $1`, [
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
	});
});
