import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { contentOf, docOf as docFromMdx } from "../../../../test/stored-content";
import type { Collection } from "../../../core/collections";
import type { Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { forEachBlock, isBlockId, withoutBlockIds } from "../../../mdx/block-ids";
import { bodyFromMdx, readStoredDocument, type StoredDocument } from "../../../mdx/stored-document";
import { createContentService } from "../../../services/content-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { migrateBlockIds } from "../store/block-id-migration";
import { CONTENT_STORE_MIGRATIONS } from "../store/schema";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

const STEP = "0014_block_ids";

/** A body with blocks at several depths: headings, paragraphs, a list (items hold paragraphs) and a quote. */
const NESTED = "# Title\n\nFirst paragraph\n\n- one\n- two\n\n> quoted\n\nLast paragraph\n";

/**
 * `0014_block_ids`: gives every block of every stored document an id and makes a published body share the ids of the working body for the blocks they have in
 * common. Saves already store ids, so each test puts a store from before back by writing documents without ids, takes the step's record away and runs
 * the migration again.
 */
describe("0014_block_ids", () => {
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

	const edit = (entry: Entry, mdx: string) =>
		service.saveDraft(entry.id, {
			collection: contentCollection,
			slug: entry.workingSlug,
			metadata: entry.working.metadata as never,
			format: "mdx",
			body: mdx,
			expectedVersion: entry.version,
		});

	/** A published entry whose working body has moved on: `workingMdx` is the draft, `publishedMdx` what was published. */
	const publishedThenEdited = async (publishedMdx: string, workingMdx: string) => {
		const draft = await createDraft(publishedMdx);
		const published = await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		return workingMdx === publishedMdx ? published : edit(published, workingMdx);
	};

	interface StoredRow {
		entry_id: string;
		state: string;
		metadata: unknown;
		mdx: string;
		doc: unknown;
		schema_version: number;
		content_hash: string;
		search_text: string;
		updated_at: Date;
		translation: unknown;
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

	/** Every column but the document. */
	const withoutDoc = (rows: readonly StoredRow[]) => rows.map(({ doc: _doc, xmin: _xmin, ...rest }) => rest);

	const docOf = (found: StoredRow | undefined): StoredDocument => {
		const doc = readStoredDocument(found?.doc);
		if (!doc) throw new Error("expected a stored document");
		return doc;
	};

	const idList = (doc: StoredDocument) => {
		const ids: (string | undefined)[] = [];
		forEachBlock(doc.content, (node) => ids.push(node.id));
		return ids;
	};

	/** Block id by the text a heading or paragraph starts with (texts in these tests are unique). */
	const idsByText = (doc: StoredDocument) => {
		const found = new Map<string, string | undefined>();
		forEachBlock(doc.content, (node) => {
			const text = node.content?.[0]?.text;
			if (text !== undefined) found.set(text, node.id);
		});
		return found;
	};

	/** Puts a body back as it was before ids: the document without them (or as given). */
	const setDoc = (entryId: string, state: "working" | "published", doc: unknown) =>
		pool.query(`UPDATE "${schemaName}".entry_bodies SET doc = $1::jsonb WHERE entry_id = $2 AND state = $3`, [
			doc === null ? null : JSON.stringify(doc),
			entryId,
			state,
		]);

	const stripIds = async (entryId: string, states: readonly ("working" | "published")[] = ["working", "published"]) => {
		for (const state of states) {
			const found = await row(entryId, state);
			if (!found?.doc) continue;
			const doc = docOf(found);
			await setDoc(entryId, state, { ...doc, content: withoutBlockIds(doc.content) });
		}
	};

	/** Puts a template back as it was before ids. */
	const stripTemplateIds = async (template: { id: string; doc: StoredDocument | null }) => {
		const doc = template.doc as StoredDocument;
		await pool.query(`UPDATE "${schemaName}".body_templates SET doc = $1::jsonb WHERE id = $2`, [
			JSON.stringify({ ...doc, content: withoutBlockIds(doc.content) }),
			template.id,
		]);
	};

	const rewind = () => pool.query(`DELETE FROM "${schemaName}".cms_migrations WHERE name = $1`, [STEP]);

	const run = async () => {
		await rewind();
		// Only this step runs again. It reads the document of a template, never its text, so the templates the tests create (they have none) stay.
		await migrateContentStore(pool, { schema: schemaName });
	};

	const withMigrationClient = async <T>(work: (client: PoolClient) => Promise<T>): Promise<T> => {
		const client = await pool.connect();
		try {
			return await work(client);
		} finally {
			client.release();
		}
	};

	const expectIds = (doc: StoredDocument) => {
		const ids = idList(doc);
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(isBlockId(id)).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	};

	it("is a recorded migration step that runs after the stored document step and before the template seed", () => {
		expect(CONTENT_STORE_MIGRATIONS).toContain(STEP);
		expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBe(CONTENT_STORE_MIGRATIONS.indexOf("0013_stored_documents") + 1);
		expect(CONTENT_STORE_MIGRATIONS.indexOf(STEP)).toBeLessThan(
			CONTENT_STORE_MIGRATIONS.indexOf("seed_initial_body_templates"),
		);
		expect(CONTENT_STORE_MIGRATIONS.at(-1)).toBe("seed_initial_body_templates");
	});

	it("gives every block of a document without ids its own id, at every depth, and leaves the content as it was", async () => {
		const draft = await createDraft(NESTED);
		await stripIds(draft.id);
		const before = docOf(await row(draft.id, "working"));
		expect(idList(before).every((id) => id === undefined)).toBe(true);

		await run();

		const after = docOf(await row(draft.id, "working"));
		expectIds(after);
		// Heading, 2 paragraphs, list + 2 items + their 2 paragraphs, quote + its paragraph, and one more paragraph.
		expect(idList(after)).toHaveLength(10);
		expect(withoutBlockIds(after.content)).toEqual(before.content);
		expect(after.version).toBe(before.version);
		expect(Object.keys(after)).toEqual(["content", "type", "version"]);
	});

	it("shares ids between the working and the published body for the blocks they have in common", async () => {
		const entry = await publishedThenEdited("Alpha\n\nBeta\n\nGamma\n", "Alpha\n\nGamma\n\nDelta\n");
		await stripIds(entry.id);

		await run();

		const working = idsByText(docOf(await row(entry.id, "working")));
		const published = idsByText(docOf(await row(entry.id, "published")));
		expect(published.get("Alpha")).toBe(working.get("Alpha"));
		expect(published.get("Gamma")).toBe(working.get("Gamma"));
		// Only the published body has Beta, and only the working body has Delta: neither shares an id.
		expect(isBlockId(published.get("Beta"))).toBe(true);
		expect([...working.values()]).not.toContain(published.get("Beta"));
		expectIds(docOf(await row(entry.id, "published")));
		expectIds(docOf(await row(entry.id, "working")));
	});

	it("shares the id of an edited block, as saving the working body from the published one would", async () => {
		const entry = await publishedThenEdited("Intro\n\nOld wording\n\nOutro\n", "Intro\n\nNew wording\n\nOutro\n");
		await stripIds(entry.id);

		await run();

		const working = docOf(await row(entry.id, "working"));
		const published = docOf(await row(entry.id, "published"));
		expect(idsByText(published).get("Old wording")).toBe(idsByText(working).get("New wording"));
		expect(idList(published)).toEqual(idList(working));
	});

	it("shares every id when the published body is the working body", async () => {
		const entry = await publishedThenEdited(NESTED, NESTED);
		await stripIds(entry.id);

		await run();

		expect(idList(docOf(await row(entry.id, "published")))).toEqual(idList(docOf(await row(entry.id, "working"))));
	});

	it("keeps the ids a document already has and gives the other blocks theirs", async () => {
		const draft = await createDraft("One\n\nTwo\n\nThree\n");
		const stored = docOf(await row(draft.id, "working"));
		const [first, second, third] = stored.content;
		if (!first || !second || !third) throw new Error("fixture");
		await setDoc(draft.id, "working", {
			...stored,
			// The first block has an id of its own, the second has none, the third has an id that is not an id.
			content: [{ ...first, id: "abcd1234" }, withoutBlockIds([second])[0], { ...third, id: "NOT AN ID" }],
		});

		await run();

		const after = docOf(await row(draft.id, "working"));
		expectIds(after);
		expect(idList(after)[0]).toBe("abcd1234");
		expect(idList(after)[1]).not.toBe(idList(after)[2]);
		expect(contentOf(after)).toEqual(contentOf(stored));
	});

	it("gives a later block that repeats an id a new one", async () => {
		const draft = await createDraft("One\n\nTwo\n");
		const stored = docOf(await row(draft.id, "working"));
		await setDoc(draft.id, "working", {
			...stored,
			content: stored.content.map((block) => ({ ...block, id: "same0001" })),
		});

		await run();

		const ids = idList(docOf(await row(draft.id, "working")));
		expect(ids[0]).toBe("same0001");
		expect(isBlockId(ids[1])).toBe(true);
		expect(ids[1]).not.toBe("same0001");
	});

	it("takes the ids of the working body for a published body, whatever ids the published body had", async () => {
		const entry = await publishedThenEdited("Alpha\n\nBeta\n", "Alpha\n\nBeta\n");
		const working = docOf(await row(entry.id, "working"));
		const published = docOf(await row(entry.id, "published"));
		// Ids from another time: the published body's own, unrelated to the working body's.
		await setDoc(entry.id, "published", {
			...published,
			content: published.content.map((block, index) => ({ ...block, id: `other00${index}` })),
		});

		await run();

		expect(idList(docOf(await row(entry.id, "published")))).toEqual(idList(working));
	});

	it("keeps the id of a block only the published body has, so that a second run draws no new ids", async () => {
		const entry = await publishedThenEdited("Alpha\n\nBeta\n\nGamma\n", "Alpha\n\nGamma\n");
		await stripIds(entry.id);
		await run();
		const published = docOf(await row(entry.id, "published"));
		const beta = idsByText(published).get("Beta");
		expect(isBlockId(beta)).toBe(true);

		await run();

		expect(docOf(await row(entry.id, "published"))).toEqual(published);
	});

	it("gives a published body whose entry has no working document its own ids, and keeps them", async () => {
		const entry = await publishedThenEdited("Alpha\n\nBeta\n", "Alpha\n\nBeta\n");
		await stripIds(entry.id, ["published"]);
		await setDoc(entry.id, "working", null);

		await run();

		const published = docOf(await row(entry.id, "published"));
		expectIds(published);
		expect((await row(entry.id, "working"))?.doc).toBeNull();

		await run();

		expect(docOf(await row(entry.id, "published"))).toEqual(published);
	});

	it("gives a draft with no published body its ids, and leaves a body without a document as it is", async () => {
		const draft = await createDraft("Only a draft\n");
		await stripIds(draft.id);
		const broken = await createDraft("Words\n\n<Unclosed");
		// A store from before stored documents held such a body without one (a store now keeps it as an unparsed document).
		await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc = NULL WHERE entry_id = $1`, [broken.id]);
		expect((await row(broken.id, "working"))?.doc).toBeNull();

		await run();

		expectIds(docOf(await row(draft.id, "working")));
		expect(await row(draft.id, "published")).toBeUndefined();
		expect((await row(broken.id, "working"))?.doc).toBeNull();
	});

	it("leaves a stored value that is not a document as it is", async () => {
		const draft = await createDraft("Words\n");
		const notADocument = { type: "doc", version: 99, content: [] };
		await setDoc(draft.id, "working", notADocument);

		await run();

		expect((await row(draft.id, "working"))?.doc).toEqual(notADocument);
	});

	it("changes only the document: not the text, hash, search text, version, dates, metadata or translation", async () => {
		const entry = await publishedThenEdited("Alpha\n\nBeta\n", "Alpha\n\nBeta changed\n");
		await pool.query(
			`UPDATE "${schemaName}".entry_bodies SET translation = $1::jsonb WHERE entry_id = $2 AND state = 'working'`,
			[JSON.stringify({ version: 2, baseSource: "Alpha\n\nBeta\n" }), entry.id],
		);
		await stripIds(entry.id);
		const before = withoutDoc(await allRows());
		const entryBefore = await store.getEntry(entry.id);

		await run();

		expect(withoutDoc(await allRows())).toEqual(before);
		const after = await store.getEntry(entry.id);
		expect(after.version).toBe(entryBefore.version);
		expect(after.updatedAt.getTime()).toBe(entryBefore.updatedAt.getTime());
		expect(after.working.contentHash).toBe(entryBefore.working.contentHash);
		expect(after.published?.contentHash).toBe(entryBefore.published?.contentHash);
		expectIds(docOf(await row(entry.id, "working")));
	});

	it("keeps what the list shows as unpublished changes", async () => {
		const same = await publishedThenEdited("Alpha\n\nBeta\n", "Alpha\n\nBeta\n");
		const edited = await publishedThenEdited("Alpha\n\nBeta\n", "Alpha\n\nBeta changed\n");
		await stripIds(same.id);
		await stripIds(edited.id);

		await run();

		const { items } = await store.listEntries({ collection: contentCollection });
		expect(items.find((item) => item.id === same.id)?.hasUnpublishedChanges).toBe(false);
		expect(items.find((item) => item.id === edited.id)?.hasUnpublishedChanges).toBe(true);
	});

	it("changes nothing, and writes no row, when it runs a second time", async () => {
		const entry = await publishedThenEdited("Alpha\n\nBeta\n\nGamma\n", "Alpha\n\nGamma\n\nDelta\n");
		const draft = await createDraft(NESTED);
		await stripIds(entry.id);
		await stripIds(draft.id);
		const template = await store.createTemplate({ name: unique("again"), doc: docFromMdx(NESTED) });
		await stripTemplateIds(template);
		await run();
		const once = { bodies: await allRows(), templates: await store.listTemplates() };
		const templateRows = (await pool.query(`SELECT id, xmin::text FROM "${schemaName}".body_templates ORDER BY id`))
			.rows;
		await run();

		expect(await allRows()).toEqual(once.bodies);
		expect(await store.listTemplates()).toEqual(once.templates);
		// Not even rewritten with the same value: the row versions are the ones the first run left.
		expect((await pool.query(`SELECT id, xmin::text FROM "${schemaName}".body_templates ORDER BY id`)).rows).toEqual(
			templateRows,
		);
		expect(once.bodies.some((stored) => stored.doc !== null)).toBe(true);
	});

	it("does not rewrite documents that already have their ids", async () => {
		const draft = await createDraft(NESTED);
		const entry = await publishedThenEdited("Alpha\n", "Alpha\n");
		const before = [await row(draft.id, "working"), await row(entry.id, "working"), await row(entry.id, "published")];

		await run();

		expect([await row(draft.id, "working"), await row(entry.id, "working"), await row(entry.id, "published")]).toEqual(
			before,
		);
	});

	describe("body templates", () => {
		it("gives a template its ids, leaving its text, version and date alone", async () => {
			const template = await store.createTemplate({ name: unique("template"), doc: docFromMdx(NESTED) });
			await stripTemplateIds(template);

			await run();

			const after = await store.getTemplate(template.id);
			expect(after.doc).not.toBeNull();
			expectIds(after.doc as StoredDocument);
			expect(contentOf(after.doc)).toEqual(contentOf(template.doc));
			expect(after.version).toBe(template.version);
			expect(after.updatedAt.getTime()).toBe(template.updatedAt.getTime());
		});

		it("keeps the ids a template has, and leaves one without a document as it is", async () => {
			const template = await store.createTemplate({ name: unique("template"), doc: docFromMdx(NESTED) });
			const broken = await store.createTemplate({ name: unique("broken"), doc: docFromMdx("Words\n\n<Unclosed") });
			await pool.query(`UPDATE "${schemaName}".body_templates SET doc = NULL WHERE id = $1`, [broken.id]);

			await run();

			expect((await store.getTemplate(template.id)).doc).toEqual(template.doc);
			const stored = await pool.query(`SELECT doc FROM "${schemaName}".body_templates WHERE id = $1`, [broken.id]);
			expect(stored.rows[0]?.doc).toBeNull();
		});
	});

	describe("batches", () => {
		it("reaches every entry and template whatever the batch size, with both bodies of an entry in one batch", async () => {
			const entries: Entry[] = [];
			for (let index = 0; index < 5; index += 1) {
				entries.push(
					await publishedThenEdited(`Alpha ${index}\n\nBeta ${index}\n`, `Alpha ${index}\n\n# Gamma ${index}\n`),
				);
			}
			const drafts: Entry[] = [];
			for (let index = 0; index < 3; index += 1) drafts.push(await createDraft(`Solo ${index}\n`));
			const templates = [];
			for (let index = 0; index < 5; index += 1) {
				templates.push(
					await store.createTemplate({ name: unique("batch"), doc: docFromMdx(`Heading ${index}\n=====\n`) }),
				);
			}

			for (const batchSize of [1, 2, 1000]) {
				for (const entry of [...entries, ...drafts]) await stripIds(entry.id);
				for (const template of templates) await stripTemplateIds(template);

				await withMigrationClient((client) => migrateBlockIds(client, schemaName, { batchSize }));

				for (const [index, entry] of entries.entries()) {
					const working = docOf(await row(entry.id, "working"));
					const published = docOf(await row(entry.id, "published"));
					expectIds(working);
					expectIds(published);
					expect(idsByText(published).get(`Alpha ${index}`)).toBe(idsByText(working).get(`Alpha ${index}`));
					expect([...idsByText(working).values()]).not.toContain(idsByText(published).get(`Beta ${index}`));
				}
				for (const entry of drafts) expectIds(docOf(await row(entry.id, "working")));
				for (const template of templates) expectIds((await store.getTemplate(template.id)).doc as StoredDocument);
			}
		});
	});

	it("reads the same document a parse of the text gives, apart from ids", async () => {
		const draft = await createDraft(NESTED);
		await stripIds(draft.id);

		await run();

		expect(contentOf((await row(draft.id, "working"))?.doc)).toEqual(contentOf(bodyFromMdx(NESTED).doc));
	});
});
