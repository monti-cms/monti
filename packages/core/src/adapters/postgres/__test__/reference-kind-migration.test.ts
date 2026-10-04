import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * 참조 종류 제약 좁히기(M10-3). 예전 저장소(종류에 `category`·`tag`가 있던 제약과 그 행)를 만들고 마이그레이션을 두 번 돌린다.
 * 컬렉션 이름에 기대지 않도록 행을 SQL로 직접 넣는다(다른 사이트 설정으로도 돈다).
 */
describe("entry_references kind migration", () => {
	let pool: Pool;
	let schemaName: string;

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateContentStore(pool, { schema: schemaName });
	});

	afterAll(async () => {
		await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const table = () => `"${schemaName}".entry_references`;

	const constraintDefs = async () =>
		(
			await pool.query<{ conname: string; def: string }>(
				`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
				 WHERE conrelid = to_regclass($1) AND contype = 'c' ORDER BY conname`,
				[`${schemaName}.entry_references`],
			)
		).rows;

	const insertEntry = async (id: string) => {
		await pool.query(
			`INSERT INTO "${schemaName}".entries (id, collection, version, created_at, updated_at)
			 VALUES ($1, 'legacy-test', 1, NOW(), NOW())`,
			[id],
		);
	};

	const insertReference = async (
		entryId: string,
		state: "working" | "published",
		kind: string,
		targetId: string,
		occurrences: unknown[],
		isStale = false,
	) => {
		await pool.query(
			`INSERT INTO ${table()} (entry_id, state, kind, target_id, target_entry_id, target_media_id, is_stale, occurrences)
			 VALUES ($1, $2, $3, $4, $4, NULL, $5, $6)`,
			[entryId, state, kind, targetId, isStale, JSON.stringify(occurrences)],
		);
	};

	/** 단계 기록을 지워 단계 기록이 생기기 전 저장소처럼 만든다. */
	const forgetSteps = () => pool.query(`DELETE FROM "${schemaName}".cms_migrations`);

	it("new stores only allow entry and media references", async () => {
		const defs = await constraintDefs();
		expect(defs.map((row) => row.def).join("\n")).not.toContain("category");
		expect(defs.map((row) => row.conname)).toEqual(
			expect.arrayContaining(["entry_references_kind_check", "entry_references_target_check"]),
		);
	});

	it("moves legacy category/tag rows into entry rows, then narrows the constraint; running again changes nothing", async () => {
		// 예전 저장소 모양으로 되돌린다: 이름 없는 예전 제약(자동 이름)과 category·tag 행.
		await pool.query(`
			ALTER TABLE ${table()} DROP CONSTRAINT entry_references_kind_check;
			ALTER TABLE ${table()} DROP CONSTRAINT entry_references_target_check;
			ALTER TABLE ${table()} ADD CONSTRAINT entry_references_kind_check CHECK (kind IN ('entry', 'media', 'category', 'tag'));
			ALTER TABLE ${table()} ADD CONSTRAINT entry_references_check CHECK (
				(kind = 'media' AND target_entry_id IS NULL AND target_media_id IS NOT NULL AND target_id = target_media_id) OR
				(kind IN ('entry', 'category', 'tag') AND target_entry_id IS NOT NULL AND target_media_id IS NULL AND target_id = target_entry_id)
			);
		`);
		const [source, onlyLegacy, both, twoLegacy] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
		for (const id of [source, onlyLegacy, both, twoLegacy]) await insertEntry(id);
		const metadata = (path: string, ordinal?: number) => ({
			type: "metadata",
			path,
			...(ordinal === undefined ? {} : { ordinal }),
		});
		const mdx = { type: "mdx", line: 3, column: 1 };
		// 1) 예전 행만 있는 대상.
		await insertReference(source, "working", "tag", onlyLegacy, [metadata("tagIds", 0)]);
		// 2) 같은 대상의 entry 행이 이미 있는 예전 행(위치가 다르고 오래된 참조).
		await insertReference(source, "working", "entry", both, [mdx]);
		await insertReference(source, "working", "category", both, [metadata("categoryId"), mdx], true);
		// 3) 같은 대상에 예전 행이 둘(category·tag).
		await insertReference(source, "published", "category", twoLegacy, [metadata("categoryId")]);
		await insertReference(source, "published", "tag", twoLegacy, [metadata("tagIds", 1)]);

		// 마이그레이션 전에도 읽기는 entry로 다룬다(새 코드를 먼저 배포해도 된다).
		const store = createContentStore(pool, { schema: schemaName });
		const before = await store.getWorkingReferences({ entryId: source });
		expect(before.every((reference) => reference.kind === "entry")).toBe(true);

		// 예전 저장소에는 단계 기록이 없다(이 단계가 아직 돌지 않았다).
		await forgetSteps();
		await migrateContentStore(pool, { schema: schemaName });
		const read = async () =>
			(
				await pool.query<{ state: string; kind: string; target_id: string; is_stale: boolean; occurrences: unknown }>(
					`SELECT state, kind, target_id, is_stale, occurrences FROM ${table()} WHERE entry_id = $1
					 ORDER BY state, target_id`,
					[source],
				)
			).rows;
		const after = await read();
		expect(after.map((row) => row.kind)).toEqual(["entry", "entry", "entry"]);
		const byTarget = new Map(after.map((row) => [row.target_id, row]));
		expect(byTarget.get(onlyLegacy)).toMatchObject({
			state: "working",
			is_stale: false,
			occurrences: [metadata("tagIds", 0)],
		});
		// entry 행의 위치 뒤에 없던 위치만 붙고, 하나라도 오래된 참조면 오래된 참조다.
		expect(byTarget.get(both)).toMatchObject({
			state: "working",
			is_stale: true,
			occurrences: [mdx, metadata("categoryId")],
		});
		expect(byTarget.get(twoLegacy)).toMatchObject({
			state: "published",
			occurrences: [metadata("categoryId"), metadata("tagIds", 1)],
		});

		const defs = await constraintDefs();
		expect(defs.map((row) => row.def).join("\n")).not.toContain("category");
		expect(defs.map((row) => row.conname)).toEqual(
			expect.arrayContaining(["entry_references_kind_check", "entry_references_target_check"]),
		);
		expect(defs.map((row) => row.conname)).not.toContain("entry_references_check");
		await expect(insertReference(source, "published", "tag", onlyLegacy, [])).rejects.toThrow(
			/entry_references_kind_check/,
		);

		// 여러 번 돌려도 같다(단계 기록이 없어 다시 돌아도).
		await migrateContentStore(pool, { schema: schemaName });
		await forgetSteps();
		await migrateContentStore(pool, { schema: schemaName });
		expect(await read()).toEqual(after);
		expect(await constraintDefs()).toEqual(defs);
	});
});
