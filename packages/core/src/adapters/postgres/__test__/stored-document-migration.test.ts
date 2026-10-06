import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { contentOf, docOf } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import type { Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import type { JsonValue } from "../../../core/types";
import { bodyFromMdx } from "../../../mdx/stored-document";
import { createContentService } from "../../../services/content-service";
import { createContentStore } from "../content-store";
import { mdxContentHash, mdxSearchText } from "../store/mdx-body";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { migrateStoredDocuments } from "../store/stored-document-migration";
import { migrateForEarlierSteps, templateMdx } from "./template-rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const STEP = "0013_stored_documents";

/** The same content in a spelling the serializer does not write, and the text a save writes for it. */
const LEGACY = "Title\n=====\n\nSome _emphasis_ here\\\nand a break\n\n* one\n* two\n";
const WRITTEN = "# Title\n\nSome *emphasis* here<br />\nand a break\n\n- one\n- two\n";

/**
 * `0013_stored_documents`: gives every body (and template) its document, writes its MDX from it, and recomputes the hash and search text.
 * A save already stores bodies this way, so each test puts a store from before back by writing legacy rows directly (no document, an old spelling,
 * a stale hash and search text), takes the step's record away and runs the migration again.
 */
describe("0013_stored_documents", () => {
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
		await migrateForEarlierSteps(pool, schemaName);
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
		const draft = await service.createDraft({
			collection: to,
			slug: unique(to),
			metadata,
			format: "mdx",
			body: "Body",
		});
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
			format: "mdx",
			body: mdx,
		});

	const publishedWith = async (mdx: string) => {
		const draft = await createDraft(mdx);
		return publishDraft(store, { id: draft.id, expectedVersion: draft.version });
	};

	/** What a body looked like before the step: the text as given, no document, and a hash and search text that are not the current ones. */
	const setLegacy = (entryId: string, mdx: string, state?: "working" | "published") =>
		pool.query(
			`UPDATE "${schemaName}".entry_bodies SET mdx = $1, doc = NULL, content_hash = 'stale-' || state, search_text = 'stale'
			 WHERE entry_id = $2 AND ($3::text IS NULL OR state = $3)`,
			[mdx, entryId, state ?? null],
		);

	const legacyPublished = async (mdx: string) => {
		const published = await publishedWith(mdx);
		await setLegacy(published.id, mdx);
		return published;
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
		translation: { version: number; baseSource: string } | null;
	}

	const row = async (entryId: string, state: "working" | "published") =>
		(
			await pool.query<StoredRow>(
				`SELECT entry_id, state, metadata, mdx, doc, schema_version, content_hash, search_text, updated_at, translation
				 FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];

	const allRows = async () =>
		(
			await pool.query<StoredRow>(
				`SELECT entry_id, state, metadata, mdx, doc, schema_version, content_hash, search_text, updated_at, translation
				 FROM "${schemaName}".entry_bodies ORDER BY entry_id, state`,
			)
		).rows;

	/** Puts the store back before the step: its record is gone, and (with `dropColumns`) so are its columns. */
	const rewind = async (options: { dropColumns?: boolean } = {}) => {
		if (options.dropColumns) {
			await pool.query(`ALTER TABLE "${schemaName}".entry_bodies DROP COLUMN doc`);
			await pool.query(`ALTER TABLE "${schemaName}".body_templates DROP COLUMN doc`);
		}
		await pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);
	};

	const run = async (options: { dropColumns?: boolean } = {}) => {
		await rewind(options);
		await migrateForEarlierSteps(pool, schemaName);
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

	it("is a recorded migration step that runs after the soft line ending step and before the template seed", () => {
		expect(CONTENT_STORE_MIGRATIONS).toContain(STEP);
		expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBeGreaterThan(
			CONTENT_STORE_MIGRATIONS.indexOf("0012_soft_line_endings"),
		);
		expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBeLessThan(
			CONTENT_STORE_MIGRATIONS.indexOf("seed_initial_body_templates"),
		);
		expect(CONTENT_STORE_MIGRATIONS.at(-1)).toBe("seed_initial_body_templates");
	});

	it("adds the column to bodies and templates when a store has none", async () => {
		const published = await legacyPublished(LEGACY);

		await run({ dropColumns: true });

		const columns = await pool.query<{ table_name: string; data_type: string; is_nullable: string }>(
			`SELECT table_name, data_type, is_nullable FROM information_schema.columns
			 WHERE table_schema = $1 AND column_name = 'doc' ORDER BY table_name`,
			[schemaName],
		);
		expect(columns.rows).toEqual([
			{ table_name: "body_templates", data_type: "jsonb", is_nullable: "YES" },
			{ table_name: "entry_bodies", data_type: "jsonb", is_nullable: "YES" },
		]);
		expect(contentOf((await row(published.id, "working"))?.doc)).toEqual(contentOf(bodyFromMdx(LEGACY).doc));
	});

	it("gives every body its document, writes its MDX from it, and recomputes the hash and search text", async () => {
		const published = await legacyPublished(LEGACY);
		const draft = await createDraft("Only a draft\n\nwith two paragraphs");
		await setLegacy(draft.id, "Only a draft\nwith two paragraphs");

		await run();

		for (const [entryId, state, legacy] of [
			[published.id, "working", LEGACY],
			[published.id, "published", LEGACY],
			[draft.id, "working", "Only a draft\nwith two paragraphs"],
		] as const) {
			const stored = await row(entryId, state);
			const expected = bodyFromMdx(legacy);
			expect(expected.doc).not.toBeNull();
			expect(stored?.mdx).toBe(expected.mdx);
			expect(contentOf(stored?.doc)).toEqual(contentOf(expected.doc));
			expect(stored?.content_hash).toBe(
				mdxContentHash(stored?.metadata ?? {}, expected.mdx, stored?.schema_version ?? 1),
			);
			expect(stored?.search_text).toBe(mdxSearchText(expected.mdx));
		}
		expect((await row(published.id, "working"))?.mdx).toBe(WRITTEN);
		expect((await row(published.id, "working"))?.search_text).toContain("emphasis");
		// The hash did not change with the spelling: it is the one a save of the same content gives.
		expect((await row(published.id, "working"))?.content_hash).toBe(published.working.contentHash);
	});

	it("keeps what the list shows as unpublished changes", async () => {
		const same = await legacyPublished(LEGACY);
		const edited = await legacyPublished(LEGACY);
		await setLegacy(edited.id, `${LEGACY}\nMore words\n`, "working");

		await run();

		expect(await hasUnpublishedChanges(same.id)).toBe(false);
		expect(await hasUnpublishedChanges(edited.id)).toBe(true);
	});

	it("does not touch versions or modified dates", async () => {
		const published = await legacyPublished(LEGACY);
		const workingBefore = await row(published.id, "working");
		const publishedBefore = await row(published.id, "published");

		await run();

		const after = await store.getEntry(published.id);
		expect(after.version).toBe(published.version);
		expect(after.updatedAt.getTime()).toBe(published.updatedAt.getTime());
		expect((await row(published.id, "working"))?.updated_at.getTime()).toBe(workingBefore?.updated_at.getTime());
		expect((await row(published.id, "published"))?.updated_at.getTime()).toBe(publishedBefore?.updated_at.getTime());
		expect(contentOf(after.working.doc)).toEqual(contentOf(bodyFromMdx(LEGACY).doc));
		expect(contentOf(after.published?.doc)).toEqual(contentOf(bodyFromMdx(LEGACY).doc));
	});

	it("replaces a document that is already there with the one the MDX reads as", async () => {
		const draft = await createDraft(WRITTEN);
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc = $1::jsonb WHERE entry_id = $2`, [
			JSON.stringify({ type: "doc", version: 1, content: [] }),
			draft.id,
		]);

		await run();

		expect(contentOf((await row(draft.id, "working"))?.doc)).toEqual(contentOf(bodyFromMdx(WRITTEN).doc));
	});

	it("writes the source a translation was confirmed against the same way, so the translation screen sees no change", async () => {
		const published = await legacyPublished(LEGACY);
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[JSON.stringify({ version: 2, baseSource: LEGACY }), published.id],
		);

		await run();

		const stored = await row(published.id, "working");
		expect(stored?.translation).toEqual({ version: 2, baseSource: WRITTEN });
		expect(stored?.mdx).toBe(stored?.translation?.baseSource);
	});

	it("leaves a base source that does not parse as it is", async () => {
		const published = await legacyPublished(LEGACY);
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[JSON.stringify({ version: 2, baseSource: "Words\n<Unclosed" }), published.id],
		);

		await run();

		expect((await row(published.id, "working"))?.translation).toEqual({ version: 2, baseSource: "Words\n<Unclosed" });
	});

	it("leaves a body that does not parse, or has front matter, as it is without a document, and logs it", async () => {
		const broken = await createDraft("가\n<Unclosed");
		await setLegacy(broken.id, "가\n<Unclosed");
		const frontMatter = await createDraft("---\ntitle: x\n---\n\nBody");
		await setLegacy(frontMatter.id, "---\ntitle: x\n---\n\nBody");
		const good = await createDraft(LEGACY);
		await setLegacy(good.id, LEGACY);
		const messages: string[] = [];

		await withMigrationClient((client) =>
			migrateStoredDocuments(client, schemaName, { log: (message) => messages.push(message) }),
		);

		for (const [entry, mdx] of [
			[broken, "가\n<Unclosed"],
			[frontMatter, "---\ntitle: x\n---\n\nBody"],
		] as const) {
			const stored = await row(entry.id, "working");
			expect(stored?.mdx).toBe(mdx);
			expect(stored?.doc).toBeNull();
			// It still has the current hash (of its raw text) and search text.
			expect(stored?.content_hash).toBe(mdxContentHash(stored?.metadata ?? {}, mdx, stored?.schema_version ?? 1));
			expect(stored?.search_text).toBe(mdxSearchText(mdx));
			expect(messages.filter((message) => message.includes(`${entry.id}/working`))).toHaveLength(1);
		}
		expect((await row(good.id, "working"))?.mdx).toBe(WRITTEN);
		expect(messages.some((message) => message.includes(good.id))).toBe(false);
	});

	it("logs through console.warn by default", async () => {
		const broken = await createDraft("가\n<Unclosed");
		await setLegacy(broken.id, "가\n<Unclosed");
		const calls: unknown[][] = [];
		const original = console.warn;
		console.warn = (...args: unknown[]) => {
			calls.push(args);
		};
		try {
			await run();
		} finally {
			console.warn = original;
		}
		expect(calls.some((args) => String(args[0]).includes(`${broken.id}/working`))).toBe(true);
	});

	it("changes nothing when it runs a second time", async () => {
		await legacyPublished(LEGACY);
		const broken = await createDraft("가\n<Unclosed");
		await setLegacy(broken.id, "가\n<Unclosed");
		const template = await store.createTemplate({ name: unique("again"), doc: docOf(LEGACY) });
		await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1, doc = NULL WHERE id = $2`, [
			LEGACY,
			template.id,
		]);

		await run();
		const once = { bodies: await allRows(), templates: await store.listTemplates() };
		await run();

		expect(await allRows()).toEqual(once.bodies);
		expect(await store.listTemplates()).toEqual(once.templates);
		expect(once.bodies.some((stored) => stored.doc !== null)).toBe(true);
	});

	describe("body templates", () => {
		const legacyTemplate = async (mdx: string) => {
			const template = await store.createTemplate({ name: unique("template"), doc: docOf(mdx) });
			await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1, doc = NULL WHERE id = $2`, [
				mdx,
				template.id,
			]);
			return template;
		};

		it("gives a template its document and writes its MDX from it, leaving its version and date alone", async () => {
			const template = await legacyTemplate(LEGACY);

			await run();

			const after = await store.getTemplate(template.id);
			expect(await templateMdx(pool, schemaName, template.id)).toBe(WRITTEN);
			expect(contentOf(after.doc)).toEqual(contentOf(bodyFromMdx(LEGACY).doc));
			expect(after.version).toBe(template.version);
			expect(after.updatedAt.getTime()).toBe(template.updatedAt.getTime());
		});

		it("leaves a template that does not parse as it is without a document, and logs it", async () => {
			const broken = await legacyTemplate("Words\n\n<Unclosed");
			const messages: string[] = [];

			await withMigrationClient((client) =>
				migrateStoredDocuments(client, schemaName, { log: (message) => messages.push(message) }),
			);

			expect(await templateMdx(pool, schemaName, broken.id)).toBe("Words\n\n<Unclosed");
			// The step leaves it without a document (the one after it, `0017_unparsed_bodies`, gives it its unparsed document).
			const raw = await pool.query(`SELECT doc FROM "${schemaName}".body_templates WHERE id = $1`, [broken.id]);
			expect(raw.rows[0]?.doc).toBeNull();
			expect(messages.some((message) => message.includes(`body_templates ${broken.id}`))).toBe(true);
		});
	});

	describe("batches", () => {
		it("reaches every body and template whatever the batch size", async () => {
			const entries: Entry[] = [];
			for (let index = 0; index < 5; index += 1) {
				const draft = await createDraft(`Title ${index}\n=====\n`);
				await setLegacy(draft.id, `Title ${index}\n=====\n`);
				entries.push(draft);
			}
			const templates = [];
			for (let index = 0; index < 5; index += 1) {
				const template = await store.createTemplate({ name: unique("batch"), doc: docOf(`Heading ${index}\n=====\n`) });
				await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1, doc = NULL WHERE id = $2`, [
					`Heading ${index}\n=====\n`,
					template.id,
				]);
				templates.push(template);
			}

			for (const batchSize of [1, 2, 1000]) {
				await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc = NULL WHERE entry_id = ANY($1::uuid[])`, [
					entries.map((entry) => entry.id),
				]);
				await pool.query(`UPDATE "${schemaName}".body_templates SET doc = NULL WHERE id = ANY($1::uuid[])`, [
					templates.map((template) => template.id),
				]);

				await withMigrationClient((client) => migrateStoredDocuments(client, schemaName, { batchSize }));

				for (const [index, entry] of entries.entries()) {
					const stored = await row(entry.id, "working");
					expect(stored?.mdx).toBe(`# Title ${index}\n`);
					expect(contentOf(stored?.doc)).toEqual(contentOf(bodyFromMdx(`Title ${index}\n=====\n`).doc));
				}
				for (const [index, template] of templates.entries()) {
					expect(contentOf((await store.getTemplate(template.id)).doc)).toEqual(
						contentOf(bodyFromMdx(`Heading ${index}\n=====\n`).doc),
					);
				}
				// Put the legacy text back for the next batch size.
				for (const [index, entry] of entries.entries()) await setLegacy(entry.id, `Title ${index}\n=====\n`);
				for (const [index, template] of templates.entries()) {
					await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = $1 WHERE id = $2`, [
						`Heading ${index}\n=====\n`,
						template.id,
					]);
				}
			}
		});
	});
});
