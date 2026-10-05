import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import type { Collection } from "../../../core/collections";
import { forEachBlock, isBlockId, withoutBlockIds } from "../../../mdx/block-ids";
import { readStoredDocument, type StoredDocument } from "../../../mdx/stored-document";
import { createBulkService } from "../../../services/bulk-service";
import { createContentService } from "../../../services/content-service";
import { createContentStore, type Entry, migrateContentStore } from "../content-store";
import { isReferencesEqual } from "../store/rows";
import { closeGlobalPool, createIsolatedTestPool, dropIsolatedTestPool } from "./test-database";

/** A heading, three paragraphs and a list: blocks at two depths. */
const BODY = "# Title\n\nFirst paragraph\n\nSecond paragraph\n\nThird paragraph\n\n- one\n- two\n";
/** The same content in a spelling the serializer does not write. */
const UNTIDY = "Title\n=====\n\nFirst paragraph\n\nSecond paragraph\n\nThird paragraph\n\n* one\n* two\n";

/**
 * Block ids across the store: a block keeps its id through saves of the same or edited MDX, publishing and duplicating, and a document sent with ids keeps them.
 */
describe("block ids in the store", () => {
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
			draft.status === "published" ? draft : await store.publishEntry({ id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const createDraft = async (body: { mdx: string } | { doc: unknown }) =>
		service.createDraft({
			collection: contentCollection,
			slug: unique("post"),
			metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
			...body,
		} as never);

	const save = (entry: Entry, body: { mdx: string } | { doc: unknown }) =>
		service.saveDraft(entry.id, {
			collection: contentCollection,
			slug: entry.workingSlug,
			metadata: entry.working.metadata as never,
			expectedVersion: entry.version,
			...body,
		} as never);

	const publish = (entry: Entry) => store.publishEntry({ id: entry.id, expectedVersion: entry.version });

	const docOf = (value: unknown): StoredDocument => {
		const doc = readStoredDocument(value);
		if (!doc) throw new Error("expected a stored document");
		return doc;
	};

	/** The ids of a document in block order. */
	const idList = (value: unknown) => {
		const ids: (string | undefined)[] = [];
		forEachBlock(docOf(value).content, (node) => ids.push(node.id));
		return ids;
	};

	/** Block id by the text a heading or paragraph starts with (texts in these tests are unique). */
	const idsByText = (value: unknown) => {
		const found = new Map<string, string | undefined>();
		forEachBlock(docOf(value).content, (node) => {
			const text = node.content?.[0]?.text;
			if (text !== undefined) found.set(text, node.id);
		});
		return found;
	};

	const stored = async (entryId: string, state: "working" | "published") => {
		const found = (
			await pool.query<{ doc: unknown; mdx: string; updated_at: Date; xmin: string }>(
				`SELECT doc, mdx, updated_at, xmin::text FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = $2`,
				[entryId, state],
			)
		).rows[0];
		if (!found) throw new Error(`no ${state} body for ${entryId}`);
		return found;
	};

	const expectUniqueIds = (value: unknown) => {
		const ids = idList(value);
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(isBlockId(id)).toBe(true);
		expect(new Set(ids).size).toBe(ids.length);
	};

	it("gives every block of a new body its own id", async () => {
		const draft = await createDraft({ mdx: BODY });

		expectUniqueIds(draft.working.doc);
		expect(idList(draft.working.doc)).toHaveLength(9);
		expect((await stored(draft.id, "working")).doc).toEqual(draft.working.doc);
		// Ids are not part of the text.
		expect(draft.working.mdx).toBe(BODY);
	});

	describe("saving MDX", () => {
		it("saving the same MDX again keeps every id and writes nothing", async () => {
			const draft = await createDraft({ mdx: BODY });
			const before = await stored(draft.id, "working");

			const saved = await save(draft, { mdx: BODY });

			expect(saved.version).toBe(draft.version);
			expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
			const after = await stored(draft.id, "working");
			expect(after.doc).toEqual(before.doc);
			// Not even written back with the same value.
			expect(after.xmin).toBe(before.xmin);
			expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
			expect(saved.working.doc).toEqual(before.doc);
		});

		it("saving the same content in another spelling keeps every id and writes nothing", async () => {
			const draft = await createDraft({ mdx: BODY });
			const before = await stored(draft.id, "working");

			const saved = await save(draft, { mdx: UNTIDY });

			expect(saved.version).toBe(draft.version);
			expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
			const after = await stored(draft.id, "working");
			expect(after.doc).toEqual(before.doc);
			expect(after.xmin).toBe(before.xmin);
		});

		it("editing one paragraph keeps the ids of the others and of the edited one", async () => {
			const draft = await createDraft({ mdx: BODY });
			const before = idsByText(draft.working.doc);
			const blocksBefore = idList(draft.working.doc);

			const saved = await save(draft, { mdx: BODY.replace("Second paragraph", "Second paragraph, reworded") });

			expect(saved.version).toBe(draft.version + 1);
			const after = idsByText(saved.working.doc);
			expect(after.get("Title")).toBe(before.get("Title"));
			expect(after.get("First paragraph")).toBe(before.get("First paragraph"));
			expect(after.get("Third paragraph")).toBe(before.get("Third paragraph"));
			expect(after.get("Second paragraph, reworded")).toBe(before.get("Second paragraph"));
			// The whole tree, the list included, is the one it was.
			expect(idList(saved.working.doc)).toEqual(blocksBefore);
			expect((await stored(draft.id, "working")).doc).toEqual(saved.working.doc);
		});

		it("editing text inside a list item keeps the ids of the list, its items and the other blocks", async () => {
			const draft = await createDraft({ mdx: BODY });

			const saved = await save(draft, { mdx: BODY.replace("- two", "- two and more") });

			expect(idList(saved.working.doc)).toEqual(idList(draft.working.doc));
		});

		it("adding a paragraph keeps the other ids and gives the new block an id nobody has", async () => {
			const draft = await createDraft({ mdx: BODY });
			const before = idsByText(draft.working.doc);

			const saved = await save(draft, {
				mdx: BODY.replace("Third paragraph", "Inserted paragraph\n\nThird paragraph"),
			});

			const after = idsByText(saved.working.doc);
			for (const text of ["Title", "First paragraph", "Second paragraph", "Third paragraph"]) {
				expect(after.get(text)).toBe(before.get(text));
			}
			expect([...before.values()]).not.toContain(after.get("Inserted paragraph"));
			expectUniqueIds(saved.working.doc);
		});

		it("moving a paragraph keeps its id", async () => {
			const draft = await createDraft({ mdx: BODY });
			const before = idsByText(draft.working.doc);

			const saved = await save(draft, {
				mdx: "# Title\n\nThird paragraph\n\nFirst paragraph\n\nSecond paragraph\n\n- one\n- two\n",
			});

			const after = idsByText(saved.working.doc);
			for (const text of ["Title", "First paragraph", "Second paragraph", "Third paragraph"]) {
				expect(after.get(text)).toBe(before.get(text));
			}
		});

		it("a body that stops parsing and is fixed again gets ids from the draft it replaces, which has none", async () => {
			const draft = await createDraft({ mdx: BODY });
			const broken = await save(draft, { mdx: "Words\n\n<Unclosed" });
			expect(broken.working.doc).toBeNull();

			const fixed = await save(broken, { mdx: BODY });

			expectUniqueIds(fixed.working.doc);
			expect(withoutBlockIds(docOf(fixed.working.doc).content)).toEqual(
				withoutBlockIds(docOf(draft.working.doc).content),
			);
		});
	});

	describe("saving a document", () => {
		const given = (doc: StoredDocument, ids: readonly string[]): StoredDocument => ({
			...doc,
			content: doc.content.map((block, index) => ({ ...block, id: ids[index] ?? "zzzzzzzz" })),
		});

		it("a draft saved with a document keeps the ids the client sent", async () => {
			const draft = await createDraft({ mdx: BODY });
			const ids = ["clientaa", "clientbb", "clientcc", "clientdd", "clientee"];

			const saved = await save(draft, { doc: given(docOf(draft.working.doc), ids) });

			// The content is the same, so it is no new version: the ids the client chose are stored all the same.
			expect(saved.version).toBe(draft.version);
			expect(saved.updatedAt.getTime()).toBe(draft.updatedAt.getTime());
			expect(docOf(saved.working.doc).content.map((block) => block.id)).toEqual(ids);
			expect(docOf((await stored(draft.id, "working")).doc).content.map((block) => block.id)).toEqual(ids);
		});

		it("a document sent back as it was read changes nothing", async () => {
			const draft = await createDraft({ mdx: BODY });
			const before = await stored(draft.id, "working");

			const saved = await save(draft, { doc: draft.working.doc });

			expect(saved.version).toBe(draft.version);
			const after = await stored(draft.id, "working");
			expect(after.doc).toEqual(before.doc);
			expect(after.xmin).toBe(before.xmin);
		});

		it("a block sent without an id gets one, and a repeated id is given a new one to the later block", async () => {
			const draft = await createDraft({ mdx: "One\n\nTwo\n\nThree\n" });
			const doc = docOf(draft.working.doc);
			const [first, second, third] = doc.content;
			if (!first || !second || !third) throw new Error("fixture");

			const saved = await save(draft, {
				doc: {
					...doc,
					content: [{ ...first, id: "kept0001" }, { ...second, id: "kept0001" }, withoutBlockIds([third])[0]],
				},
			});

			const ids = idList(saved.working.doc);
			expect(ids[0]).toBe("kept0001");
			expectUniqueIds(saved.working.doc);
		});

		it("a document created with ids keeps them", async () => {
			const first = await createDraft({ mdx: BODY });
			const ids = ["newaaaaa", "newbbbbb", "newccccc", "newddddd", "neweeeee"];

			const created = await createDraft({ doc: given(docOf(first.working.doc), ids) });

			expect(docOf(created.working.doc).content.map((block) => block.id)).toEqual(ids);
		});
	});

	describe("publishing", () => {
		it("copies the ids to the published body", async () => {
			const draft = await createDraft({ mdx: BODY });

			const published = await publish(draft);

			expect(idList(published.published?.doc)).toEqual(idList(draft.working.doc));
			expect((await stored(draft.id, "published")).doc).toEqual((await stored(draft.id, "working")).doc);
			expectUniqueIds(published.published?.doc);
		});

		it("a later save changes the working ids only, and the next publish copies them", async () => {
			const published = await publish(await createDraft({ mdx: BODY }));
			const publishedIds = idList(published.published?.doc);

			const edited = await save(published, { mdx: BODY.replace("First paragraph", "First paragraph, reworded") });

			expect(idList((await stored(published.id, "published")).doc)).toEqual(publishedIds);
			// The edited paragraph is the same block: the two bodies still share every id.
			expect(idList(edited.working.doc)).toEqual(publishedIds);
			const again = await publish(edited);
			expect(idList(again.published?.doc)).toEqual(publishedIds);
		});
	});

	describe("duplicating", () => {
		it("keeps the ids of the copy, unique within it, and leaves the original as it was", async () => {
			const original = await createDraft({ mdx: BODY });
			const before = await stored(original.id, "working");

			const copy = await store.duplicateEntry({ id: original.id });

			expect(idList(copy.working.doc)).toEqual(idList(original.working.doc));
			expectUniqueIds(copy.working.doc);
			expect((await stored(copy.id, "working")).doc).toEqual(before.doc);
			expect(await stored(original.id, "working")).toEqual(before);
		});

		it("the copy and the original do not affect each other's ids when one is edited", async () => {
			const original = await createDraft({ mdx: BODY });
			const copy = await store.duplicateEntry({ id: original.id });

			const edited = await save(copy, { mdx: BODY.replace("Third paragraph", "Third paragraph, reworded") });

			expect(idList(edited.working.doc)).toEqual(idList(original.working.doc));
			expect((await stored(original.id, "working")).doc).toEqual(original.working.doc);
		});
	});

	describe("changes that leave the body alone", () => {
		it("a bulk move to another folder keeps every id", async () => {
			const entry = await createDraft({ mdx: BODY });
			const folder = await store.createFolder({
				collection: contentCollection,
				parentId: null,
				name: unique("Folder"),
			});

			const { results } = await createBulkService(store).run({
				op: "folder.move",
				folderId: folder.id,
				items: [{ id: entry.id, expectedVersion: entry.version }],
			});

			expect(results[0]).toMatchObject({ ok: true });
			expect((await store.getEntry(entry.id)).working.doc).toEqual(entry.working.doc);
		});

		it("editing a template keeps the ids of the blocks that stay", async () => {
			const template = await store.createTemplate({ name: unique("Template"), mdx: BODY });
			const updated = await store.updateTemplate({
				id: template.id,
				expectedVersion: template.version,
				mdx: BODY.replace("Second paragraph", "Second paragraph, reworded"),
			});

			expect(idList(updated.doc)).toEqual(idList(template.doc));
		});
	});

	describe("reference occurrences", () => {
		const imageBody = (mediaId: string) =>
			`# Title\n\nIntro paragraph\n\n<Image mediaId="${mediaId}" alt="Picture" />\n\nLast paragraph\n`;

		const withMedia = async () => {
			const mediaId = randomUUID();
			await pool.query(`INSERT INTO "${schemaName}".media_assets (id) VALUES ($1)`, [mediaId]);
			return mediaId;
		};

		const imageBlockId = (value: unknown) => {
			let id: string | undefined;
			forEachBlock(docOf(value).content, (node) => {
				if (node.type === "image") id = node.id;
			});
			return id;
		};

		/** The media reference to `mediaId` (a required relation field of the entry makes references of its own). */
		const mediaReference = async (entryId: string, mediaId: string) =>
			(await store.getWorkingReferences({ entryId })).find(
				(reference) => reference.kind === "media" && reference.targetId === mediaId,
			);

		it("stores the block id of the image an occurrence is in", async () => {
			const mediaId = await withMedia();
			const draft = await createDraft({ mdx: imageBody(mediaId) });

			const reference = await mediaReference(draft.id, mediaId);
			expect(reference?.occurrences).toEqual([
				{ type: "mdx", line: 5, column: 1, blockId: imageBlockId(draft.working.doc) },
			]);
		});

		it("saving the same body again, in the same or another spelling, keeps the occurrences and the version", async () => {
			const mediaId = await withMedia();
			const draft = await createDraft({ mdx: imageBody(mediaId) });
			const before = await store.getWorkingReferences({ entryId: draft.id });

			const same = await save(draft, { mdx: imageBody(mediaId) });
			expect(same.version).toBe(draft.version);
			const untidy = await save(same, { mdx: imageBody(mediaId).replace("# Title", "Title\n=====") });
			expect(untidy.version).toBe(draft.version);
			const fromDoc = await save(untidy, { doc: untidy.working.doc });
			expect(fromDoc.version).toBe(draft.version);

			expect(await store.getWorkingReferences({ entryId: draft.id })).toEqual(before);
		});

		it("counts the block id as part of an occurrence when comparing references", () => {
			const reference = (blockId?: string) => ({
				kind: "media" as const,
				targetId: randomUUID(),
				isStale: false,
				occurrences: [{ type: "mdx" as const, line: 1, column: 1, ...(blockId ? { blockId } : {}) }],
			});
			const base = reference("aaaaaaaa");
			expect(isReferencesEqual([base], [{ ...base, occurrences: [{ ...base.occurrences[0] }] }])).toBe(true);
			expect(
				isReferencesEqual([base], [{ ...base, occurrences: [{ ...base.occurrences[0], blockId: "bbbbbbbb" }] }]),
			).toBe(false);
			expect(isReferencesEqual([base], [{ ...base, occurrences: [{ type: "mdx", line: 1, column: 1 }] }])).toBe(false);
		});

		it("editing another block keeps the block id of the occurrence", async () => {
			const mediaId = await withMedia();
			const draft = await createDraft({ mdx: imageBody(mediaId) });

			const saved = await save(draft, {
				mdx: imageBody(mediaId).replace("Intro paragraph", "Intro paragraph, reworded"),
			});

			expect(saved.version).toBe(draft.version + 1);
			const reference = await mediaReference(draft.id, mediaId);
			expect(reference?.occurrences).toEqual([
				{ type: "mdx", line: 5, column: 1, blockId: imageBlockId(draft.working.doc) },
			]);
		});
	});
});
