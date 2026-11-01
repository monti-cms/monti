import { randomBytes, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { contentCollection, recordCollection, recordRelationField } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { contentOf, docOf } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import { SetupError } from "../../../core/problem";
import type { ContentStore } from "../../../core/store";
import { seedEntry } from "../../../core/store/__test__/seed";
import { documentKeyHash } from "../../../core/translation/state-hash";
import type { StorePort } from "../../../services";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../migrations";
import { fillDocumentHashes } from "../migrations/0003_translation_source_hashes";
import { createPluginStorage } from "../plugin-storage";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The migration runner: step records, the concurrent-run lock, schema creation, the seed job and run-once jobs. */
describe("migrations", () => {
	let pool: Pool;
	let schemaName: string;
	/** Schemas created separately by the test (dropped afterward). */
	const extraSchemas: string[] = [];

	/** Each test starts from an empty schema of its own, with no step recorded. */
	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterEach(async () => {
		for (const schema of extraSchemas.splice(0)) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
	});

	afterAll(async () => {
		await closeGlobalPool();
	});

	const applied = async (schema: string) =>
		(await pool.query<{ name: string }>(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows.map(
			(row) => row.name,
		);

	it("DB-M4 fills the hashes the translation filter compares for bodies written before they were kept, and every new body has them", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const store = createContentStore(pool, { site: testSite, schema: schemaName });
		const entry = await seedEntry(store, {
			collection: contentCollection,
			slug: "hash-fill",
			metadata: { title: "해시" },
			text: "본문",
			contentHash: "hash-fill-1",
		});
		const read = async () =>
			(
				await pool.query<{ doc_key_hash: string | null; translation_base_hash: string | null; doc: unknown }>(
					`SELECT doc_key_hash, translation_base_hash, doc FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
					[entry.id],
				)
			).rows[0];
		const written = await read();
		expect(written?.doc_key_hash).toBe(documentKeyHash(entry.working.doc));
		// A source has no base to compare.
		expect(written?.translation_base_hash).toBeNull();
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc_key_hash = NULL WHERE entry_id = $1`, [entry.id]);
		const client = await pool.connect();
		try {
			expect(await fillDocumentHashes(client, schemaName)).toBeGreaterThanOrEqual(1);
		} finally {
			client.release();
		}
		expect((await read())?.doc_key_hash).toBe(documentKeyHash(entry.working.doc));
	});

	it("DB-M3 runs one at a time even when started twice concurrently, and records the steps and the seed once", async () => {
		await Promise.all([
			migrateContentStore(pool, { site: testSite, schema: schemaName }),
			migrateContentStore(pool, { site: testSite, schema: schemaName }),
		]);
		const expected = [...CONTENT_STORE_MIGRATIONS, "seed_initial_body_templates"].sort();
		expect(await applied(schemaName)).toEqual(expected);
	});

	it("DB-M3 is a no-op when run again", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const before = await applied(schemaName);
		const again = await migrateContentStore(pool, { site: testSite, schema: schemaName });
		expect(again).toEqual({ applied: 0, upToDate: CONTENT_STORE_MIGRATIONS.length });
		expect(await applied(schemaName)).toEqual(before);
	});

	it("DB-M5 refuses a database built from the numbered steps of an older pre-release, and changes nothing", async () => {
		const schema = `cms_test_old_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		await migrateContentStore(pool, { site: testSite, schema });
		await pool.query(`INSERT INTO "${schema}".cms_migrations (name) VALUES ('0001_tables'), ('0023_entry_changed_by')`);
		const error = await migrateContentStore(pool, { site: testSite, schema }).then(
			() => undefined,
			(caught: unknown) => caught as SetupError,
		);
		expect(error).toBeInstanceOf(SetupError);
		expect(error?.kind).toBe("database_outdated");
		expect(error?.message).toContain("created by an older pre-release of Monti and cannot be upgraded");
		expect(error?.message).toContain("Fix: recreate it (run db:setup on a fresh schema or an empty database)");
		expect(await applied(schema)).toEqual(
			[...CONTENT_STORE_MIGRATIONS, "seed_initial_body_templates", "0001_tables", "0023_entry_changed_by"].sort(),
		);
	});

	it("DB-M6 creates the schema if missing (only set `schema` and run monti db:migrate)", async () => {
		const schema = `cms_test_new_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		await migrateContentStore(pool, { site: testSite, schema });
		const tables = await pool.query(
			`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'entries'`,
			[schema],
		);
		expect(tables.rows).toHaveLength(1);
	});

	it("PLUG-S8 records a plugin's one-time step in the core migration log, under the plugin's name", async () => {
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		const storage = createPluginStorage(pool, schemaName, "logged");
		expect(await storage.once("first-step", async () => {})).toBe(true);
		expect(await applied(schemaName)).toContain("plugin:logged:first-step");
		// Another plugin's step of the same name is a different step.
		expect(await createPluginStorage(pool, schemaName, "other").once("first-step", async () => {})).toBe(true);
		expect(await storage.once("first-step", async () => {})).toBe(false);
	});
});

describe("Body templates: seeding and migration in Postgres", () => {
	/** The site config's initial body templates (`seed.templates`). For a config without any, the seeding tests are skipped. */
	const SEEDED = testSite.config.seed?.templates ?? [];

	let pool: Pool;
	let schemaName: string;
	let store: ContentStore;

	// Every test gets its own schema, seeded by its own migration: the tests delete templates and clear the seed marker.
	beforeEach(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
	});

	afterEach(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
	});

	afterAll(closeGlobalPool);

	// To check that deleting one leaves the other intact, there must be at least two templates.
	it.skipIf(SEEDED.length < 2)(
		"TPL-S1 seeds templates for both editor types without reviving deleted templates",
		async () => {
			const templates = await store.listTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(SEEDED.length);

			// The config's templates are inserted with their name and their document: a seed written as text is read by its format, and nothing is written
			// to the text column.
			for (const seed of SEEDED) {
				const found = templates.find((t) => t.name === seed.name);
				if (!found) throw new Error(`Template not found: ${seed.name}`);
				// The core test config writes its seeds as documents, so no format is needed to read them.
				const expected = contentOf(seed.doc);
				expect(expected).not.toBeNull();
				expect(contentOf(found.doc)).toEqual(expected);
			}
			const [first, second] = SEEDED.map((seed) => templates.find((t) => t.name === seed.name));
			if (!first || !second) throw new Error("Seed templates not found.");

			// Delete one template
			await store.deleteTemplate({ id: first.id, expectedVersion: first.version });

			// Re-run migration
			await migrateContentStore(pool, { site: testSite, schema: schemaName });

			// Verify deleted template did NOT resurrect (one-time seed guarantee)
			const remaining = await store.listTemplates();
			expect(remaining.map((t) => t.id)).not.toContain(first.id);
			expect(remaining.find((t) => t.id === second.id)).toMatchObject({ name: second.name });
		},
	);

	it.skipIf(SEEDED.length === 0)(
		"TPL-S1 seed preserves same-name user templates and never resurrects deletions",
		async () => {
			const name = SEEDED[SEEDED.length - 1]?.name;
			const seeded = (await store.listTemplates()).find((template) => template.name === name);
			if (!seeded) throw new Error(`Template not found: ${name}`);

			const userId = randomUUID();
			await pool.query(`UPDATE "${schemaName}".body_templates SET id = $1, doc = $2::jsonb WHERE id = $3`, [
				userId,
				JSON.stringify(docOf("사용자가 수정한 본문")),
				seeded.id,
			]);
			// Even if the seed marker is cleared so seeding runs again, a user template with the same name is not overwritten.
			await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'seed_initial_body_templates'`);
			await migrateContentStore(pool, { site: testSite, schema: schemaName });

			const preserved = (await store.listTemplates()).filter((template) => template.name === name);
			expect(preserved).toHaveLength(1);
			expect(preserved[0]).toMatchObject({ id: userId });
			expect(contentOf(preserved[0]?.doc)).toEqual(contentOf(docOf("사용자가 수정한 본문")));

			await store.deleteTemplate({ id: userId, expectedVersion: preserved[0].version });
			await migrateContentStore(pool, { site: testSite, schema: schemaName });
			expect((await store.listTemplates()).some((template) => template.name === name)).toBe(false);
		},
	);
});

describe("ContentStore References", () => {
	type ExtendedStore = ReturnType<typeof createContentStore> & StorePort;

	/**
	 * A relation field where a body collection points at an item collection. A multi-select field is preferred (it also tests the order `ordinal`).
	 * Collection and field names are looked up in the current config (`test/any-site.ts`).
	 */
	const relation = (() => {
		for (const { name, field, when } of testSite.storedFields(contentCollection)) {
			if (!when && field.kind === "relation" && field.many && testSite.isItemCollection(field.to)) {
				return { name, to: field.to as Collection, many: true };
			}
		}
		return recordRelationField(contentCollection);
	})();

	/** The item collection that creates reference targets. */
	const targetCollection = relation?.to ?? recordCollection;

	let pool: Pool;
	let schemaName: string;
	let store: ExtendedStore;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;

		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName }) as unknown as ExtendedStore;
	});

	afterAll(async () => {
		if (pool && schemaName) {
			await dropIsolatedTestPool(pool, schemaName);
		}
		await closeGlobalPool();
	});

	it("WRITE-S11 DB CHECK binds target_id to target_entry_id for entry kinds, rejecting mismatched identities", async () => {
		const source = await seedEntry(store, {
			collection: contentCollection,
			slug: `source-${randomUUID()}`,
			metadata: {},
			text: "",
			contentHash: "src",
		});
		const targetA = await seedEntry(store, {
			collection: targetCollection,
			slug: `target-a-${randomUUID()}`,
			metadata: {},
			text: "",
			contentHash: "ta",
		});
		const targetB = await seedEntry(store, {
			collection: targetCollection,
			slug: `target-b-${randomUUID()}`,
			metadata: {},
			text: "",
			contentHash: "tb",
		});

		await expect(
			pool.query(
				`INSERT INTO "${schemaName}".entry_references (entry_id, state, kind, target_id, target_entry_id, is_stale, occurrences)
				 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
				[source.id, "working", "entry", targetA.id, targetB.id, false, JSON.stringify([])],
			),
		).rejects.toMatchObject({ code: "23514", constraint: "entry_references_target_check" });

		const res = await pool.query(`SELECT COUNT(*) as count FROM "${schemaName}".entry_references WHERE entry_id = $1`, [
			source.id,
		]);
		expect(res.rows[0].count).toBe("0");
	});
});
