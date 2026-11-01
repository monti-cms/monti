import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentCollection, requiredMetadata, secondLocale } from "../../../../../test/any-site";
import { paragraphsFormat } from "../../../../../test/paragraphs-format";
import { testConfig, testSite } from "../../../../../test/site";
import { contentOf, docOf } from "../../../../../test/stored-content";
import { type Cms, fakeCms } from "../../../../cms";
import type { Collection } from "../../../../core/collections";
import { MAX_DOC_BYTES, MAX_TEXT_BYTES } from "../../../../core/limits";
import type { Entry } from "../../../../core/store";
import { publishDraft } from "../../../../core/store/__test__/seed";
import { isBlockId, withoutBlockIds } from "../../../../doc/block-ids";
import { entryLinkIds } from "../../../../doc/entry-links";
import { createFormatRegistry } from "../../../../format/registry";
import { defineFormat } from "../../../../format/types";
import { createContentService } from "../../../../services/content-service";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	routeCaller,
} from "../../../../testing";
import { GET as getEntryHandler, PATCH as patchEntryHandler } from "../[id]/route";
import { POST as postEntriesHandler } from "../route";

const getEntry = routeCaller(getEntryHandler);
const patchEntry = routeCaller(patchEntryHandler);
const postEntries = routeCaller(postEntriesHandler);

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
	let service: ReturnType<typeof createContentService>;
	let cms: Cms;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		service = createContentService(store, {
			site: testSite,
			formats: async () => createFormatRegistry([paragraphsFormat]),
		});
		cms = fakeCms({ config: testConfig, store, contentService: service, formats: [paragraphsFormat] });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const draft = (
			await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
				format: "paragraphs",
				body: "Body",
			})
		).entry;
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const post = async (body: Record<string, unknown>) =>
		postEntries(
			send("http://localhost/api/monti/v1/entries", "POST", {
				collection: contentCollection,
				slug: unique("entry"),
				metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
				...body,
			}),
			{ cms },
		);

	const patch = (id: string, body: Record<string, unknown>) =>
		patchEntry(send(`http://localhost/api/monti/v1/entries/${id}`, "PATCH", body), {
			params: Promise.resolve({ id }),
			cms,
		});

	const read = async (id: string) => {
		const res = await getEntry(new Request(`http://localhost/api/monti/v1/entries/${id}`), {
			params: Promise.resolve({ id }),
			cms,
		});
		expect(res.status).toBe(200);
		return (await res.json()) as Entry;
	};

	const created = async (body: Record<string, unknown>) => {
		const res = await post(body);
		expect(res.status).toBe(201);
		return ((await res.json()) as { entry: Entry }).entry;
	};

	const storedRow = async (id: string) =>
		(
			await pool.query(
				`SELECT doc, content_hash, updated_at FROM "${schemaName}".entry_bodies WHERE entry_id = $1 AND state = 'working'`,
				[id],
			)
		).rows[0];

	it("WRITE-S1 creates an entry from a document, storing the document and no text", async () => {
		const doc = sampleDoc();

		const entry = await created({ doc });

		expect(entry.working.doc).toEqual(doc);
		const row = await storedRow(entry.id);
		expect(row.doc).toEqual(doc);
	});

	it("WRITE-S1 creates an entry from text with its format, and with no body it is empty", async () => {
		const fromText = await created({ format: "paragraphs", body: "One\n\nTwo" });
		expect(contentOf(fromText.working.doc)).toEqual(contentOf(docOf("One\n\nTwo")));

		const empty = await created({});
		expect(empty.working.doc.content).toEqual([]);
	});

	it("WRITE-S7 rejects a create that sends both a body and doc", async () => {
		const res = await post({ format: "paragraphs", body: "Text", doc: sampleDoc() });
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("invalid_input");
	});

	it("WRITE-S7 rejects a create with a document that is not a stored document", async () => {
		// Which values are not a stored document is `documentInputBody`'s (core/__test__/snapshot.test.ts); this is the route reaching it.
		const res = await post({ doc: { ...(sampleDoc() as object), version: 999 } });
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("invalid_input");
	});

	it("WRITE-S1 saves a document with a patch", async () => {
		const entry = await created({ format: "paragraphs", body: "First" });
		const doc = sampleDoc();

		const res = await patch(entry.id, { expectedVersion: entry.version, doc });

		expect(res.status).toBe(200);
		const saved = ((await res.json()) as { entry: Entry }).entry;
		expect(saved.version).toBe(entry.version + 1);
		expect(saved.working.doc).toEqual(doc);
		const row = await storedRow(entry.id);
		expect(row.doc).toEqual(doc);
	});

	it("TRANS-B1 keeps the block ids of a document sent with a patch, and gives a block sent without one its own", async () => {
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
		const saved = ((await res.json()) as { entry: Entry }).entry;
		const ids = saved.working.doc?.content.map((block) => block.id);
		expect(ids?.slice(0, 2)).toEqual(["client01", "client02"]);
		expect(isBlockId(ids?.[2])).toBe(true);
		expect((await storedRow(entry.id)).doc).toEqual(saved.working.doc);
	});

	it("TRANS-B1 keeps the block ids of the draft when a patch sends edited text", async () => {
		const entry = await created({ format: "paragraphs", body: "One\n\nTwo" });

		const res = await patch(entry.id, {
			expectedVersion: entry.version,
			format: "paragraphs",
			body: "One\n\nTwo, edited",
		});

		expect(res.status).toBe(200);
		const saved = ((await res.json()) as { entry: Entry }).entry;
		expect(saved.working.doc?.content.map((block) => block.id)).toEqual(
			entry.working.doc?.content.map((block) => block.id),
		);
	});

	it("WRITE-S1 keeps the body when a patch sends neither a body nor doc", async () => {
		const entry = await created({ doc: sampleDoc() });

		const res = await patch(entry.id, { expectedVersion: entry.version, metadata: entry.working.metadata });

		expect(res.status).toBe(200);
		const saved = ((await res.json()) as { entry: Entry }).entry;
		expect(saved.version).toBe(entry.version);
		expect(saved.working.doc).toEqual(entry.working.doc);
	});

	it("WRITE-S7 rejects a patch that sends both a body and doc", async () => {
		const entry = await created({ format: "paragraphs", body: "First" });

		const res = await patch(entry.id, {
			expectedVersion: entry.version,
			format: "paragraphs",
			body: "Text",
			doc: sampleDoc(),
		});

		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("invalid_input");
		expect((await read(entry.id)).working.doc).toEqual(entry.working.doc);
	});

	it("WRITE-S7 rejects a patch with a document that is not a stored document, and changes nothing", async () => {
		const entry = await created({ format: "paragraphs", body: "First" });

		const res = await patch(entry.id, { expectedVersion: entry.version, doc: "text" });
		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("invalid_input");
		const after = await read(entry.id);
		expect(after.version).toBe(entry.version);
		expect(after.working.doc).toEqual(entry.working.doc);
	});

	it("WRITE-S7 accepts a document larger than the text limit", async () => {
		// Above the text limit as JSON but within the document limit.
		// Few long paragraphs keep the test fast: the JSON overhead per paragraph is what pushes it over the text limit.
		const paragraph = { type: "paragraph", content: [{ type: "text", text: "word ".repeat(72).trim() }] };
		const doc = { type: "doc", version: 3, content: Array.from({ length: 5_200 }, () => paragraph) };
		expect(Buffer.byteLength(JSON.stringify(doc))).toBeGreaterThan(MAX_TEXT_BYTES);
		expect(Buffer.byteLength(JSON.stringify(doc))).toBeLessThan(MAX_DOC_BYTES);

		const res = await post({ doc });

		expect(res.status).toBe(201);
	});

	it("WRITE-S3 saves the document of a read back unchanged: no new version, nothing written", async () => {
		const entry = await created({ format: "paragraphs", body: "One\n\nTwo" });
		const before = await storedRow(entry.id);
		const loaded = await read(entry.id);
		expect(loaded.working.doc).not.toBeNull();

		const res = await patch(entry.id, { expectedVersion: loaded.version, doc: loaded.working.doc });

		expect(res.status).toBe(200);
		const saved = ((await res.json()) as { entry: Entry }).entry;
		expect(saved.version).toBe(loaded.version);
		expect(saved.working.contentHash).toBe(loaded.working.contentHash);
		expect(await storedRow(entry.id)).toEqual(before);
	});

	it.skipIf(!secondLocale)(
		"TRANS-S1 returns the source's document with a translation, and keeps the confirmed document it is sent",
		async () => {
			const source = await created({ format: "paragraphs", body: "First\n\nSecond" });
			expect(source.working.doc).not.toBeNull();
			const created_ = (
				await service.createTranslation({
					sourceId: source.id,
					locale: secondLocale as string,
				})
			).entry;

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
			expect(((await confirmed.json()) as { entry: Entry }).entry.working.translation).toEqual({
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
});

/**
 * The format option on the admin API, against a real store: a text in any format is read by its plugin, normalised and validated by core, and stored as a
 * document; and a document is written back as text with its links as the real paths of their targets.
 */
describe("the format option of the admin API", () => {
	const send = (url: string, method: string, body?: unknown) =>
		new Request(url, {
			method,
			headers: { origin: "http://localhost", "content-type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
		});

	const oneWay = defineFormat({
		name: "one-way",
		label: "One way",
		mimeType: "text/plain",
		extension: "out",
		export: (document) => `${document.content.length} blocks`,
	});

	const crashing = defineFormat({
		name: "crashing",
		label: "Crashing",
		mimeType: "text/plain",
		extension: "txt",
		export: () => {
			throw new Error("secret detail");
		},
		import: () => {
			throw new Error("secret detail");
		},
	});

	const FORMATS = [paragraphsFormat, oneWay, crashing];

	const linkable = testSite.contentPath(contentCollection, "probe") !== null;

	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let service: ReturnType<typeof createContentService>;
	let cms: Cms;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;
	const targets = new Map<Collection, string>();

	beforeAll(async () => {
		const isolated = await createIsolatedTestPool();
		pool = isolated.pool;
		schemaName = isolated.schemaName;
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		const registry = createFormatRegistry(FORMATS);
		service = createContentService(store, { site: testSite, formats: async () => registry });
		cms = fakeCms({ config: testConfig, store, contentService: service, formats: FORMATS });
	});

	afterAll(async () => {
		if (pool && schemaName) await dropIsolatedTestPool(pool, schemaName);
		await closeGlobalPool();
	});

	const relationTarget = async (to: Collection): Promise<string> => {
		const known = targets.get(to);
		if (known) return known;
		const draft = (
			await service.createDraft({
				collection: to,
				slug: unique(to),
				metadata: await requiredMetadata(to, unique(`target ${to}`), relationTarget),
				format: "paragraphs",
				body: "Body",
			})
		).entry;
		const published =
			draft.status === "published"
				? draft
				: await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
		targets.set(to, published.id);
		return published.id;
	};

	const post = async (body: Record<string, unknown>) =>
		postEntries(
			send("http://localhost/api/monti/v1/entries", "POST", {
				collection: contentCollection,
				slug: unique("entry"),
				metadata: await requiredMetadata(contentCollection, unique("Post"), relationTarget),
				...body,
			}),
			{ cms },
		);

	const created = async (body: Record<string, unknown>) => {
		const res = await post(body);
		expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
		return ((await res.json()) as { entry: Entry }).entry;
	};

	const _patch = (id: string, body: Record<string, unknown>) =>
		patchEntry(send(`http://localhost/api/monti/v1/entries/${id}`, "PATCH", body), {
			params: Promise.resolve({ id }),
			cms,
		});

	const read = async (id: string, query = "") => {
		const res = await getEntry(new Request(`http://localhost/api/monti/v1/entries/${id}${query}`), {
			params: Promise.resolve({ id }),
			cms,
		});
		return { status: res.status, body: await res.json() };
	};

	/** A published post with a slug, the target of the links below. */
	const publishedPost = async (slug: string) => {
		const draft = (
			await service.createDraft({
				collection: contentCollection,
				slug,
				metadata: await requiredMetadata(contentCollection, unique("Target"), relationTarget),
				format: "paragraphs",
				body: "Target body",
			})
		).entry;
		return publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
	};

	describe("writing", () => {
		it("FMT-P3 an unknown format is a 400 unknown_format, and nothing is stored", async () => {
			const res = await post({ format: "hugo", body: "Text" });

			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({
				error: { code: "unknown_format", issues: [{ params: { format: "hugo" } }] },
			});
		});

		it("FMT-P1 a format that throws is a 422 format_import_failed, without its own message", async () => {
			const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);

			const res = await post({ format: "crashing", body: "Text" });

			expect(res.status).toBe(422);
			const body = await res.json();
			expect(body.error.code).toBe("format_import_failed");
			expect(JSON.stringify(body)).not.toContain("secret detail");
			quiet.mockRestore();
		});

		it("FMT-P3 with no format installed a text write is a 400 unknown_format, and a document write still works", async () => {
			const bare = fakeCms({
				config: testConfig,
				store,
				contentService: createContentService(store, {
					site: testSite,
					formats: async () => createFormatRegistry([]),
				}),
				formats: [],
			});
			const write = async (body: Record<string, unknown>) =>
				postEntries(
					send("http://localhost/api/monti/v1/entries", "POST", {
						collection: contentCollection,
						slug: unique("bare"),
						metadata: await requiredMetadata(contentCollection, unique("Bare"), relationTarget),
						...body,
					}),
					{ cms: bare },
				);

			const text = await write({ format: "paragraphs", body: "Some text" });
			expect(text.status).toBe(400);
			expect((await text.json()).error.code).toBe("unknown_format");

			const doc = await write({ doc: docOf("Some text") });
			expect(doc.status).toBe(201);
		});

		it("WRITE-S7 rejects a text over the size limit with 413 body_too_large", async () => {
			const res = await post({ format: "paragraphs", body: "a".repeat(2 * 1024 * 1024 + 1) });

			expect(res.status).toBe(413);
			expect((await res.json()).error.code).toBe("body_too_large");
		});
	});

	describe("reading", () => {
		it("FMT-P3 ?format= adds the body as text to the draft, written to be imported again", async () => {
			const entry = await created({ format: "paragraphs", body: "One\n\nTwo" });

			const { status, body } = await read(entry.id, "?format=paragraphs");

			expect(status).toBe(200);
			expect(body.working.body).toBe("One\n\nTwo");
			expect(body.working.doc).toEqual(entry.working.doc);
			expect(body.published).toBeUndefined();
		});

		it("an unknown format is a 400 unknown_format", async () => {
			const entry = await created({ doc: docOf("Plain") });

			const { status, body } = await read(entry.id, "?format=hugo");

			expect(status).toBe(400);
			expect(body.error.code).toBe("unknown_format");
		});

		it.skipIf(!linkable)(
			"FMT-R7 writes an internal link as the real path of its target, which follows a change of the target's address",
			async () => {
				const slug = unique("moving");
				const target = await publishedPost(slug);
				const entry = await created({
					doc: {
						type: "doc",
						version: 3,
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: "the target", marks: [{ type: "link", attrs: { entryId: target.id } }] },
								],
							},
						],
					},
				});
				const before = (await read(entry.id, "?format=paragraphs")).body.working.body as string;
				expect(before).toBe(
					`[the target](${testSite.localizePath(target.locale, testSite.contentPath(contentCollection, slug) as string)})`,
				);

				// The target gets a new address: the document is untouched, and the text follows.
				const current = await store.getEntry(target.id);
				const renamed = unique("renamed-target");
				await service.saveDraft(target.id, {
					collection: contentCollection,
					slug: renamed,
					metadata: current.working.metadata as never,
					doc: current.working.doc,
					expectedVersion: current.version,
				} as never);

				const after = (await read(entry.id, "?format=paragraphs")).body.working.body as string;
				expect(after).toBe(
					`[the target](${testSite.localizePath(target.locale, testSite.contentPath(contentCollection, renamed) as string)})`,
				);
				expect(entryLinkIds((await read(entry.id)).body.working.doc.content)).toEqual([target.id]);
			},
		);
	});
});
