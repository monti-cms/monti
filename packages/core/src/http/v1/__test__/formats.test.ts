import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { contentCollection, requiredMetadata } from "../../../../test/any-site";
import { testConfig, testSite } from "../../../../test/site";
import { contentOf, docOf } from "../../../../test/stored-content";
import { type Cms, fakeCms } from "../../../cms";
import type { Collection } from "../../../core/collections";
import type { Entry } from "../../../core/store";
import { publishDraft } from "../../../core/store/__test__/seed";
import { entryLinkIds } from "../../../doc/entry-links";
import { paragraphsFormat } from "../../../format/__test__/paragraphs-format";
import { createFormatRegistry } from "../../../format/registry";
import { defineFormat } from "../../../format/types";
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
import { GET as getMeta } from "../meta/route";
import { DELETE as deleteTemplate, GET as getTemplate, PATCH as patchTemplate } from "../templates/[id]/route";
import { GET as getTemplates, POST as postTemplate } from "../templates/route";

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

/**
 * The format option on the admin API, against a real store: a text in any format is read by its plugin, normalised and validated by core, and stored as a
 * document; and a document is written back as text with its links as the real paths of their targets.
 */
describe("the format option of the admin API", () => {
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
		await migrateContentStore(pool, { site: testSite, schema: schemaName });
		store = createContentStore(pool, { site: testSite, schema: schemaName });
		const registry = createFormatRegistry(FORMATS);
		service = createContentService<Entry>(store, { site: testSite, formats: async () => registry });
		cms = fakeCms({ config: testConfig, store, contentService: service, formats: FORMATS });
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
				: await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
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

	const created = async (body: Record<string, unknown>) => {
		const res = await post(body);
		expect(res.status, JSON.stringify(await res.clone().json())).toBe(201);
		return (await res.json()) as Entry;
	};

	const patch = (id: string, body: Record<string, unknown>) =>
		patchEntry(send(`http://localhost/api/cms/v1/entries/${id}`, "PATCH", body), {
			params: Promise.resolve({ id }),
			cms,
		});

	const read = async (id: string, query = "") => {
		const res = await getEntry(new Request(`http://localhost/api/cms/v1/entries/${id}${query}`), {
			params: Promise.resolve({ id }),
			cms,
		});
		return { status: res.status, body: await res.json() };
	};

	/** A published post with a slug, the target of the links below. */
	const publishedPost = async (slug: string) => {
		const draft = await service.createDraft({
			collection: contentCollection,
			slug,
			metadata: await requiredMetadata(contentCollection, unique("Target"), relationTarget),
			format: "paragraphs",
			body: "Target body",
		});
		return publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });
	};

	describe("writing", () => {
		it("a text in a format a plugin provides is read by that plugin, and stored as a document", async () => {
			const entry = await created({ format: "paragraphs", body: "First paragraph\n\nSecond paragraph" });

			expect(entry.working.doc.content.map((block) => block.type)).toEqual(["paragraph", "paragraph"]);
			expect(JSON.stringify(entry.working.doc)).toContain("Second paragraph");
			for (const block of entry.working.doc.content) expect(block.id).toMatch(/^[0-9a-z]{8}$/);
			expect((await read(entry.id)).body.working.doc).toEqual(entry.working.doc);
		});

		it("a save with a text pairs the blocks with the draft, so unchanged blocks keep their ids", async () => {
			const entry = await created({ format: "paragraphs", body: "One\n\nTwo\n\nThree" });

			const res = await patch(entry.id, {
				expectedVersion: entry.version,
				format: "paragraphs",
				body: "One\n\nTwo, edited\n\nThree",
			});

			expect(res.status).toBe(200);
			const saved = (await res.json()) as Entry;
			expect(saved.working.doc.content.map((block) => block.id)).toEqual(
				entry.working.doc.content.map((block) => block.id),
			);
			expect(JSON.stringify(saved.working.doc)).toContain("Two, edited");
		});

		it.skipIf(!linkable)(
			"an internal link written as the path of its target is stored as the id of that target, whatever the format",
			async () => {
				const target = await publishedPost(unique("link-target"));
				const path = testSite.contentPath(contentCollection, target.workingSlug) as string;

				const entry = await created({ format: "paragraphs", body: `See [the target](${path}) for more.` });

				expect(entryLinkIds(entry.working.doc.content)).toEqual([target.translationGroupId ?? target.id]);
				expect(JSON.stringify(entry.working.doc)).not.toContain(path);
			},
		);

		it("an unknown format is a 400 unknown_format, and nothing is stored", async () => {
			const res = await post({ format: "hugo", body: "Text" });

			expect(res.status).toBe(400);
			expect(await res.json()).toMatchObject({ code: "unknown_format", issues: [{ params: { format: "hugo" } }] });
		});

		it("a format that can only write is a 400 format_not_importable", async () => {
			const res = await post({ format: "one-way", body: "Text" });

			expect(res.status).toBe(400);
			expect((await res.json()).code).toBe("format_not_importable");
		});

		it("a format that throws is a 422 format_import_failed, without its own message", async () => {
			const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);

			const res = await post({ format: "crashing", body: "Text" });

			expect(res.status).toBe(422);
			const body = await res.json();
			expect(body.code).toBe("format_import_failed");
			expect(JSON.stringify(body)).not.toContain("secret detail");
			quiet.mockRestore();
		});

		it("a text the format rejects is kept as an unparsed draft, with the format's findings blocking publishing", async () => {
			const entry = await created({ format: "paragraphs", body: "Broken <<< text" });

			expect(entry.working.doc.content).toEqual([
				expect.objectContaining({ type: "unparsed", attrs: { format: "paragraphs", source: "Broken <<< text" } }),
			]);
			await expect(service.publish({ id: entry.id, expectedVersion: entry.version })).rejects.toMatchObject({
				code: expect.stringMatching(/validation_failed|unparsed/),
			});
		});

		it("sending a document and a text together, or a text without its format, is a 400 invalid_input", async () => {
			const doc = docOf("Body");
			for (const body of [
				{ doc, body: "Text", format: "paragraphs" },
				{ doc, format: "paragraphs" },
				{ body: "Text" },
				{ format: "paragraphs" },
			]) {
				const res = await post(body);
				expect(res.status, JSON.stringify(body)).toBe(400);
				expect((await res.json()).code).toBe("invalid_input");
			}
			const entry = await created({ doc });
			const res = await patch(entry.id, { expectedVersion: entry.version, body: "Text" });
			expect(res.status).toBe(400);
		});

		it("with no format installed a text write is a 400 unknown_format, and a document write still works", async () => {
			const bare = fakeCms({
				config: testConfig,
				store,
				contentService: createContentService<Entry>(store, {
					site: testSite,
					formats: async () => createFormatRegistry([]),
				}),
				formats: [],
			});
			const write = async (body: Record<string, unknown>) =>
				postEntries(
					send("http://localhost/api/cms/v1/entries", "POST", {
						collection: contentCollection,
						slug: unique("bare"),
						metadata: await requiredMetadata(contentCollection, unique("Bare"), relationTarget),
						...body,
					}),
					{ cms: bare },
				);

			const text = await write({ format: "paragraphs", body: "Some text" });
			expect(text.status).toBe(400);
			expect((await text.json()).code).toBe("unknown_format");

			const doc = await write({ doc: docOf("Some text") });
			expect(doc.status).toBe(201);
		});

		it("the old `mdx` property is gone: it is not read as a body", async () => {
			const entry = await created({ mdx: "This text is ignored" });

			expect(entry.working.doc.content).toEqual([]);
		});

		it("rejects a text over the size limit with 413 body_too_large", async () => {
			const res = await post({ format: "paragraphs", body: "a".repeat(2 * 1024 * 1024 + 1) });

			expect(res.status).toBe(413);
			expect((await res.json()).code).toBe("body_too_large");
		});
	});

	describe("reading", () => {
		it("?format= adds the body as text to the draft, written to be imported again", async () => {
			const entry = await created({ format: "paragraphs", body: "One\n\nTwo" });

			const { status, body } = await read(entry.id, "?format=paragraphs");

			expect(status).toBe(200);
			expect(body.working.body).toBe("One\n\nTwo");
			expect(body.working.doc).toEqual(entry.working.doc);
			expect(body.published).toBeUndefined();
		});

		it("without ?format= there is no text, only the document", async () => {
			const entry = await created({ doc: docOf("Plain") });

			const { body } = await read(entry.id);

			expect(body.working).not.toHaveProperty("body");
		});

		it("an unknown format is a 400 unknown_format", async () => {
			const entry = await created({ doc: docOf("Plain") });

			const { status, body } = await read(entry.id, "?format=hugo");

			expect(status).toBe(400);
			expect(body.code).toBe("unknown_format");
		});

		it("the published body is written too, and a one-way format can be read as text", async () => {
			const draft = await created({ format: "paragraphs", body: "Live text" });
			const published = await publishDraft(testSite, store, { id: draft.id, expectedVersion: draft.version });

			const { body } = await read(published.id, "?format=one-way");

			expect(body.working.body).toBe("1 blocks");
			expect(body.published.body).toBe("1 blocks");
		});

		it.skipIf(!linkable)(
			"writes an internal link as the real path of its target, which follows a change of the target's address",
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

		it.skipIf(!linkable)(
			"a link to an entry that is gone is written as its id when the text is to be imported again, and imports back as that link",
			async () => {
				const target = await publishedPost(unique("round-trip"));
				const entry = await created({
					doc: {
						type: "doc",
						version: 3,
						content: [
							{
								type: "paragraph",
								content: [
									{ type: "text", text: "back and forth", marks: [{ type: "link", attrs: { entryId: target.id } }] },
								],
							},
						],
					},
				});
				const text = (await read(entry.id, "?format=paragraphs")).body.working.body as string;

				const again = await created({ format: "paragraphs", body: text });

				expect(entryLinkIds(again.working.doc.content)).toEqual([target.id]);
			},
		);
	});

	describe("meta", () => {
		it("lists the formats with what a client needs: the file facts, and whether the format can be read back", async () => {
			const res = await getMeta(new Request("http://localhost/api/cms/v1/meta"), { cms });
			const { formats } = await res.json();

			expect(formats).toEqual(
				expect.arrayContaining([
					{ name: "paragraphs", label: "Paragraphs", mimeType: "text/plain", extension: "txt", canImport: true },
					{ name: "one-way", label: "One way", mimeType: "text/plain", extension: "out", canImport: false },
				]),
			);
		});
	});

	describe("templates", () => {
		it("takes a document, or a text with its format, and returns the document", async () => {
			const fromDoc = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", { name: unique("from doc"), doc: docOf("## From doc") }),
				{ cms },
			);
			expect(fromDoc.status).toBe(201);
			const a = await fromDoc.json();
			expect(contentOf(a.doc)).toEqual(contentOf(docOf("## From doc")));
			expect(a).not.toHaveProperty("mdx");

			const fromText = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", {
					name: unique("from text"),
					format: "paragraphs",
					body: "Template one\n\nTemplate two",
				}),
				{ cms },
			);
			expect(fromText.status).toBe(201);
			const b = await fromText.json();
			expect(b.doc.content.map((block: { type: string }) => block.type)).toEqual(["paragraph", "paragraph"]);
			expect((await store.getTemplate(b.id)).doc).toEqual(b.doc);
		});

		it("creates an empty template when it gets no body", async () => {
			const res = await postTemplate(send("http://localhost/api/cms/v1/templates", "POST", { name: unique("empty") }), {
				cms,
			});

			expect(res.status).toBe(201);
			expect((await res.json()).doc.content).toEqual([]);
		});

		it("rejects both a document and a text, a text without its format, and a body that is not a document", async () => {
			const name = unique("bad");
			for (const body of [
				{ name, doc: docOf("x"), body: "x", format: "paragraphs" },
				{ name, body: "x" },
				{ name, format: "paragraphs" },
			]) {
				const res = await postTemplate(send("http://localhost/api/cms/v1/templates", "POST", body), { cms });
				expect(res.status, JSON.stringify(body)).toBe(400);
			}
			const notADoc = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", { name, doc: "## text" }),
				{
					cms,
				},
			);
			expect(notADoc.status).toBe(400);
			expect((await notADoc.json()).code).toBe("invalid_input");
		});

		it("an unknown format is a 400, and a text the format rejects is a 422 with its findings (a template cannot hold unparsed text)", async () => {
			const unknown = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", { name: unique("u"), format: "hugo", body: "x" }),
				{ cms },
			);
			expect(unknown.status).toBe(400);
			expect((await unknown.json()).code).toBe("unknown_format");

			const rejected = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", {
					name: unique("r"),
					format: "paragraphs",
					body: "Bad <<< text",
				}),
				{ cms },
			);
			expect(rejected.status).toBe(422);
			expect(await rejected.json()).toMatchObject({
				code: "format_import_failed",
				issues: [{ code: "bad_marker", position: { line: 1, column: 1 } }],
			});
		});

		it("a patch with a text keeps the ids of the blocks that stay, and a patch without a body keeps the body", async () => {
			const createdRes = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", {
					name: unique("patch"),
					format: "paragraphs",
					body: "Keep\n\nChange",
				}),
				{ cms },
			);
			const template = await createdRes.json();

			const edited = await patchTemplate(
				send(`http://localhost/api/cms/v1/templates/${template.id}`, "PATCH", {
					expectedVersion: template.version,
					format: "paragraphs",
					body: "Keep\n\nChanged!",
				}),
				{ params: Promise.resolve({ id: template.id }), cms },
			);
			expect(edited.status).toBe(200);
			const next = await edited.json();
			expect(next.doc.content.map((block: { id: string }) => block.id)).toEqual(
				template.doc.content.map((block: { id: string }) => block.id),
			);

			const renamed = await patchTemplate(
				send(`http://localhost/api/cms/v1/templates/${template.id}`, "PATCH", {
					expectedVersion: next.version,
					name: unique("renamed"),
				}),
				{ params: Promise.resolve({ id: template.id }), cms },
			);
			expect((await renamed.json()).doc).toEqual(next.doc);
		});

		it("?format= adds the text of each template to a list and to one template", async () => {
			const createdRes = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", {
					name: unique("text"),
					format: "paragraphs",
					body: "Alpha\n\nBeta",
				}),
				{ cms },
			);
			const template = await createdRes.json();

			const one = await getTemplate(
				new Request(`http://localhost/api/cms/v1/templates/${template.id}?format=paragraphs`),
				{
					params: Promise.resolve({ id: template.id }),
					cms,
				},
			);
			expect((await one.json()).body).toBe("Alpha\n\nBeta");

			const list = await getTemplates(new Request("http://localhost/api/cms/v1/templates?format=paragraphs"), { cms });
			const items = (await list.json()).items as { id: string; body?: string }[];
			expect(items.find((item) => item.id === template.id)?.body).toBe("Alpha\n\nBeta");
			for (const item of items) expect(typeof item.body).toBe("string");

			const plain = await getTemplates(new Request("http://localhost/api/cms/v1/templates"), { cms });
			for (const item of (await plain.json()).items) expect(item).not.toHaveProperty("body");

			const unknown = await getTemplates(new Request("http://localhost/api/cms/v1/templates?format=hugo"), { cms });
			expect(unknown.status).toBe(400);
			expect((await unknown.json()).code).toBe("unknown_format");
		});

		it("deleting a template still needs its version", async () => {
			const createdRes = await postTemplate(
				send("http://localhost/api/cms/v1/templates", "POST", { name: unique("del") }),
				{
					cms,
				},
			);
			const template = await createdRes.json();

			const res = await deleteTemplate(
				new Request(`http://localhost/api/cms/v1/templates/${template.id}?expectedVersion=${template.version}`, {
					method: "DELETE",
					headers: { origin: "http://localhost" },
				}),
				{ params: Promise.resolve({ id: template.id }), cms },
			);
			expect(res.status).toBe(200);
		});
	});
});
