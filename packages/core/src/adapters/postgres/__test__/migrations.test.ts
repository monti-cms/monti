import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pluginDatabaseFor } from "../adapter";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { seedEntry } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** 마이그레이션 단계 기록·동시 실행 잠금·스키마 만들기·한 번만 하는 일(M13-3·4). */
describe("마이그레이션", () => {
	let pool: Pool;
	let schemaName: string;
	/** 테스트가 따로 만든 스키마(끝나고 지운다). */
	const extraSchemas: string[] = [];

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterAll(async () => {
		for (const schema of extraSchemas) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const applied = async (schema: string) =>
		(await pool.query<{ name: string }>(`SELECT name FROM "${schema}".cms_migrations ORDER BY name`)).rows.map(
			(row) => row.name,
		);

	it("동시에 두 번 돌려도 하나씩 돌고, 모든 단계를 한 번씩 기록한다", async () => {
		await Promise.all([
			migrateContentStore(pool, { schema: schemaName }),
			migrateContentStore(pool, { schema: schemaName }),
		]);
		expect(await applied(schemaName)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
		// 다시 돌려도 아무것도 하지 않는다.
		await migrateContentStore(pool, { schema: schemaName });
		expect(await applied(schemaName)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
	});

	it("스키마가 없으면 만든다(`schema` 설정만 적고 monti migrate)", async () => {
		const schema = `cms_test_new_${randomBytes(3).toString("hex")}`;
		extraSchemas.push(schema);
		await migrateContentStore(pool, { schema });
		const tables = await pool.query(
			`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'entries'`,
			[schema],
		);
		expect(tables.rows).toHaveLength(1);
	});

	it("단계 기록이 없던 예전 저장소도 데이터를 그대로 두고 단계를 모두 기록한다", async () => {
		const store = createContentStore(pool, { schema: schemaName });
		const entry = await seedEntry(store, {
			collection: "x",
			slug: "kept",
			metadata: { title: "Kept" },
			mdx: "본문",
		});
		// 단계 기록이 생기기 전 저장소: 일회성 기록(초기 템플릿)만 있다.
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name <> 'seed_initial_body_templates'`);
		await pool.query(`DELETE FROM "${schemaName}".body_templates`);

		await migrateContentStore(pool, { schema: schemaName });

		expect(await applied(schemaName)).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
		expect((await store.getEntry(entry.id)).working.mdx).toBe("본문");
		// 이미 넣었던 초기 템플릿은 지운 뒤에도 되살리지 않는다.
		expect((await pool.query(`SELECT 1 FROM "${schemaName}".body_templates`)).rows).toHaveLength(0);
	});

	it("플러그인의 한 번만 하는 일은 동시에 불러도 한 번만 돌고, 실패하면 기록하지 않는다", async () => {
		const db = pluginDatabaseFor(pool, schemaName);
		let runs = 0;
		const results = await Promise.all(
			[1, 2, 3].map(() =>
				db.once("test:count", async (client) => {
					runs += 1;
					await client.query("SELECT 1");
				}),
			),
		);
		expect(runs).toBe(1);
		expect(results.filter(Boolean)).toHaveLength(1);

		await expect(
			db.once("test:fails", async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
		expect(await applied(schemaName)).not.toContain("test:fails");
		expect(await db.once("test:fails", async () => {})).toBe(true);
	});
});
