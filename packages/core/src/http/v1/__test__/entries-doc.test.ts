import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentCollection, requiredMetadata, secondLocale } from "../../../../test/any-site";
import { contentOf, docOf } from "../../../../test/stored-content";
import { type Cms, fakeCms } from "../../../cms";
import type { Collection } from "../../../core/collections";
import { MAX_DOC_BYTES, MAX_TEXT_BYTES } from "../../../core/limits";
import type { Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { isBlockId, withoutBlockIds } from "../../../doc/block-ids";
import { paragraphsFormat } from "../../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../../format/registry";
import { createContentService } from "../../../services/content-service";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
} from "../../../testing";
import { GET as getEntry, PATCH as patchEntry } from "../entries/[id]/route";
import { POST as postEntries } from "../entries/route";
import { GET as getTemplates } from "../templates/route";

/** A document of a heading, a paragraph and a list, as a client would send it. */
const sampleDoc = () => docOf("# Title\n\nSome *emphasis* here\n\n- one\n- two");

const send = (url: string, method: string, body: unknown) =>
	new Request(url, {
		method,
		headers: { origin: "http://localhost", "content-type": "application/json" },
		body: JSON.stringify(body),
	});

/** The admin entry API with a real store and service: bodies are accepted as a stored document as well as text in a format. */
describe("entry API with a stored document", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let service: ReturnType<typeof createContentService<Entry>>;
	let cms: Cms;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { schema: schemaName });
		store = createContentStore(pool, { schema: schemaName });
		service = createContentService<Entry>(store, { formats: async () => createFormatRegistry([paragraphsFormat]) });
		cms = fakeCms({ store, contentService: service, formats: [paragraphsFormat] });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const draft = await service.createDraft({
			collection: to,
			slug: unique(to),
			metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
			format: "paragraphs",
			body: "Body",
		});
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const post = async (body: Record<string, unknown>) =>
		postEntries(
			send("http://localhost/api/cms/v1/entries", "POST", {
				collection: contentCollection,
				slug: unique("post"),
				metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
				...body,
			}),
			{ cms },
		);

	const patch = (id: string, body: Record<string, unknown>) =>
		patchEntry(send(`http://localhost/api/cms/v1/entries/${id}`, "PATCH", body), {
			params: Promise.resolve({ id }),
			cms,
		});

	const read = async (id: string) => {
		const res = await getEntry(new Request(`http://localhost/api/cms/v1/entries/${id}`), {
			params: Promise.resolve({ id }),
			cms,
		});
		expect(res.status).toBe(200);
		return (await res.json()) as Entry;
	};

	const created = async (body: Record<string, unknown>) => {
		const res = await post(body);
		expect(res.status).toBe(201);
		return (await res.json()) as Entry;
	};

	const storedRow = async (id: string) =>
		(
			await pool.query(
				`SELECT mdx, doc, content_hash, updated_at FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
				[id],
			)
		).rows[0];

	it("creates an entry from a document, storing the document and no text", async () => {
		const doc = sampleDoc();

		const entry = await created({ doc });

		expect(entry.working.doc).toEqual(doc);
		const row = await storedRow(entry.id);
		// The old text column is no longer written.
		expect(row.mdx).toBeNull();
		expect(row.doc).toEqual(doc);
	});

	it("creates an entry from text with its format, and with no body it is empty", async () => {
		const fromText = await created({ format: "paragraphs", body: "One\n\nTwo" });
		expect(contentOf(fromText.working.doc)).toEqual(contentOf(docOf("One\n\nTwo")));
		expect((await storedRow(fromText.id)).mdx).toBeNull();

		const empty = await created({});
		expect(empty.working.doc.content).toEqual([]);
	});

	it("rejects a create that sends both a body and doc", async () => {
		const res = await post({ format: "paragraphs", body: "Text", doc: sampleDoc() });
		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("invalid_input");
	});

	it("rejects a create with a document that is not a stored document", async () => {
		const doc = sampleDoc();
		const invalid: unknown[] = [
			{ ...(doc as object), version: 999 },
			{ type: "doc", version: 1, content: "not a list" },
			{ type: "paragraph" },
			"text",
			42,
			null,
			[],
		];
		for (const value of invalid) {
			const res = await post({ doc: value });
			expect(res.status, JSON.stringify(value)).toBe(400);
			expect((await res.json()).code).toBe("invalid_input");
		}
	});

	it("saves a document with a patch", async () => {
		const entry = await created({ format: "paragraphs", body: "First" });
		const doc = sampleDoc();

		const res = await patch(entry.id, { expectedVersion: entry.version, doc });

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		expect(saved.version).toBe(entry.version + 1);
		expect(saved.working.doc).toEqual(doc);
		const row = await storedRow(entry.id);
		expect(row.mdx).toBeNull();
		expect(row.doc).toEqual(doc);
	});

	it("keeps the block ids of a document sent with a patch, and gives a block sent without one its own", async () => {
		const entry = await created({ format: "paragraphs", body: "First" });
		const parsed = sampleDoc();
		const [heading, paragraph, list] = parsed.content;
		if (!heading || !paragraph || !list) throw new Error("fixture");
		const doc = {
			...parsed,
			content: [{ ...heading, id: "client01" }, { ...paragraph, id: "client02" }, withoutBlockIds([list])[0]],
		};

		const res = await patch(entry.id, { expectedVersion: entry.version, doc });

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		const ids = saved.working.doc?.content.map((block) => block.id);
		expect(ids?.slice(0, 2)).toEqual(["client01", "client02"]);
		expect(isBlockId(ids?.[2])).toBe(true);
		expect((await storedRow(entry.id)).doc).toEqual(saved.working.doc);
	});

	it("keeps the block ids of the draft when a patch sends edited text", async () => {
		const entry = await created({ format: "paragraphs", body: "One\n\nTwo" });

		const res = await patch(entry.id, {
			expectedVersion: entry.version,
			format: "paragraphs",
			body: "One\n\nTwo, edited",
		});

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		expect(saved.working.doc?.content.map((block) => block.id)).toEqual(
			entry.working.doc?.content.map((block) => block.id),
		);
	});

	it("keeps the body when a patch sends neither a body nor doc", async () => {
		const entry = await created({ doc: sampleDoc() });

		const res = await patch(entry.id, { expectedVersion: entry.version, metadata: entry.working.metadata });

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		expect(saved.version).toBe(entry.version);
		expect(saved.working.doc).toEqual(entry.working.doc);
	});

	it("rejects a patch that sends both a body and doc", async () => {
		const entry = await created({ format: "paragraphs", body: "First" });

		const res = await patch(entry.id, {
			expectedVersion: entry.version,
			format: "paragraphs",
			body: "Text",
			doc: sampleDoc(),
		});

		expect(res.status).toBe(400);
		expect((await res.json()).code).toBe("invalid_input");
		expect((await read(entry.id)).working.doc).toEqual(entry.working.doc);
	});

	it("rejects a patch with a document that is not a stored document, and changes nothing", async () => {
		const entry = await created({ format: "paragraphs", body: "First" });
		const doc = sampleDoc();

		for (const value of [{ ...(doc as object), version: 999 }, { type: "doc", version: 1 }, "text", null]) {
			const res = await patch(entry.id, { expectedVersion: entry.version, doc: value });
			expect(res.status, JSON.stringify(value)).toBe(400);
			expect((await res.json()).code).toBe("invalid_input");
		}
		const after = await read(entry.id);
		expect(after.version).toBe(entry.version);
		expect(after.working.doc).toEqual(entry.working.doc);
	});

	it("rejects a document larger than the limit with 413", async () => {
		const doc = {
			type: "doc",
			version: 1,
			content: [{ type: "paragraph", content: [{ type: "text", text: "x".repeat(MAX_DOC_BYTES) }] }],
		};
		const res = await post({ doc });
		expect(res.status).toBe(413);
		expect((await res.json()).code).toBe("body_too_large");
	});

	it("accepts a document larger than the text limit", async () => {
		// Above the text limit as JSON but within the document limit.
		// Few long paragraphs keep the test fast: the JSON overhead per paragraph is what pushes it over the text limit.
		const paragraph = { type: "paragraph", content: [{ type: "text", text: "word ".repeat(72).trim() }] };
		const doc = { type: "doc", version: 1, content: Array.from({ length: 5_200 }, () => paragraph) };
		expect(Buffer.byteLength(JSON.stringify(doc))).toBeGreaterThan(MAX_TEXT_BYTES);
		expect(Buffer.byteLength(JSON.stringify(doc))).toBeLessThan(MAX_DOC_BYTES);

		const res = await post({ doc });

		expect(res.status).toBe(201);
	});

	it("saves the document of a read back unchanged: no new version, nothing written", async () => {
		const entry = await created({ format: "paragraphs", body: "One\n\nTwo" });
		const before = await storedRow(entry.id);
		const loaded = await read(entry.id);
		expect(loaded.working.doc).not.toBeNull();

		const res = await patch(entry.id, { expectedVersion: loaded.version, doc: loaded.working.doc });

		expect(res.status).toBe(200);
		const saved = (await res.json()) as Entry;
		expect(saved.version).toBe(loaded.version);
		expect(saved.working.contentHash).toBe(loaded.working.contentHash);
		expect(await storedRow(entry.id)).toEqual(before);
	});

	it.skipIf(!secondLocale)(
		"returns the source's document with a translation, and keeps the confirmed document it is sent",
		async () => {
			const source = await created({ format: "paragraphs", body: "First\n\nSecond" });
			expect(source.working.doc).not.toBeNull();
			const created_ = await service.createTranslation({
				sourceId: source.id,
				locale: secondLocale as string,
			});

			const loaded = (await read(created_.id)) as Entry & { source?: { doc: unknown } };
			expect(loaded.source?.doc).toEqual(source.working.doc);
			expect(loaded.working.translation).toEqual({ version: 4, baseDoc: source.working.doc });

			// The source changes; the next read carries its new document, and its blocks keep their ids.
			const changed = await patch(source.id, {
				expectedVersion: source.version,
				format: "paragraphs",
				body: "Second\n\nFirst",
			});
			expect(changed.status).toBe(200);
			const reloaded = (await read(created_.id)) as Entry & { source?: { doc: { content: { id: string }[] } } };
			const [first, second] = (source.working.doc as unknown as { content: { id: string }[] }).content;
			expect(reloaded.source?.doc.content.map((block) => block.id)).toEqual([second?.id, first?.id]);

			// Confirming sends the new source and its document back.
			const confirmed = await patch(created_.id, {
				expectedVersion: loaded.version,
				translation: { version: 4, baseDoc: reloaded.source?.doc },
			});
			expect(confirmed.status).toBe(200);
			expect(((await confirmed.json()) as Entry).working.translation).toEqual({
				version: 4,
				baseDoc: reloaded.source?.doc,
			});

			const invalid = await patch(created_.id, {
				expectedVersion: loaded.version + 1,
				translation: { version: 4, baseDoc: { type: "doc" } },
			});
			expect(invalid.status).toBe(400);
		},
	);

	it("lists templates with their documents", async () => {
		const template = await store.createTemplate({
			name: unique("doc template"),
			doc: sampleDoc(),
		});

		const res = await getTemplates(new Request("http://localhost/api/cms/v1/templates"), { cms });

		const { items } = await res.json();
		const listed = items.find((item: { id: string }) => item.id === template.id);
		expect(listed.mdx).toBeUndefined();
		expect(contentOf(listed.doc)).toEqual(contentOf(sampleDoc()));
	});
});
