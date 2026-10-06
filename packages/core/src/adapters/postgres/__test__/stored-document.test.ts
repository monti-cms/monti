import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata, secondLocale } from "../../../../test/any-site";
import { contentOf } from "../../../../test/stored-content";
import { documentText, SEARCH_TEXT } from "../../../core/body-text";
import type { Collection } from "../../../core/collections";
import { computeContentHash } from "../../../core/content-hash";
import type { Entry } from "../../../core/store";
import { duplicateDraft, publishDraft } from "../../../core/store/__test__/seed";
import type { JsonValue } from "../../../core/types";
import { bodyFromMdx, readStoredDocument, unparsedDocument } from "../../../mdx/stored-document";
import { createContentService } from "../../../services/content-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** The same content in a spelling the serializer does not write, and the text a save writes for it. */
const UNTIDY = "Title\n=====\n\nSome _emphasis_ here\n\n* one\n* two\n";
const TIDY = "# Title\n\nSome *emphasis* here\n\n- one\n- two\n";

/**
 * Every write of a body stores its document with the MDX written from it: `doc` is `null` (the body does not parse, or has front matter) or the document,
 * and then `mdx` is what `bodyFromMdx` writes for it, `content_hash` is the hash of that text and `search_text` is read from it.
 */
describe("stored documents", () => {
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

	const metadataFor = async () => requiredMetadata(contentCollection, unique("Post"), relationTarget);

	const createDraft = async (body: { mdx: string } | { doc: unknown }) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("post"),
			metadata: await metadataFor(),
			...body,
		} as never);

	const save = async (entry: Entry, mdx: string) =>
		service.saveDraft(entry.id, {
			collection: contentCollection,
			slug: entry.workingSlug,
			metadata: entry.working.metadata as never,
			mdx,
			expectedVersion: entry.version,
		});

	const publish = (entry: Entry) => publishDraft(store, { id: entry.id, expectedVersion: entry.version });

	interface Stored {
		metadata: JsonValue;
		mdx: string;
		doc: unknown;
		schema_version: number;
		content_hash: string;
		search_text: string;
		updated_at: Date;
	}

	const stored = async (entryId: string, state: "working" | "published") => {
		const found = (
			await pool.query<Stored>(
				`SELECT metadata, mdx, doc, schema_version, content_hash, search_text, updated_at
				 FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];
		if (!found) throw new Error(`no ${state} body for ${entryId}`);
		return found;
	};

	/** The rule every row follows. */
	const expectConsistent = async (entryId: string, state: "working" | "published") => {
		const row = await stored(entryId, state);
		// The text read again is the stored document: it keeps the ids of the document it was written from.
		const body = bodyFromMdx(row.mdx, undefined, { previous: readStoredDocument(row.doc) });
		const doc = readStoredDocument(row.doc);
		expect(doc).toBeDefined();
		expect(row.mdx).toBe(body.mdx);
		// A body that could not become a document is stored as an unparsed document of its text.
		if (body.doc) expect(row.doc).toEqual(body.doc);
		else expect(contentOf(row.doc)).toEqual(contentOf(unparsedDocument(body.mdx)));
		// The hash and the search text are the document's.
		expect(row.content_hash).toBe(computeContentHash(row.metadata, doc as never, row.schema_version));
		expect(row.search_text).toBe(documentText(doc as never, SEARCH_TEXT));
		return row;
	};

	it("creating a draft stores the document and the MDX written from it", async () => {
		const draft = await createDraft({ mdx: UNTIDY });

		const row = await expectConsistent(draft.id, "working");
		expect(row.mdx).toBe(TIDY);
		expect(row.doc).not.toBeNull();
		expect(draft.working.mdx).toBe(TIDY);
		expect(draft.working.doc).toEqual(row.doc);
	});

	it("creating a draft from a document stores the same body as creating it from the MDX", async () => {
		const fromMdx = await createDraft({ mdx: UNTIDY });
		const doc = fromMdx.working.doc;
		expect(doc).not.toBeNull();

		const fromDoc = await createDraft({ doc });

		const row = await expectConsistent(fromDoc.id, "working");
		expect(row.mdx).toBe(TIDY);
		expect(fromDoc.working.doc).toEqual(doc);
	});

	it("a body that does not parse is stored as an unparsed document, and its MDX is the text as given", async () => {
		const draft = await createDraft({ mdx: "Words\n\n<Unclosed" });

		const row = await expectConsistent(draft.id, "working");
		expect(row.mdx).toBe("Words\n\n<Unclosed");
		expect(row.doc).toMatchObject({
			content: [{ type: "unparsed", attrs: { format: "mdx", source: "Words\n\n<Unclosed" } }],
		});
		expect(draft.working.doc).toEqual(row.doc);
	});

	it("a body with front matter is stored as an unparsed document, and its MDX is the text as given", async () => {
		const draft = await createDraft({ mdx: "---\ntitle: x\n---\n\nBody" });

		const row = await expectConsistent(draft.id, "working");
		expect(row.mdx).toBe("---\ntitle: x\n---\n\nBody");
		expect(row.doc).toMatchObject({ content: [{ type: "unparsed" }] });
	});

	describe("saving", () => {
		it("a changed body is stored with its new document", async () => {
			const draft = await createDraft({ mdx: UNTIDY });

			const saved = await save(draft, "Changed _words_\n");

			expect(saved.version).toBe(draft.version + 1);
			const row = await expectConsistent(draft.id, "working");
			expect(row.mdx).toBe("Changed *words*\n");
			expect(contentOf(row.doc)).toEqual(contentOf(bodyFromMdx("Changed *words*\n").doc));
			expect(saved.working.doc).toEqual(row.doc);
		});

		it("saving the same content in another spelling changes nothing", async () => {
			const draft = await createDraft({ mdx: TIDY });
			const before = await stored(draft.id, "working");

			const saved = await save(draft, UNTIDY);

			expect(saved.version).toBe(draft.version);
			expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
			expect(await stored(draft.id, "working")).toEqual(before);
		});

		it("saving the same content over a body with no document stores the document without a new version or date", async () => {
			const draft = await createDraft({ mdx: TIDY });
			// A body from before documents were stored: the text in another spelling, no document, the hash of its content.
			const legacy = await stored(draft.id, "working");
			await pool.query(
				`UPDATE "${schemaName}".entry_bodies SET mdx = $1, doc = NULL, search_text = '' WHERE entry_id = $2`,
				[UNTIDY, draft.id],
			);

			const saved = await save(draft, UNTIDY);

			expect(saved.version).toBe(draft.version);
			expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
			const row = await expectConsistent(draft.id, "working");
			expect(row.mdx).toBe(TIDY);
			expect(row.doc).not.toBeNull();
			expect(row.content_hash).toBe(legacy.content_hash);
			expect(row.updated_at.getTime()).toBe(legacy.updated_at.getTime());
		});

		it("saving the same text over a body that has the right text but no document stores the document", async () => {
			const draft = await createDraft({ mdx: TIDY });
			await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc = NULL WHERE entry_id = $1`, [draft.id]);

			const saved = await save(draft, TIDY);

			expect(saved.version).toBe(draft.version);
			expect((await expectConsistent(draft.id, "working")).doc).not.toBeNull();
		});

		it("a body that stops parsing becomes an unparsed document, and a document again when it is fixed", async () => {
			const draft = await createDraft({ mdx: TIDY });

			const broken = await save(draft, "Words\n\n<Unclosed");
			expect((await expectConsistent(draft.id, "working")).doc).toMatchObject({ content: [{ type: "unparsed" }] });
			expect(broken.working.doc.content[0]?.type).toBe("unparsed");

			const fixed = await save(broken, "Words\n");
			const row = await expectConsistent(draft.id, "working");
			expect(contentOf(row.doc)).toEqual(contentOf(bodyFromMdx("Words\n").doc));
			expect(fixed.working.doc).toEqual(row.doc);
		});
	});

	describe("publishing", () => {
		it("copies the document with the text to the published body", async () => {
			const draft = await createDraft({ mdx: UNTIDY });

			const published = await publish(draft);

			const working = await expectConsistent(draft.id, "working");
			const copy = await expectConsistent(draft.id, "published");
			expect(copy.doc).toEqual(working.doc);
			expect(copy.mdx).toBe(working.mdx);
			expect(copy.content_hash).toBe(working.content_hash);
			expect(published.published?.doc).toEqual(published.working.doc);
			expect(published.published?.doc).not.toBeNull();
		});

		it("a later save leaves the published document as it was", async () => {
			const published = await publish(await createDraft({ mdx: UNTIDY }));
			const publishedBefore = await stored(published.id, "published");

			await save(published, "A newer draft\n");

			expect(await stored(published.id, "published")).toEqual(publishedBefore);
			expect((await expectConsistent(published.id, "working")).mdx).toBe("A newer draft\n");
		});
	});

	describe("duplicating", () => {
		it("copies the document and the text, and the copy has its own hash", async () => {
			const original = await createDraft({ mdx: UNTIDY });

			const copy = await duplicateDraft(store, { id: original.id });

			const row = await expectConsistent(copy.id, "working");
			const source = await stored(original.id, "working");
			expect(row.mdx).toBe(source.mdx);
			expect(row.doc).toEqual(source.doc);
			expect(copy.working.doc).toEqual(source.doc);
		});

		it("copies an unparsed body as it is", async () => {
			const original = await createDraft({ mdx: "Words\n\n<Unclosed" });

			const copy = await duplicateDraft(store, { id: original.id });

			const row = await expectConsistent(copy.id, "working");
			expect(row.mdx).toBe("Words\n\n<Unclosed");
			expect(row.doc).toMatchObject({ content: [{ type: "unparsed", attrs: { source: "Words\n\n<Unclosed" } }] });
		});
	});

	describe("reading", () => {
		it("the working copy, the entry and the export carry the document", async () => {
			const published = await publish(await createDraft({ mdx: UNTIDY }));
			const doc = (await stored(published.id, "working")).doc;
			expect(doc).not.toBeNull();

			expect((await store.getWorking({ entryId: published.id })).doc).toEqual(doc);
			const entry = await store.getEntry(published.id);
			expect(entry.working.doc).toEqual(doc);
			expect(entry.published?.doc).toEqual(doc);
			const exported = (await store.readExportSnapshot()).entries.find((candidate) => candidate.id === published.id);
			expect(exported?.working.doc).toEqual(doc);
			expect(exported?.published?.doc).toEqual(doc);
		});

		it("a stored value that is not a document reads as an unparsed body of the MDX column", async () => {
			const draft = await createDraft({ mdx: TIDY });
			await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc = $1::jsonb WHERE entry_id = $2`, [
				JSON.stringify({ type: "doc", version: 99, content: [] }),
				draft.id,
			]);

			for (const doc of [
				(await store.getEntry(draft.id)).working.doc,
				(await store.getWorking({ entryId: draft.id })).doc,
			]) {
				expect(doc.content).toEqual([
					expect.objectContaining({ type: "unparsed", attrs: { format: "mdx", source: TIDY } }),
				]);
			}
		});

		it("the public read returns the stored document, and a list returns it only with the body", async () => {
			const published = await publish(await createDraft({ mdx: UNTIDY }));
			const row = await stored(published.id, "published");

			const lookup = await store.getPublishedEntryBySlug({
				collection: contentCollection,
				slug: published.workingSlug ?? "",
			});
			if (lookup.status !== "current") throw new Error("expected the published entry");
			expect(lookup.entry.mdx).toBe(TIDY);
			// The document that was stored, not one parsed again from the text.
			expect(lookup.entry.doc).toEqual(readStoredDocument(row.doc));
			expect(lookup.entry.doc).not.toBeNull();

			const withBody = await store.listPublishedEntries({ collections: [contentCollection], includeBody: true });
			expect(withBody.find((entry) => entry.id === published.id)?.doc).toEqual(lookup.entry.doc);
			const withoutBody = await store.listPublishedEntries({ collections: [contentCollection] });
			expect(withoutBody.length).toBeGreaterThan(0);
			for (const entry of withoutBody) expect(entry.doc).toBeNull();
		});
	});

	describe.skipIf(!secondLocale)("translations", () => {
		it("a translation starts from the source's stored text, which is also the source it was confirmed against", async () => {
			const source = await createDraft({ mdx: UNTIDY });

			const translation = await service.createTranslation({ sourceId: source.id, locale: secondLocale as string });

			const row = await expectConsistent(translation.id, "working");
			expect(row.doc).not.toBeNull();
			expect(translation.working.translation?.baseDoc).toEqual(
				readStoredDocument((await stored(source.id, "working")).doc),
			);
		});
	});
});
