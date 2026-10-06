import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createContentStore } from "../content-store";
import { migrateForEarlierSteps } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/**
 * Narrowing the reference kind constraint. Builds a legacy store (the constraint that had `category` and `tag` kinds, plus its rows) and runs the migration twice.
 * Rows are inserted directly with SQL so the test does not depend on collection names (it also runs against other site configs).
 */
describe("entry_references kind migration", () => {
	let pool: Pool;
	let schemaName: string;

	beforeAll(async () => {
		({ pool, schemaName } = await createIsolatedTestPool());
		await migrateForEarlierSteps(pool, schemaName);
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

	/** Clears the step records so the store looks like one from before step records existed. */
	const forgetSteps = () => pool.query(`DELETE FROM "${schemaName}".cms_migrations`);

	it("new stores only allow entry and media references", async () => {
		const defs = await constraintDefs();
		expect(defs.map((row) => row.def).join("\n")).not.toContain("category");
		expect(defs.map((row) => row.conname)).toEqual(
			expect.arrayContaining(["entry_references_kind_check", "entry_references_target_check"]),
		);
	});

	it("moves legacy category/tag rows into entry rows, then narrows the constraint; running again changes nothing", async () => {
		// Revert to the legacy store shape: the old unnamed constraint (auto-generated name) and category/tag rows.
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
		// 1) A target that has only legacy rows.
		await insertReference(source, "working", "tag", onlyLegacy, [metadata("tagIds", 0)]);
		// 2) A legacy row whose target already has an entry row (different position and a stale reference).
		await insertReference(source, "working", "entry", both, [mdx]);
		await insertReference(source, "working", "category", both, [metadata("categoryId"), mdx], true);
		// 3) Two legacy rows on the same target (category and tag).
		await insertReference(source, "published", "category", twoLegacy, [metadata("categoryId")]);
		await insertReference(source, "published", "tag", twoLegacy, [metadata("tagIds", 1)]);

		// Even before the migration, reads treat them as entry (the new code may be deployed first).
		const store = createContentStore(pool, { schema: schemaName });
		const before = await store.getWorkingReferences({ entryId: source });
		expect(before.every((reference) => reference.kind === "entry")).toBe(true);

		// A legacy store has no step record (this step has not run yet).
		await forgetSteps();
		await migrateForEarlierSteps(pool, schemaName);
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
		// Only positions missing from the entry row are appended after its positions, and if any is a stale reference the result is stale.
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

		// Running it repeatedly gives the same result (even when it runs again because there is no step record).
		await migrateForEarlierSteps(pool, schemaName);
		await forgetSteps();
		await migrateForEarlierSteps(pool, schemaName);
		expect(await read()).toEqual(after);
		expect(await constraintDefs()).toEqual(defs);
	});
});
