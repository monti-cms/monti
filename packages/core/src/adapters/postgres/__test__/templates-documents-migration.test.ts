import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentOf, docOf } from "../../../../test/stored-content";
import { readStoredDocument, STORED_DOCUMENT_VERSION, unparsedDocument } from "../../../mdx/stored-document";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { migrateTemplatesToDocuments } from "../store/templates-documents-migration";
import { templateMdx } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const STEP = "0019_templates_documents";

/**
 * `0019_templates_documents`: a body template is a document and `mdx` is no longer written. A template with no readable document becomes the document of one
 * `unparsed` node holding its MDX, nothing fails because of one, and the text column stops being required. Each test puts a store from before back by writing
 * template rows the way earlier versions did (a text, and a document or none).
 */
describe(STEP, () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	/** A template row as an earlier version wrote it: its text, and its document (or none). */
	const legacyTemplate = async (mdx: string, doc: unknown | null) => {
		const id = randomUUID();
		await pool.query(
			`INSERT INTO "${schemaName}".body_templates (id, name, mdx, doc, version, created_at, updated_at)
			 VALUES ($1, $2, $3, $4::jsonb, 3, '2026-01-01', '2026-01-02')`,
			[id, unique("legacy"), mdx, doc === null ? null : JSON.stringify(doc)],
		);
		return id;
	};

	const run = async (log: (message: string) => void = () => undefined) => {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const result = await migrateTemplatesToDocuments(client, schemaName, { log });
			await client.query("COMMIT");
			return result;
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		} finally {
			client.release();
		}
	};

	const rawDoc = async (id: string) =>
		(await pool.query(`SELECT doc FROM "${schemaName}".body_templates WHERE id = $1`, [id])).rows[0]?.doc;

	it("is a step of the store, after the earlier ones and before the seed", () => {
		const index = CONTENT_STORE_MIGRATIONS.indexOf(STEP);
		expect(index).toBeGreaterThan(CONTENT_STORE_MIGRATIONS.indexOf("0018_link_entry_ids"));
		expect(CONTENT_STORE_MIGRATIONS.at(-1)).toBe("seed_initial_body_templates");
		expect(index).toBe(CONTENT_STORE_MIGRATIONS.length - 2);
	});

	it("gives a template with no document the unparsed document of its text, and keeps the text, version and date", async () => {
		const id = await legacyTemplate("Words\n\n<Unclosed", null);

		const result = await run();

		expect(result.unparsed).toContain(id);
		expect(await rawDoc(id)).toMatchObject({
			type: "doc",
			version: STORED_DOCUMENT_VERSION,
			content: [{ type: "unparsed", attrs: { format: "mdx", source: "Words\n\n<Unclosed" } }],
		});
		const template = await store.getTemplate(id);
		expect(template.doc.content[0]).toMatchObject({ type: "unparsed" });
		expect(template.version).toBe(3);
		expect(template.updatedAt.toISOString()).toBe("2026-01-02T00:00:00.000Z");
		expect(await templateMdx(pool, schemaName, id)).toBe("Words\n\n<Unclosed");
	});

	it("does the same for a document that cannot be read (an unknown version, or not a document at all)", async () => {
		const future = await legacyTemplate("Future\n", { type: "doc", version: 99, content: [] });
		const nonsense = await legacyTemplate("Nonsense\n", { hello: "world" });

		const result = await run();

		expect(result.unparsed).toEqual(expect.arrayContaining([future, nonsense]));
		expect(readStoredDocument(await rawDoc(future))?.content[0]).toMatchObject({
			type: "unparsed",
			attrs: { source: "Future\n" },
		});
		expect(readStoredDocument(await rawDoc(nonsense))?.content[0]).toMatchObject({
			type: "unparsed",
			attrs: { source: "Nonsense\n" },
		});
	});

	it("leaves a template that has a document exactly as it is, block ids included", async () => {
		const doc = JSON.parse(JSON.stringify(docOf("## Kept\n\nBody\n")));
		const id = await legacyTemplate("## Kept\n\nBody\n", doc);
		const before = await rawDoc(id);

		const result = await run();

		expect(result.unparsed).not.toContain(id);
		expect(await rawDoc(id)).toEqual(before);
		expect(contentOf((await store.getTemplate(id)).doc)).toEqual(contentOf(doc));
	});

	it("logs the templates it could not give a document, by id, and fails for none of them", async () => {
		const id = await legacyTemplate("<Open", null);
		const messages: string[] = [];

		await expect(run((message) => messages.push(message))).resolves.toBeDefined();

		expect(messages.some((message) => message.includes(id))).toBe(true);
	});

	it("makes the text column optional, so a template is written without it", async () => {
		await run();

		const created = await store.createTemplate({ name: unique("fresh"), doc: docOf("Fresh\n") });

		expect(await templateMdx(pool, schemaName, created.id)).toBeNull();
		const column = await pool.query<{ is_nullable: string }>(
			`SELECT is_nullable FROM information_schema.columns
			 WHERE table_schema = $1 AND table_name = 'body_templates' AND column_name = 'mdx'`,
			[schemaName],
		);
		expect(column.rows[0]?.is_nullable).toBe("YES");
	});

	it("changes nothing, and writes no row, when it runs a second time", async () => {
		await legacyTemplate("<Again", null);
		await run();
		const rows = async () =>
			(await pool.query(`SELECT id, doc, xmin::text FROM "${schemaName}".body_templates ORDER BY id`)).rows;
		const once = await rows();

		const again = await run();

		expect(again.unparsed).toEqual([]);
		expect(await rows()).toEqual(once);
	});

	it("reaches every template whatever the batch size", async () => {
		const ids: string[] = [];
		for (let index = 0; index < 5; index += 1) ids.push(await legacyTemplate(`Batch ${index}\n`, null));

		for (const batchSize of [1, 2, 1000]) {
			await pool.query(`UPDATE "${schemaName}".body_templates SET doc = NULL WHERE id = ANY($1::uuid[])`, [ids]);
			const client = await pool.connect();
			try {
				const result = await migrateTemplatesToDocuments(client, schemaName, { batchSize, log: () => undefined });
				expect(result.unparsed).toEqual(expect.arrayContaining(ids));
			} finally {
				client.release();
			}
			for (const [index, id] of ids.entries()) {
				expect(readStoredDocument(await rawDoc(id))?.content[0]).toMatchObject({
					type: "unparsed",
					attrs: { source: `Batch ${index}\n` },
				});
			}
		}
	});

	it("runs as a step of the store: a store from before it ends with every template a document", async () => {
		// Put the store back to before this step: its record gone and the text column required again, with a template of that time.
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);
		await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = '' WHERE mdx IS NULL`);
		await pool.query(`ALTER TABLE "${schemaName}".body_templates ALTER COLUMN mdx SET NOT NULL`);
		const id = await legacyTemplate("Before\n\n<Open", null);

		await migrateContentStore(pool, { schema: schemaName });

		const { rows } = await pool.query<{ id: string; doc: unknown }>(
			`SELECT id, doc FROM "${schemaName}".body_templates`,
		);
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) expect(readStoredDocument(row.doc), row.id).toBeDefined();
		expect(readStoredDocument(await rawDoc(id))?.content).toEqual([
			expect.objectContaining({ ...unparsedDocument("Before\n\n<Open").content[0], id: expect.any(String) }),
		]);
		await expect(store.createTemplate({ name: unique("after"), doc: docOf("After\n") })).resolves.toBeDefined();
		const applied = await pool.query(`SELECT 1 FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);
		expect(applied.rowCount).toBe(1);
	});
});
