import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import type { Collection } from "../../../core/collections";
import { computeContentHash } from "../../../core/content-hash";
import type { Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { unparsedDocument } from "../../../mdx/stored-document";
import { createContentService } from "../../../services/content-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { migrateUnparsedBodies } from "../store/unparsed-migration";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const STEP = "0017_unparsed_bodies";

/**
 * `0017_unparsed_bodies`: every stored body is a document. A body or template that has none (its MDX did not parse, had front matter, or would not read
 * back the same) becomes the document of one `unparsed` node holding its MDX. Nothing fails because of such a body, published ones included, and
 * the published bodies and templates among them are logged by id. Each test puts a store from before back by writing rows without a document.
 */
describe("0017_unparsed_bodies", () => {
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

	/** The body as a store from before stored documents held it: the text as it was, no document, a stale hash. */
	const withoutDocument = (entryId: string, mdx: string, state?: "working" | "published") =>
		pool.query(
			`UPDATE "${schemaName}".entry_bodies SET mdx = $1, doc = NULL, content_hash = 'stale-' || state
			 WHERE entry_id = $2 AND ($3::text IS NULL OR state = $3)`,
			[mdx, entryId, state ?? null],
		);

	const row = async (entryId: string, state: "working" | "published") =>
		(
			await pool.query<{
				mdx: string;
				doc: unknown;
				content_hash: string;
				schema_version: number;
				metadata: Record<string, unknown>;
				updated_at: Date;
				translation: unknown;
				search_text: string;
			}>(
				`SELECT mdx, doc, content_hash, schema_version, metadata, updated_at, translation, search_text
				 FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];

	const run = (log: (message: string) => void = () => {}) => {
		const logged: string[] = [];
		return pool.connect().then(async (client) => {
			try {
				await client.query("BEGIN");
				const result = await migrateUnparsedBodies(client, schemaName, {
					log: (message) => {
						logged.push(message);
						log(message);
					},
				});
				await client.query("COMMIT");
				return { result, logged };
			} catch (error) {
				await client.query("ROLLBACK");
				throw error;
			} finally {
				client.release();
			}
		});
	};

	const forgetStep = () => pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);

	it("is a step after the stored document steps, before the seed", () => {
		const names = CONTENT_STORE_MIGRATIONS;
		expect(names.indexOf(STEP)).toBeGreaterThan(names.indexOf("0015_code_annotations"));
		expect(names.indexOf(STEP)).toBeLessThan(names.indexOf("seed_initial_body_templates"));
	});

	it("gives a draft with no document an unparsed node that holds its text, and recomputes its hash", async () => {
		const draft = await createDraft("Hello");
		const text = "---\ntitle: x\n---\n\nBody <Open";
		await withoutDocument(draft.id, text);
		const before = await row(draft.id, "working");

		await forgetStep();
		await migrateContentStore(pool, { schema: schemaName });

		const after = await row(draft.id, "working");
		const doc = after?.doc as { content: { type: string; attrs: { format: string; source: string }; id: string }[] };
		expect(doc.content).toHaveLength(1);
		expect(doc.content[0]).toMatchObject({ type: "unparsed", attrs: { format: "mdx", source: text } });
		expect(doc.content[0]?.id).toMatch(/^[0-9a-z]{8}$/);
		expect(after?.mdx).toBe(text);
		// A document is hashed as a document; text that is not one under its own tag, as it always was.
		expect(after?.content_hash).toBe(
			computeContentHash(after?.metadata as never, unparsedDocument(text), after?.schema_version),
		);
		// Nothing but the document and the hash changed.
		expect(after?.updated_at.getTime()).toBe(before?.updated_at.getTime());
		expect(after?.search_text).toBe(before?.search_text);
		expect((await store.getEntry(draft.id)).version).toBe(draft.version);
	});

	it("does not fail for a published body or a template that has no document: it keeps them, and logs their ids", async () => {
		const draft = await createDraft("Body");
		const published = await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		await withoutDocument(published.id, "<Unclosed");
		const template = await store.createTemplate({ name: unique("template"), mdx: "Template" });
		await pool.query(`UPDATE "${schemaName}".body_templates SET mdx = '<Open', doc = NULL WHERE id = $1`, [
			template.id,
		]);

		const { result, logged } = await run();

		expect(result.published).toContain(published.id);
		expect(result.templates).toContain(template.id);
		expect(logged.some((message) => message.includes(published.id))).toBe(true);
		expect(logged.some((message) => message.includes(template.id))).toBe(true);
		for (const state of ["working", "published"] as const) {
			expect((await row(published.id, state))?.doc).toMatchObject({ content: [{ type: "unparsed" }] });
		}
		const kept = await store.getTemplate(template.id);
		expect(kept.mdx).toBe("<Open");
		expect(kept.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: "<Open" } });
	});

	it("leaves a body that has a document alone, with its block ids", async () => {
		const draft = await createDraft("A paragraph\n\n## Heading");
		const before = await row(draft.id, "working");

		await run();

		expect(await row(draft.id, "working")).toEqual(before);
	});

	it("lifts the translation state to version 4, with the document of the source it was confirmed against", async () => {
		const source = await createDraft("원문");
		const translation = await service.createTranslation({ sourceId: source.id, locale: "en" }).catch(() => null);
		const target = translation ?? (await createDraft("번역"));
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[JSON.stringify({ version: 3, baseSource: "원문\n", baseDoc: null }), target.id],
		);

		await run();

		const state = (await row(target.id, "working"))?.translation as { version: number; baseDoc: unknown };
		expect(state.version).toBe(4);
		expect(state).not.toHaveProperty("baseSource");
		expect(JSON.stringify(state.baseDoc)).toContain("원문");
		expect(JSON.stringify(state.baseDoc)).toBe(JSON.stringify(JSON.parse(JSON.stringify(state.baseDoc))));
	});

	it("changes nothing when it runs again", async () => {
		const draft = await createDraft("Hello");
		await withoutDocument(draft.id, "<Open");
		await run();
		const first = await row(draft.id, "working");

		const { result, logged } = await run();

		expect(await row(draft.id, "working")).toEqual(first);
		expect(result).toEqual({ drafts: 0, published: [], templates: [] });
		expect(logged).toEqual([]);
	});

	it("reads a row that has no document as an unparsed body even before the step has run", async () => {
		const draft = await createDraft("Hello");
		await withoutDocument(draft.id, "text <Open", "working");

		const entry = await store.getEntry(draft.id);

		expect(entry.working.doc.content[0]).toMatchObject({ type: "unparsed", attrs: { source: "text <Open" } });
	});
});
