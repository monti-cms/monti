import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata, secondLocale } from "../../../../test/any-site";
import { testSite } from "../../../../test/site";
import { contentOf, docOf } from "../../../../test/stored-content";
import { documentText, SEARCH_TEXT } from "../../../core/body-text";
import type { Collection } from "../../../core/collections";
import { computeContentHash } from "../../../core/content-hash";
import type { Entry } from "../../../core/store";
import { duplicateDraft, publishDraft } from "../../../core/store/__test__/seed";
import type { JsonValue } from "../../../core/types";
import { withoutBlockIds } from "../../../doc/block-ids";
import { readStoredDocument, STORED_DOCUMENT_VERSION } from "../../../doc/stored-document";
import { paragraphsFormat } from "../../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../../format/registry";
import { createContentService } from "../../../services/content-service";
import { createContentStore, migrateContentStore } from "../content-store";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** A heading, a paragraph with emphasis and a list, written as the reader of the test text reads it. */
const BODY = "# Title\n\nSome *emphasis* here\n\n- one\n- two\n";
const OPEN = "Words <<< open";

/**
 * Every write of a body stores its document and nothing else of the body: `doc` is the document, `mdx` stays empty, `content_hash` is the hash of the document
 * and `search_text` is read from it.
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
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		service = createContentService<Entry>(store, {
			site: testSite,
			formats: async () => createFormatRegistry([paragraphsFormat]),
		});
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const metadata = await requiredMetadata(to, unique(`target ${to}`), relationTarget);
		const draft = (
			await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata,
				doc: docOf("Body"),
			})
		).entry;
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const metadataFor = async () => requiredMetadata(contentCollection, unique("Post"), relationTarget);

	const createDraft = async (body: { doc: unknown } | { text: string }) =>
		service
			.createDraft({
				collection: contentCollection,
				slug: unique("post"),
				metadata: await metadataFor(),
				...("text" in body ? { format: "paragraphs", body: body.text } : body),
			} as never)
			.then((result) => result.entry);

	const save = async (entry: Entry, body: { doc: unknown } | { text: string }) =>
		service
			.saveDraft(entry.id, {
				collection: contentCollection,
				slug: entry.workingSlug,
				metadata: entry.working.metadata as never,
				...("text" in body ? { format: "paragraphs", body: body.text } : body),
				expectedVersion: entry.version,
			} as never)
			.then((result) => result.entry);

	const publish = (entry: Entry) => publishDraft(testSite, store, { id: entry.id, expectedVersion: entry.version });

	interface Stored {
		metadata: JsonValue;
		mdx: string | null;
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
		const doc = readStoredDocument(row.doc, testSite);
		expect(doc).not.toBeNull();
		// The text of a body is not stored: the document is the only source.
		expect(row.mdx).toBeNull();
		// The hash and the search text are the document's.
		expect(row.content_hash).toBe(computeContentHash(row.metadata, doc as never));
		expect(row.search_text).toBe(documentText(testSite, doc as never, SEARCH_TEXT));
		return { ...row, doc: doc as NonNullable<typeof doc> };
	};

	it("creating a draft stores the document and no text", async () => {
		const draft = await createDraft({ doc: docOf(BODY) });

		const row = await expectConsistent(draft.id, "working");
		expect(contentOf(row.doc)).toEqual(contentOf(docOf(BODY)));
		expect(draft.working.doc).toEqual(row.doc);
	});

	it("creating a draft from text stores the document its format reads, like creating it from that document", async () => {
		const fromText = await createDraft({ text: "One\n\nTwo" });
		const fromDoc = await createDraft({ doc: fromText.working.doc });

		const textRow = await expectConsistent(fromText.id, "working");
		const docRow = await expectConsistent(fromDoc.id, "working");
		expect(textRow.doc.content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
		expect(docRow.doc).toEqual(fromText.working.doc);
	});

	it("a text its format cannot read is stored as an unparsed document of the text as given", async () => {
		const draft = await createDraft({ text: OPEN });

		const row = await expectConsistent(draft.id, "working");
		expect(row.doc).toMatchObject({ content: [{ type: "unparsed", attrs: { format: "paragraphs", source: OPEN } }] });
		expect(draft.working.doc).toEqual(row.doc);
	});

	describe("saving", () => {
		it("a changed body is stored with its new document", async () => {
			const draft = await createDraft({ doc: docOf(BODY) });

			const saved = await save(draft, { doc: docOf("Changed words") });

			expect(saved.version).toBe(draft.version + 1);
			const row = await expectConsistent(draft.id, "working");
			expect(contentOf(row.doc)).toEqual(contentOf(docOf("Changed words")));
			expect(saved.working.doc).toEqual(row.doc);
		});

		it("saving the same content without its ids changes nothing", async () => {
			const draft = await createDraft({ doc: docOf(BODY) });
			const before = await stored(draft.id, "working");
			const idless = {
				type: "doc",
				version: STORED_DOCUMENT_VERSION,
				content: withoutBlockIds(draft.working.doc.content),
			};

			const saved = await save(draft, { doc: idless });

			expect(saved.version).toBe(draft.version);
			expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
			expect(await stored(draft.id, "working")).toEqual(before);
		});

		it("a body that stops being readable becomes an unparsed document, and a document again when it is fixed", async () => {
			const draft = await createDraft({ doc: docOf(BODY) });

			const broken = await save(draft, { text: OPEN });
			expect((await expectConsistent(draft.id, "working")).doc).toMatchObject({ content: [{ type: "unparsed" }] });
			expect(broken.working.doc.content[0]?.type).toBe("unparsed");

			const fixed = await save(broken, { text: "Words" });
			const row = await expectConsistent(draft.id, "working");
			expect(row.doc.content.map((block) => block.type)).toEqual(["paragraph"]);
			expect(fixed.working.doc).toEqual(row.doc);
		});
	});

	describe("publishing", () => {
		it("copies the document to the published body", async () => {
			const draft = await createDraft({ doc: docOf(BODY) });

			const published = await publish(draft);

			const working = await expectConsistent(draft.id, "working");
			const copy = await expectConsistent(draft.id, "published");
			expect(copy.doc).toEqual(working.doc);
			expect(copy.content_hash).toBe(working.content_hash);
			expect(published.published?.doc).toEqual(published.working.doc);
		});

		it("a later save leaves the published document as it was", async () => {
			const published = await publish(await createDraft({ doc: docOf(BODY) }));
			const publishedBefore = await stored(published.id, "published");

			await save(published, { doc: docOf("A newer draft") });

			expect(await stored(published.id, "published")).toEqual(publishedBefore);
			expect(contentOf((await expectConsistent(published.id, "working")).doc)).toEqual(
				contentOf(docOf("A newer draft")),
			);
		});
	});

	describe("duplicating", () => {
		it("copies the document, and the copy has its own hash", async () => {
			const original = await createDraft({ doc: docOf(BODY) });

			const copy = await duplicateDraft(testSite, store, { id: original.id });

			const row = await expectConsistent(copy.id, "working");
			const source = await stored(original.id, "working");
			expect(contentOf(row.doc)).toEqual(contentOf(source.doc));
			expect(contentOf(copy.working.doc)).toEqual(contentOf(source.doc));
		});

		it("copies an unparsed body as it is", async () => {
			const original = await createDraft({ text: OPEN });

			const copy = await duplicateDraft(testSite, store, { id: original.id });

			const row = await expectConsistent(copy.id, "working");
			expect(row.doc).toMatchObject({ content: [{ type: "unparsed", attrs: { source: OPEN } }] });
		});
	});

	describe("reading", () => {
		it("the working copy, the entry and the export carry the document", async () => {
			const published = await publish(await createDraft({ doc: docOf(BODY) }));
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

		it("a stored value that is not a document reads as an unparsed body, not as an empty one", async () => {
			const draft = await createDraft({ doc: docOf(BODY) });
			await pool.query(`UPDATE "${schemaName}".entry_bodies SET doc = $1::jsonb WHERE entry_id = $2`, [
				JSON.stringify({ type: "doc", version: 99, content: [] }),
				draft.id,
			]);

			for (const doc of [
				(await store.getEntry(draft.id)).working.doc,
				(await store.getWorking({ entryId: draft.id })).doc,
			]) {
				expect(doc.content).toEqual([
					expect.objectContaining({ type: "unparsed", attrs: expect.objectContaining({ format: "mdx" }) }),
				]);
			}
		});

		it("the public read returns the stored document, and a list returns it only with the body", async () => {
			const published = await publish(await createDraft({ doc: docOf(BODY) }));
			const row = await stored(published.id, "published");

			const lookup = await store.getPublishedEntryBySlug({
				collection: contentCollection,
				slug: published.workingSlug ?? "",
			});
			if (lookup.status !== "current") throw new Error("expected the published entry");
			// The document that was stored, not one parsed again from the text.
			expect(lookup.entry.doc).toEqual(readStoredDocument(row.doc, testSite));
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
			const source = await createDraft({ doc: docOf(BODY) });

			const translation = (await service.createTranslation({ sourceId: source.id, locale: secondLocale as string }))
				.entry;

			const row = await expectConsistent(translation.id, "working");
			expect(row.doc).not.toBeNull();
			expect(translation.working.translation?.baseDoc).toEqual(
				readStoredDocument((await stored(source.id, "working")).doc, testSite),
			);
		});
	});
});
