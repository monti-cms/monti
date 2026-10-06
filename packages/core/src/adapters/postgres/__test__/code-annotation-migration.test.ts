import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { contentOf } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import { computeContentHash } from "../../../core/content-hash";
import type { JsonValue } from "../../../core/types";
import { forEachBlock } from "../../../mdx/block-ids";
import { bodyFromMdx, readStoredDocument, type StoredDocument } from "../../../mdx/stored-document";
import { createContentService } from "../../../services/content-service";
import { createContentStore, type Entry, migrateContentStore } from "../content-store";
import { migrateCodeAnnotations } from "../store/code-annotation-migration";
import { extractVisibleText } from "../store/rows";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { publishDraft } from "./seed";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const STEP = "0015_code_annotations";

/** The text of the code fence as a version 1 document kept it: the annotation comments are part of the value. */
const RAW_VALUE = ["// @line plus", "const needle = 1;", "// @document fold {re:/old/g}", "const old = 2;"].join("\n");

/** A body with a code fence written the way it was before this step, and the text a save writes for it (rules first, ranges explicit). */
const legacyMdx = (value = RAW_VALUE) => `Intro\n\n\`\`\`ts title="a.ts"\n${value}\n\`\`\`\n\nOutro\n`;
const LEGACY = legacyMdx();
const WRITTEN = [
	"Intro",
	"",
	'```ts title="a.ts"',
	"// @document fold {re:/old/g}",
	"// @line plus {0-0}",
	"const needle = 1;",
	"const old = 2;",
	"```",
	"",
	"Outro",
	"",
].join("\n");

/** The document a version 1 store kept: the same blocks (and ids), a code block as `language`, `meta`, `value` with the comments, and its meta keys. */
const legacyDocOf = (doc: StoredDocument | null, values: readonly string[] = [RAW_VALUE]) => {
	if (!doc) throw new Error("expected a stored document");
	let index = 0;
	return {
		type: "doc",
		version: 1,
		content: doc.content.map((node) =>
			node.type === "codeBlock"
				? {
						...node,
						attrs: { language: node.attrs?.language, meta: node.attrs?.meta, title: "a.ts", value: values[index++] },
					}
				: node,
		),
	};
};

/**
 * `0015_code_annotations`: lifts stored documents to version 2 (a code block as its code and its annotations as data), writes their MDX from them, and recomputes the
 * hash and search text. A save already stores bodies this way, so each test puts a store from before back by writing version 1 documents with the old fence text,
 * a stale hash and search text, takes the step's record away and runs the migration again.
 */
describe("0015_code_annotations", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let service: ReturnType<typeof createContentService<Entry>>;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store);
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = await service.createDraft({ collection: to, slug: unique(to), metadata, mdx: "Body" });
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const createDraft = async (mdx: string) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("post"),
			metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
			mdx,
		});

	const publishedWith = async (mdx: string) => {
		const draft = await createDraft(mdx);
		return publishDraft(store, { id: draft.id, expectedVersion: draft.version });
	};

	interface StoredRow {
		entry_id: string;
		state: string;
		metadata: JsonValue;
		mdx: string;
		doc: unknown;
		schema_version: number;
		content_hash: string;
		search_text: string;
		updated_at: Date;
		translation: { version: number; baseSource: string; baseDoc?: unknown } | null;
		xmin: string;
	}

	const COLUMNS =
		"entry_id, state, metadata, mdx, doc, schema_version, content_hash, search_text, updated_at, translation, xmin::text";

	const row = async (entryId: string, state: "working" | "published") =>
		(
			await pool.query<StoredRow>(
				`SELECT ${COLUMNS} FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];

	const allRows = async () =>
		(await pool.query<StoredRow>(`SELECT ${COLUMNS} FROM "${schemaName}".entry_bodies ORDER BY entry_id, state`)).rows;

	/** What a body looked like before the step: the old text and document, and a hash and search text that are not the current ones. */
	const setLegacy = (entryId: string, mdx: string, doc: unknown, state?: "working" | "published") =>
		pool.query(
			`UPDATE "${schemaName}".entry_bodies SET mdx = $1, doc = $2::jsonb, content_hash = 'stale-' || state, search_text = 'stale'
			 WHERE entry_id = $3 AND ($4::text IS NULL OR state = $4)`,
			[mdx, doc === null ? null : JSON.stringify(doc), entryId, state ?? null],
		);

	/** A published entry (working and published bodies alike) as a version 1 store kept it. */
	const legacyPublished = async (mdx = LEGACY, values: readonly string[] = [RAW_VALUE]) => {
		const published = await publishedWith(mdx);
		const doc = (await row(published.id, "working"))?.doc as StoredDocument;
		await setLegacy(published.id, mdx, legacyDocOf(readStoredDocument(doc) ?? null, values));
		return published;
	};

	const rewind = () => pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);

	const run = async () => {
		await rewind();
		await migrateContentStore(pool, { schema: schemaName });
	};

	const hasUnpublishedChanges = async (entryId: string) => {
		const { items } = await store.listEntries({ collection: contentCollection });
		const item = items.find((candidate) => candidate.id === entryId);
		if (!item) throw new Error(`entry ${entryId} is not in the list`);
		return item.hasUnpublishedChanges;
	};

	const withMigrationClient = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
		const client = await pool.connect();
		try {
			return await work(client);
		} finally {
			client.release();
		}
	};

	const docOf = (value: unknown): StoredDocument => {
		const doc = readStoredDocument(value);
		if (!doc) throw new Error("expected a stored document");
		return doc;
	};

	const idList = (doc: StoredDocument) => {
		const ids: (string | undefined)[] = [];
		forEachBlock(doc.content, (node) => ids.push(node.id));
		return ids;
	};

	const codeBlockOf = (doc: StoredDocument) => {
		const block = doc.content.find((node) => node.type === "codeBlock");
		if (!block) throw new Error("no code block");
		return block;
	};

	it("is a recorded migration step that runs after the block id step and before the template seed", () => {
		expect(CONTENT_STORE_MIGRATIONS).toContain(STEP);
		expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBe(CONTENT_STORE_MIGRATIONS.indexOf("0014_block_ids") + 1);
		expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBeLessThan(
			CONTENT_STORE_MIGRATIONS.indexOf("seed_initial_body_templates"),
		);
		expect(CONTENT_STORE_MIGRATIONS.at(-1)).toBe("seed_initial_body_templates");
	});

	it("lifts a version 1 document to version 2: the code without its comments, the annotations as data", async () => {
		const published = await legacyPublished();
		const legacyDoc = (await row(published.id, "working"))?.doc as { version: number };
		expect(legacyDoc.version).toBe(1);

		await run();

		for (const state of ["working", "published"] as const) {
			const stored = await row(published.id, state);
			const doc = docOf(stored?.doc);
			expect(doc.version).toBe(2);
			expect(codeBlockOf(doc).attrs).toEqual({
				annotations: {
					lines: [{ end: 1, name: "plus", start: 0 }],
					rules: [{ flags: "g", name: "fold", pattern: "old", scope: "document" }],
				},
				code: "const needle = 1;\nconst old = 2;",
				language: "ts",
				meta: 'title="a.ts"',
			});
			expect(contentOf(doc)).toEqual(contentOf(bodyFromMdx(LEGACY).doc));
		}
	});

	it("writes the MDX from the document, with the annotation comments in the form Monti writes them", async () => {
		const published = await legacyPublished();

		await run();

		expect((await row(published.id, "working"))?.mdx).toBe(WRITTEN);
		expect((await row(published.id, "published"))?.mdx).toBe(WRITTEN);
		expect(bodyFromMdx(WRITTEN).mdx).toBe(WRITTEN);
	});

	it("recomputes the hash, which the same content saved now has, and the search text without annotation comments", async () => {
		const published = await legacyPublished();

		await run();

		for (const state of ["working", "published"] as const) {
			const stored = await row(published.id, state);
			expect(stored?.content_hash).toBe(
				computeContentHash(stored?.metadata ?? {}, WRITTEN, stored?.schema_version ?? 1),
			);
			expect(stored?.content_hash).toBe(published[state === "working" ? "working" : "published"]?.contentHash);
			expect(stored?.search_text).toBe(extractVisibleText(WRITTEN));
			expect(stored?.search_text).toContain("const needle = 1;");
			expect(stored?.search_text).not.toContain("@line");
			expect(stored?.search_text).not.toContain("@document");
		}
	});

	it("keeps the block ids of the document", async () => {
		const published = await legacyPublished();
		const before = idList(docOf((await row(published.id, "working"))?.doc));
		const beforePublished = idList(docOf((await row(published.id, "published"))?.doc));
		expect(before).toHaveLength(3);

		await run();

		expect(idList(docOf((await row(published.id, "working"))?.doc))).toEqual(before);
		expect(idList(docOf((await row(published.id, "published"))?.doc))).toEqual(beforePublished);
	});

	it("does not touch versions or modified dates, and keeps what the list shows as unpublished changes", async () => {
		const same = await legacyPublished();
		const edited = await legacyPublished(legacyMdx(`${RAW_VALUE}\nconst more = 3;`), [`${RAW_VALUE}\nconst more = 3;`]);
		// The edited entry's working body differs from its published body.
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET mdx = $1, doc = $2::jsonb WHERE entry_id = $3 AND state = 'working'`,
			[
				legacyMdx(`${RAW_VALUE}\nconst changed = 4;`),
				JSON.stringify(
					legacyDocOf(docOf((await row(edited.id, "working"))?.doc), [`${RAW_VALUE}\nconst changed = 4;`]),
				),
				edited.id,
			],
		);
		const workingBefore = await row(same.id, "working");
		const publishedBefore = await row(same.id, "published");

		await run();

		const after = await store.getEntry(same.id);
		expect(after.version).toBe(same.version);
		expect(after.updatedAt.getTime()).toBe(same.updatedAt.getTime());
		expect((await row(same.id, "working"))?.updated_at.getTime()).toBe(workingBefore?.updated_at.getTime());
		expect((await row(same.id, "published"))?.updated_at.getTime()).toBe(publishedBefore?.updated_at.getTime());
		expect(await hasUnpublishedChanges(same.id)).toBe(false);
		expect(await hasUnpublishedChanges(edited.id)).toBe(true);
	});

	it("lifts the stored document of a translation's base source and writes the base source from it", async () => {
		const published = await legacyPublished();
		const baseDoc = (await row(published.id, "working"))?.doc;
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[JSON.stringify({ version: 3, baseSource: LEGACY, baseDoc }), published.id],
		);

		await run();

		const stored = await row(published.id, "working");
		expect(stored?.translation?.version).toBe(3);
		expect(stored?.translation?.baseSource).toBe(WRITTEN);
		expect(stored?.translation?.baseSource).toBe(stored?.mdx);
		const lifted = docOf(stored?.translation?.baseDoc);
		expect(lifted.version).toBe(2);
		expect(codeBlockOf(lifted).attrs?.code).toBe("const needle = 1;\nconst old = 2;");
		// The base is the same document as the body, with the same ids, so the translation screen sees no change.
		expect(lifted).toEqual(docOf(stored?.doc));
	});

	it("writes a base source that has no document the way the source is written", async () => {
		const published = await legacyPublished();
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[JSON.stringify({ version: 2, baseSource: LEGACY }), published.id],
		);
		const unparsable = await legacyPublished();
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[JSON.stringify({ version: 3, baseSource: "Words\n<Unclosed", baseDoc: null }), unparsable.id],
		);

		await run();

		expect((await row(published.id, "working"))?.translation).toEqual({ version: 2, baseSource: WRITTEN });
		expect((await row(unparsable.id, "working"))?.translation).toEqual({
			version: 3,
			baseSource: "Words\n<Unclosed",
			baseDoc: null,
		});
	});

	it("leaves a body whose document cannot be read as it is, logs it, and still recomputes its hash", async () => {
		const draft = await createDraft(LEGACY);
		const unreadable = { type: "doc", version: 99, content: [] };
		await setLegacy(draft.id, LEGACY, unreadable);
		const fine = await legacyPublished();
		const messages: string[] = [];

		await withMigrationClient((client) =>
			migrateCodeAnnotations(client, schemaName, { log: (message) => messages.push(message) }),
		);

		const stored = await row(draft.id, "working");
		expect(stored?.doc).toEqual(unreadable);
		expect(stored?.mdx).toBe(LEGACY);
		expect(stored?.content_hash).toBe(computeContentHash(stored?.metadata ?? {}, LEGACY, stored?.schema_version ?? 1));
		expect(messages.filter((message) => message.includes(`${draft.id}/working`))).toHaveLength(1);
		expect((await row(fine.id, "working"))?.mdx).toBe(WRITTEN);
		expect(messages.some((message) => message.includes(fine.id))).toBe(false);
	});

	it("recomputes the hash and search text of a body without a document, and leaves its text alone", async () => {
		const broken = await createDraft("가\n<Unclosed");
		await setLegacy(broken.id, "가\n<Unclosed", null);
		const frontMatter = await createDraft("---\ntitle: x\n---\n\n```ts\n// @line plus\nconst a = 1;\n```\n");
		await setLegacy(frontMatter.id, "---\ntitle: x\n---\n\n```ts\n// @line plus\nconst a = 1;\n```\n", null);
		const messages: string[] = [];

		await withMigrationClient((client) =>
			migrateCodeAnnotations(client, schemaName, { log: (message) => messages.push(message) }),
		);

		for (const [entry, mdx] of [
			[broken, "가\n<Unclosed"],
			[frontMatter, "---\ntitle: x\n---\n\n```ts\n// @line plus\nconst a = 1;\n```\n"],
		] as const) {
			const stored = await row(entry.id, "working");
			expect(stored?.mdx).toBe(mdx);
			expect(stored?.doc).toBeNull();
			expect(stored?.content_hash).toBe(computeContentHash(stored?.metadata ?? {}, mdx, stored?.schema_version ?? 1));
			expect(stored?.search_text).toBe(extractVisibleText(mdx));
		}
		// A body that never had a document was logged by the step that gave documents.
		expect(messages.filter((message) => message.includes(broken.id) || message.includes(frontMatter.id))).toEqual([]);
	});

	it("does not write a body that has no code block, or one that is already in the current form", async () => {
		const plain = await publishedWith("Just words\n\n- one\n- two\n");
		const current = await publishedWith(WRITTEN);
		const rowsBefore = [
			await row(plain.id, "working"),
			await row(plain.id, "published"),
			await row(current.id, "working"),
			await row(current.id, "published"),
		];

		await run();

		expect([
			await row(plain.id, "working"),
			await row(plain.id, "published"),
			await row(current.id, "working"),
			await row(current.id, "published"),
		]).toEqual(rowsBefore);
	});

	it("changes nothing, and writes no row, when it runs a second time", async () => {
		await legacyPublished();
		const draft = await createDraft(LEGACY);
		await setLegacy(draft.id, LEGACY, legacyDocOf(docOf((await row(draft.id, "working"))?.doc)));
		const published = await legacyPublished();
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[
				JSON.stringify({ version: 3, baseSource: LEGACY, baseDoc: (await row(published.id, "working"))?.doc }),
				published.id,
			],
		);
		const broken = await createDraft("가\n<Unclosed");
		await setLegacy(broken.id, "가\n<Unclosed", null);
		const template = await store.createTemplate({ name: unique("again"), mdx: LEGACY });
		await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1, doc = $2::jsonb WHERE id = $3`, [
			LEGACY,
			JSON.stringify(legacyDocOf(template.doc)),
			template.id,
		]);

		await run();
		const once = { bodies: await allRows(), templates: await store.listTemplates() };
		const templateRows = (await pool.query(`SELECT id, xmin::text FROM "${schemaName}".body_templates ORDER BY id`))
			.rows;
		await run();

		// The row versions (`xmin`) are included: not even rewritten with the same value.
		expect(await allRows()).toEqual(once.bodies);
		expect(await store.listTemplates()).toEqual(once.templates);
		expect((await pool.query(`SELECT id, xmin::text FROM "${schemaName}".body_templates ORDER BY id`)).rows).toEqual(
			templateRows,
		);
		expect(once.bodies.some((stored) => (stored.doc as { version?: number } | null)?.version === 2)).toBe(true);
	});

	describe("body templates", () => {
		const legacyTemplate = async (mdx: string, values: readonly string[]) => {
			const template = await store.createTemplate({ name: unique("template"), mdx });
			await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1, doc = $2::jsonb WHERE id = $3`, [
				mdx,
				JSON.stringify(legacyDocOf(template.doc, values)),
				template.id,
			]);
			return template;
		};

		it("lifts the document of a template and writes its MDX from it, leaving its version and date alone", async () => {
			const template = await legacyTemplate(LEGACY, [RAW_VALUE]);

			await run();

			const after = await store.getTemplate(template.id);
			expect(after.mdx).toBe(WRITTEN);
			expect(after.doc?.version).toBe(2);
			expect(codeBlockOf(after.doc as StoredDocument).attrs?.code).toBe("const needle = 1;\nconst old = 2;");
			expect(idList(after.doc as StoredDocument)).toEqual(idList(template.doc as StoredDocument));
			expect(after.version).toBe(template.version);
			expect(after.updatedAt.getTime()).toBe(template.updatedAt.getTime());
		});

		it("leaves a template that has no document, or one that cannot be read, as it is", async () => {
			const broken = await store.createTemplate({ name: unique("broken"), mdx: "Words\n\n<Unclosed" });
			const unreadable = await store.createTemplate({ name: unique("unreadable"), mdx: "Words\n" });
			await pool.query(`UPDATE "${schemaName}".body_templates SET doc = $1::jsonb WHERE id = $2`, [
				JSON.stringify({ type: "doc", version: 99, content: [] }),
				unreadable.id,
			]);
			const messages: string[] = [];

			await withMigrationClient((client) =>
				migrateCodeAnnotations(client, schemaName, { log: (message) => messages.push(message) }),
			);

			expect((await store.getTemplate(broken.id)).doc).toBeNull();
			expect((await store.getTemplate(broken.id)).mdx).toBe("Words\n\n<Unclosed");
			expect((await store.getTemplate(unreadable.id)).mdx).toBe("Words\n");
			expect(messages.filter((message) => message.includes(`body_templates ${unreadable.id}`))).toHaveLength(1);
		});
	});

	describe("batches", () => {
		it("reaches every body and template whatever the batch size", async () => {
			const entries: Entry[] = [];
			for (let index = 0; index < 5; index += 1) {
				const value = `// @line plus\nconst item${index} = ${index};`;
				entries.push(await legacyPublished(legacyMdx(value), [value]));
			}
			const templates = [];
			for (let index = 0; index < 5; index += 1) {
				const value = `// @line plus\nconst t${index} = ${index};`;
				const template = await store.createTemplate({ name: unique("batch"), mdx: legacyMdx(value) });
				await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1, doc = $2::jsonb WHERE id = $3`, [
					legacyMdx(value),
					JSON.stringify(legacyDocOf(template.doc, [value])),
					template.id,
				]);
				templates.push(template);
			}
			const legacyRows = new Map<string, unknown>();
			for (const entry of entries) {
				for (const state of ["working", "published"] as const) {
					const stored = await row(entry.id, state);
					legacyRows.set(`${entry.id}/${state}`, { mdx: stored?.mdx, doc: stored?.doc });
				}
			}
			const legacyTemplateRows = (await pool.query(`SELECT id, mdx, doc FROM "${schemaName}".body_templates`)).rows;

			for (const batchSize of [1, 2, 1000]) {
				await withMigrationClient((client) => migrateCodeAnnotations(client, schemaName, { batchSize }));

				for (const [index, entry] of entries.entries()) {
					for (const state of ["working", "published"] as const) {
						const stored = await row(entry.id, state);
						expect(stored?.mdx).toContain(`// @line plus {0-0}\nconst item${index} = ${index};`);
						expect(codeBlockOf(docOf(stored?.doc)).attrs?.code).toBe(`const item${index} = ${index};`);
						expect(stored?.search_text).not.toContain("@line");
					}
				}
				for (const [index, template] of templates.entries()) {
					const after = await store.getTemplate(template.id);
					expect(codeBlockOf(after.doc as StoredDocument).attrs?.code).toBe(`const t${index} = ${index};`);
				}

				// Put the old rows back for the next batch size.
				for (const entry of entries) {
					for (const state of ["working", "published"] as const) {
						const old = legacyRows.get(`${entry.id}/${state}`) as { mdx: string; doc: unknown };
						await setLegacy(entry.id, old.mdx, old.doc, state);
					}
				}
				for (const old of legacyTemplateRows) {
					await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1, doc = $2::jsonb WHERE id = $3`, [
						old.mdx,
						JSON.stringify(old.doc),
						old.id,
					]);
				}
			}
		});
	});
});
