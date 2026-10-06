import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf, docOf } from "../../../../test/stored-content";
import { cmsConfig } from "../../../config/resolved";
import { readStoredDocument } from "../../../mdx/stored-document";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { templateMdx } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const SEEDED = cmsConfig.seed?.templates ?? [];

/** The two real paths templates take through migration, with nothing deleted or prepared by hand. */
describe("templates through migration", () => {
	let pool: Pool;
	let schemaName: string;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	it.skipIf(SEEDED.length === 0)(
		"a fresh install seeds doc-only templates after every earlier step, and running everything again changes nothing",
		async () => {
			await migrateContentStore(pool, { schema: schemaName });

			const applied = (await pool.query<{ name: string }>(`SELECT name FROM "${schemaName}".cms_migrations`)).rows;
			expect(applied.map((row) => row.name).sort()).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
			const store = createContentStore(pool, { schema: schemaName });
			const templates = await store.listTemplates();
			expect(templates.length).toBeGreaterThanOrEqual(SEEDED.length);
			for (const template of templates) {
				expect(readStoredDocument(template.doc)).toBeDefined();
				expect(await templateMdx(pool, schemaName, template.id)).toBeNull();
			}

			// A store whose step records are gone runs every step over those rows (they have no text): nothing crashes and nothing changes.
			const before = (await pool.query(`SELECT id, mdx, doc, version FROM "${schemaName}".body_templates ORDER BY id`))
				.rows;
			await pool.query(`DELETE FROM "${schemaName}".cms_migrations`);
			await migrateContentStore(pool, { schema: schemaName });
			const after = (await pool.query(`SELECT id, mdx, doc, version FROM "${schemaName}".body_templates ORDER BY id`))
				.rows;
			expect(after).toEqual(before);
		},
	);

	it("an upgrade from a store at 0012, with templates that have text, ends with every template a document", async () => {
		const upgrade = await createIsolatedTestPool();
		try {
			const run = () => migrateContentStore(upgrade.pool, { schema: upgrade.schemaName });
			await run();
			// Put the store back to 0012: the later steps forgotten, no document columns, text required, templates as that version wrote them.
			const q = (sql: string, values: unknown[] = []) => upgrade.pool.query(sql, values);
			const s = upgrade.schemaName;
			await q(`DELETE FROM "${s}".body_templates`);
			await q(`DELETE FROM "${s}".cms_migrations WHERE name >= '0013' AND name < '0020'`);
			await q(`DELETE FROM "${s}".cms_migrations WHERE name = 'seed_initial_body_templates'`);
			await q(`ALTER TABLE "${s}".body_templates DROP COLUMN doc`);
			await q(`ALTER TABLE "${s}".entry_bodies DROP COLUMN doc`);
			await q(`ALTER TABLE "${s}".body_templates ALTER COLUMN mdx SET NOT NULL`);
			const good = randomUUID();
			const soft = randomUUID();
			const broken = randomUUID();
			for (const [id, name, mdx] of [
				[good, "good", "## Review\n\nWhat I learned\n"],
				[soft, "soft", "One line\nnext line\n"],
				[broken, "broken", "Words\n\n<Unclosed"],
			] as const) {
				await q(
					`INSERT INTO "${s}".body_templates (id, name, mdx, version, created_at, updated_at) VALUES ($1, $2, $3, 4, '2026-01-01', '2026-01-02')`,
					[id, name, mdx],
				);
			}

			await run();

			const store = createContentStore(upgrade.pool, { schema: s });
			const byId = new Map((await store.listTemplates()).map((template) => [template.id, template]));
			expect(contentOf(byId.get(good)?.doc)).toEqual(contentOf(docOf("## Review\n\nWhat I learned\n")));
			expect(byId.get(soft)?.doc.content[0]).toMatchObject({ type: "paragraph" });
			expect(byId.get(broken)?.doc.content).toEqual([
				expect.objectContaining({ type: "unparsed", attrs: { format: "mdx", source: "Words\n\n<Unclosed" } }),
			]);
			for (const id of [good, soft, broken]) {
				expect(byId.get(id)?.version).toBe(4);
				expect(byId.get(id)?.updatedAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
			}
			const names = (await q(`SELECT name FROM "${s}".cms_migrations`)).rows.map((row) => row.name);
			expect(names.sort()).toEqual([...CONTENT_STORE_MIGRATIONS].sort());
			// The text of the old rows is still in the column, and the mdx column is optional now.
			expect(await templateMdx(upgrade.pool, s, broken)).toBe("Words\n\n<Unclosed");
			await expect(store.createTemplate({ name: "after", doc: docOf("After\n") })).resolves.toBeDefined();
		} finally {
			await dropIsolatedTestPool(upgrade.pool, upgrade.schemaName);
		}
	});
});
