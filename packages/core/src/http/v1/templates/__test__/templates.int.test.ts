import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { paragraphsFormat } from "../../../../../test/paragraphs-format";
import { testConfig, testSite } from "../../../../../test/site";
import { contentOf, docOf } from "../../../../../test/stored-content";
import { type Cms, fakeCms } from "../../../../cms";
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
import {
	DELETE as deleteTemplateHandler,
	GET as getTemplateHandler,
	PATCH as patchTemplateHandler,
} from "../[id]/route";
import { GET as getTemplatesHandler, POST as postTemplateHandler } from "../route";

const deleteTemplate = routeCaller(deleteTemplateHandler);
const getTemplate = routeCaller(getTemplateHandler);
const patchTemplate = routeCaller(patchTemplateHandler);
const getTemplates = routeCaller(getTemplatesHandler);
const postTemplate = routeCaller(postTemplateHandler);

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

/**
 * The format option on the admin API, against a real store: a text in any format is read by its plugin, normalised and validated by core, and stored as a
 * document; and a document is written back as text with its links as the real paths of their targets.
 */
describe("the format option of the admin API", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let service: ReturnType<typeof createContentService>;
	let cms: Cms;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;

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

	describe("templates", () => {
		it("TPL-A1 takes a document, or a text with its format, and returns the document", async () => {
			const fromDoc = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", {
					name: unique("from doc"),
					doc: docOf("## From doc"),
				}),
				{ cms },
			);
			expect(fromDoc.status).toBe(201);
			const a = await fromDoc.json();
			expect(contentOf(a.doc)).toEqual(contentOf(docOf("## From doc")));
			expect(a).not.toHaveProperty("mdx");

			const fromText = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", {
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

		it("rejects a text without its format, and a body that is not a document", async () => {
			const name = unique("bad");
			// Which bodies are refused is the schema's (core/__test__/api.test.ts); this is the route reaching it.
			const textAlone = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", { name, body: "x" }),
				{
					cms,
				},
			);
			expect(textAlone.status).toBe(400);
			expect((await textAlone.json()).error.code).toBe("invalid_input");
			const notADoc = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", { name, doc: "## text" }),
				{
					cms,
				},
			);
			expect(notADoc.status).toBe(400);
			expect((await notADoc.json()).error.code).toBe("invalid_input");
		});

		it("FMT-P1 an unknown format is a 400, and a text the format rejects is a 422 with its findings (a template cannot hold unparsed text)", async () => {
			const unknown = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", { name: unique("u"), format: "hugo", body: "x" }),
				{ cms },
			);
			expect(unknown.status).toBe(400);
			expect((await unknown.json()).error.code).toBe("unknown_format");

			const rejected = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", {
					name: unique("r"),
					format: "paragraphs",
					body: "Bad <<< text",
				}),
				{ cms },
			);
			expect(rejected.status).toBe(422);
			expect(await rejected.json()).toMatchObject({
				error: {
					code: "format_import_failed",
					issues: [{ code: "bad_marker", position: { line: 1, column: 1 } }],
				},
			});
		});

		it("TPL-A1 a patch with a text keeps the ids of the blocks that stay, and a patch without a body keeps the body", async () => {
			const createdRes = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", {
					name: unique("patch"),
					format: "paragraphs",
					body: "Keep\n\nChange",
				}),
				{ cms },
			);
			const template = await createdRes.json();

			const edited = await patchTemplate(
				send(`http://localhost/api/monti/v1/templates/${template.id}`, "PATCH", {
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
				send(`http://localhost/api/monti/v1/templates/${template.id}`, "PATCH", {
					expectedVersion: next.version,
					name: unique("renamed"),
				}),
				{ params: Promise.resolve({ id: template.id }), cms },
			);
			expect((await renamed.json()).doc).toEqual(next.doc);
		});

		it("FMT-P3 ?format= adds the text of each template to a list and to one template", async () => {
			const createdRes = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", {
					name: unique("text"),
					format: "paragraphs",
					body: "Alpha\n\nBeta",
				}),
				{ cms },
			);
			const template = await createdRes.json();

			const one = await getTemplate(
				new Request(`http://localhost/api/monti/v1/templates/${template.id}?format=paragraphs`),
				{
					params: Promise.resolve({ id: template.id }),
					cms,
				},
			);
			expect((await one.json()).body).toBe("Alpha\n\nBeta");

			const list = await getTemplates(new Request("http://localhost/api/monti/v1/templates?format=paragraphs"), {
				cms,
			});
			const items = (await list.json()).items as { id: string; body?: string }[];
			expect(items.find((item) => item.id === template.id)?.body).toBe("Alpha\n\nBeta");
			for (const item of items) expect(typeof item.body).toBe("string");

			const plain = await getTemplates(new Request("http://localhost/api/monti/v1/templates"), { cms });
			for (const item of (await plain.json()).items) expect(item).not.toHaveProperty("body");

			const unknown = await getTemplates(new Request("http://localhost/api/monti/v1/templates?format=hugo"), { cms });
			expect(unknown.status).toBe(400);
			expect((await unknown.json()).error.code).toBe("unknown_format");
		});

		it("TPL-A1 deleting a template still needs its version", async () => {
			const createdRes = await postTemplate(
				send("http://localhost/api/monti/v1/templates", "POST", { name: unique("del") }),
				{
					cms,
				},
			);
			const template = await createdRes.json();
			const remove = (query: string) =>
				deleteTemplate(
					new Request(`http://localhost/api/monti/v1/templates/${template.id}${query}`, {
						method: "DELETE",
						headers: { origin: "http://localhost" },
					}),
					{ params: Promise.resolve({ id: template.id }), cms },
				);

			const unversioned = await remove("");
			expect(unversioned.status).toBe(428);
			expect((await unversioned.json()).error.code).toBe("version_required");
			expect((await store.getTemplate(template.id)).id).toBe(template.id);

			expect((await remove(`?expectedVersion=${template.version}`)).status).toBe(204);
		});
	});
});

/** A document of a heading, a paragraph and a list, as a client would send it. */
const sampleDoc = () => docOf("# Title\n\nSome *emphasis* here\n\n- one\n- two");

/** The admin entry API with a real store and service: bodies are accepted as a stored document as well as text in a format. */
describe("entry API with a stored document", () => {
	let pool: Pool;
	let schemaName: string;
	let store: ReturnType<typeof createContentStore>;
	let service: ReturnType<typeof createContentService>;
	let cms: Cms;
	let sequence = 0;
	const unique = (prefix: string) => `${prefix}-${++sequence}`;

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

	it("TPL-A1 lists templates with their documents", async () => {
		const template = await store.createTemplate({
			name: unique("doc template"),
			doc: sampleDoc(),
		});

		const res = await getTemplates(new Request("http://localhost/api/monti/v1/templates"), { cms });

		const { items } = await res.json();
		const listed = items.find((item: { id: string }) => item.id === template.id);
		expect(listed.mdx).toBeUndefined();
		expect(contentOf(listed.doc)).toEqual(contentOf(sampleDoc()));
	});
});
