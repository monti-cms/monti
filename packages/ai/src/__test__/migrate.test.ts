import {
	closeGlobalPool,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	fakeCms,
	migrateContentStore,
	pluginStorageFor,
} from "@monti-cms/core/testing";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { testConfig, testSite } from "../../test/site";
import { migrateAi } from "../migrate";
import { createAiStore } from "../store";

/**
 * The AI plugin used to create its own tables (`ai_action_overrides`, `ai_custom_actions`, `ai_settings`) in the site's database. It now keeps the same data in the plugin
 * storage (`cms.storage("ai")`). A site that already has data must find all of it after `monti migrate`, as it was.
 */
describe("AI data migration from the plugin's own tables to the plugin storage", () => {
	let pool: Pool;
	let schemaName: string;
	const cms = fakeCms({ config: testConfig });

	beforeEach(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { schema: schemaName, site: testSite });
	});

	afterEach(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const storage = () => pluginStorageFor(pool, schemaName, "ai");

	/** The tables as the plugin created them before it used the storage API. */
	const createLegacyTables = async () => {
		await pool.query(`
			CREATE TABLE "${schemaName}".ai_action_overrides (
				key TEXT PRIMARY KEY, value JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			CREATE TABLE "${schemaName}".ai_custom_actions (
				key TEXT PRIMARY KEY, value JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 1,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
			CREATE TABLE "${schemaName}".ai_settings (
				id TEXT PRIMARY KEY, value JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			);
		`);
	};

	const OVERRIDE = { enabled: false, prompt: "운영자 지시문" };
	const CUSTOM_FIRST = { label: "첫 번째", surface: { slot: "selection" }, result: "mdx" };
	const CUSTOM_SECOND = { label: "두 번째", surface: { slot: "selection" }, result: "text" };
	const CONNECTION = { providers: [{ id: "main", baseUrl: "https://ai.example.test", model: "m-1", key: "sealed" }] };
	const SHARED = { texts: { tone: "다정하게" } };
	const EARLIER = "2025-01-02T03:04:05.000Z";
	const LATER = "2025-06-07T08:09:10.000Z";

	const seedLegacyData = async () => {
		await createLegacyTables();
		await pool.query(
			`INSERT INTO "${schemaName}".ai_action_overrides (key, value, version, updated_at) VALUES ('summary', $1, 3, $2)`,
			[JSON.stringify(OVERRIDE), LATER],
		);
		// Inserted in the reverse of their creation order: the creation date decides the order in the list.
		await pool.query(
			`INSERT INTO "${schemaName}".ai_custom_actions (key, value, version, created_at, updated_at) VALUES
			 ('custom_b', $1, 2, $3, $4), ('custom_a', $2, 1, $5, $5)`,
			[JSON.stringify(CUSTOM_SECOND), JSON.stringify(CUSTOM_FIRST), LATER, LATER, EARLIER],
		);
		await pool.query(
			`INSERT INTO "${schemaName}".ai_settings (id, value, version, updated_at) VALUES ('default', $1, 4, $3), ('shared', $2, 1, $3)`,
			[JSON.stringify(CONNECTION), JSON.stringify(SHARED), LATER],
		);
	};

	it("finds every edited action, UI action and setting after the migration, with its value, version and dates", async () => {
		await seedLegacyData();
		await migrateAi(storage(), cms);

		const store = createAiStore(storage(), { site: testSite });
		expect(await store.listAiActionOverrides()).toEqual([
			{ key: "summary", value: OVERRIDE, version: 3, updatedAt: new Date(LATER) },
		]);
		// UI actions stay in the order they were created in.
		expect((await store.listAiCustomActions()).map((row) => [row.key, row.value, row.version])).toEqual([
			["custom_a", CUSTOM_FIRST, 1],
			["custom_b", CUSTOM_SECOND, 2],
		]);
		expect(await store.getAiSettings("default")).toEqual({ value: CONNECTION, version: 4 });
		expect(await store.getAiSettings("shared")).toEqual({ value: SHARED, version: 1 });
		expect((await storage().collection("custom-actions").get("custom_a"))?.createdAt).toEqual(new Date(EARLIER));
	});

	it("carries the versions on: a save has to expect the migrated version, and a stale editor still gets a conflict", async () => {
		await seedLegacyData();
		await migrateAi(storage(), cms);
		const store = createAiStore(storage(), { site: testSite });

		await expect(store.saveAiActionOverride({ key: "summary", expectedVersion: 2, value: {} })).rejects.toMatchObject({
			code: "conflict",
			serverVersion: 3,
		});
		expect(
			await store.saveAiActionOverride({ key: "summary", expectedVersion: 3, value: { enabled: true } }),
		).toMatchObject({
			version: 4,
			value: { enabled: true },
		});
		expect(await store.saveAiSettings({ expectedVersion: 4, value: { providers: [] } })).toBe(5);
		await store.deleteAiCustomAction({ key: "custom_a", expectedVersion: 1 });
		expect((await store.listAiCustomActions()).map((row) => row.key)).toEqual(["custom_b"]);
	});

	it("leaves the old tables as they were, and moves the data once: later changes on either side are not carried over", async () => {
		await seedLegacyData();
		await migrateAi(storage(), cms);
		const store = createAiStore(storage(), { site: testSite });
		await store.saveAiActionOverride({ key: "summary", expectedVersion: 3, value: { enabled: true } });
		await pool.query(
			`INSERT INTO "${schemaName}".ai_action_overrides (key, value) VALUES ('slug', '{"enabled": false}')`,
		);

		await migrateAi(storage(), cms);

		expect((await store.listAiActionOverrides()).map((row) => [row.key, row.version])).toEqual([["summary", 4]]);
		const legacy = await pool.query<{ key: string; value: unknown; version: number }>(
			`SELECT key, value, version FROM "${schemaName}".ai_action_overrides ORDER BY key`,
		);
		expect(legacy.rows).toEqual([
			{ key: "slug", value: { enabled: false }, version: 1 },
			{ key: "summary", value: OVERRIDE, version: 3 },
		]);
		const tables = await pool.query<{ n: number }>(
			`SELECT (SELECT count(*) FROM "${schemaName}".ai_custom_actions)::int AS n`,
		);
		expect(tables.rows[0]?.n).toBe(2);
	});

	it("does not overwrite what the storage already has", async () => {
		await seedLegacyData();
		await storage().collection("action-overrides").set("summary", { prompt: "이미 있는 값" }, { expectedVersion: 0 });
		await migrateAi(storage(), cms);
		expect((await storage().collection("action-overrides").get("summary"))?.value).toEqual({ prompt: "이미 있는 값" });
		expect((await storage().collection("settings").get("default"))?.version).toBe(4);
	});

	it("migrates a new site that has none of the old tables, and a site with empty ones", async () => {
		await migrateAi(storage(), cms);
		const store = createAiStore(storage(), { site: testSite });
		expect(await store.listAiActionOverrides()).toEqual([]);
		expect(await store.getAiSettings("default")).toBeNull();

		await createLegacyTables();
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name LIKE 'plugin:ai:%'`);
		await migrateAi(storage(), cms);
		expect(await store.listAiCustomActions()).toEqual([]);
	});

	it("moves the oldest actions table (`ai_features`) only where the earlier version has not recorded doing it", async () => {
		await pool.query(`
			CREATE TABLE "${schemaName}".ai_features (
				id UUID PRIMARY KEY, builtin TEXT UNIQUE, spec JSONB NOT NULL, version INTEGER NOT NULL DEFAULT 1,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)`);
		await pool.query(
			`INSERT INTO "${schemaName}".ai_features (id, builtin, spec) VALUES (gen_random_uuid(), 'codeFold', $1)`,
			[JSON.stringify({ prompt: "운영자 지시문", enabled: false })],
		);
		// The earlier version already moved these once (and the operator may have reset the action since).
		await pool.query(`INSERT INTO "${schemaName}".cms_migrations (name) VALUES ('migrate_ai_features_to_actions')`);

		await migrateAi(storage(), cms);
		expect(await createAiStore(storage(), { site: testSite }).listAiActionOverrides()).toEqual([]);

		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = 'migrate_ai_features_to_actions'`);
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name LIKE 'plugin:ai:%'`);
		await migrateAi(storage(), cms);
		expect((await createAiStore(storage(), { site: testSite }).listAiActionOverrides()).map((row) => row.key)).toEqual([
			"codeFold",
		]);
	});

	it("keeps the AI data in the AI plugin's own namespace", async () => {
		await seedLegacyData();
		await migrateAi(storage(), cms);
		expect(await pluginStorageFor(pool, schemaName, "other").collection("settings").list()).toEqual([]);
		expect(await pluginStorageFor(pool, schemaName, "other").collection("action-overrides").list()).toEqual([]);
	});
});
