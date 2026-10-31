import type { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { paragraphsFormat } from "../../../test/paragraphs-format";
import { testConfig, testSite } from "../../../test/site";
import { fakeCms } from "../../cms";
import { MAX_IMPORT_BYTES } from "../../core/limits";
import type { ContentStore } from "../../core/store";
import { entryLinkIds } from "../../doc/entry-links";
import { emptyStoredDocument } from "../../doc/stored-document";
import { type CmsFormat, defineFormat } from "../../format/types";
import { exportTexts } from "../../http/v1/export/plan";
import { POST as importEntries } from "../../http/v1/import/entries/route";
import {
	closeGlobalPool,
	createContentStore,
	createIsolatedTestPool,
	dropIsolatedTestPool,
	migrateContentStore,
	routeCaller,
} from "../../testing";
import { createContentService } from "../content-service";
import { buildExportArchive, planExport } from "../export-service";
import { createZipArchive, readZipArchive } from "../zip";

/** A Markdown format for the tests: the paragraphs notation under the extension `md`. */
const markdownFormat = defineFormat({ ...paragraphsFormat, name: "markdown", extension: "md" });
const mdxFormat = defineFormat({ ...paragraphsFormat, name: "mdx", extension: "mdx" });

const call = routeCaller(importEntries, "admin-upload");
const encode = (text: string) => new TextEncoder().encode(text);

interface TestSite {
	pool: Pool;
	schemaName: string;
	store: ContentStore;
	service: ReturnType<typeof createContentService>;
	cms: ReturnType<typeof fakeCms>;
}

/** A site over a schema of its own: the real store and the real write pipeline, with the formats given. */
async function makeSite(formats: readonly CmsFormat[] = [paragraphsFormat]): Promise<TestSite> {
	const { pool, schemaName } = await createIsolatedTestPool();
	await migrateContentStore(pool, { site: testSite, schema: schemaName });
	const store = createContentStore(pool, { site: testSite, schema: schemaName });
	const { createFormatRegistry } = await import("../../format/registry");
	const registry = createFormatRegistry(formats);
	const service = createContentService(store, { site: testSite, formats: async () => registry });
	const cms = fakeCms({ config: testConfig, store, contentService: service as never, formats });
	return { pool, schemaName, store, service, cms };
}

const upload = (zip: Uint8Array, fields: Record<string, string> = {}) => {
	const form = new FormData();
	form.set("file", new File([zip as BlobPart], "import.zip", { type: "application/zip" }));
	for (const [name, value] of Object.entries(fields)) form.set(name, value);
	return new Request("http://localhost/api/monti/v1/import/entries", {
		method: "POST",
		headers: { origin: "http://localhost", host: "localhost" },
		body: form,
	});
};

describe("importing entries (POST /v1/import/entries)", () => {
	let source: TestSite;
	let target: TestSite;
	const ids: Record<string, string> = {};

	/** A zip of the source site, with its bodies also written as text in `format` (none: documents only). */
	const exportOf = async (format?: string) => {
		const plan = planExport(await source.store.readExportSnapshot(), { scope: "admin" });
		const texts = format ? await exportTexts(source.cms, plan, "admin", format) : undefined;
		return buildExportArchive(plan.snapshot, {
			site: testSite,
			scope: "admin",
			exportedAt: new Date(),
			selection: plan.selection,
			...(texts ? { texts } : {}),
		}).zip;
	};

	const entriesOf = async (site: TestSite) => (await site.store.readExportSnapshot()).entries;

	beforeAll(async () => {
		source = await makeSite();
		const draft = (slug: string, title: string, extra: Record<string, unknown> = {}) =>
			source.service
				.createDraft({
					collection: "memo",
					slug,
					metadata: { title, ...extra },
					format: "paragraphs",
					body: "Placeholder",
				} as never)
				.then((result) => result.entry);
		const tag = (
			await source.service.createDraft({
				collection: "tag",
				slug: "a-tag",
				metadata: { title: "A tag" },
				doc: emptyStoredDocument(),
			} as never)
		).entry;
		const first = await draft("first", "First", { tagIds: [tag.id] });
		const second = await draft("second", "Second");
		ids.first = first.id;
		ids.second = second.id;
		// The memos link to each other by path, so all drafts exist before any body is saved.
		const savedFirst = await source.service.saveDraft(first.id, {
			collection: "memo",
			slug: "first",
			metadata: { title: "First", tagIds: [tag.id] },
			format: "paragraphs",
			body: "See [the second](/memos/second)\n\nA picture\n\n![pic](https://elsewhere.test/pic.png)",
			expectedVersion: first.version,
		} as never);
		await source.service.saveDraft(second.id, {
			collection: "memo",
			slug: "second",
			metadata: { title: "Second" },
			format: "paragraphs",
			body: "Back to [the first](/memos/first)",
			expectedVersion: second.version,
		} as never);
		await source.service.publish({ id: first.id, expectedVersion: savedFirst.entry.version });
		const translation = (await source.service.createTranslation({ sourceId: first.id, locale: "en" })).entry;
		ids.translation = translation.id;
		await source.service.saveDraft(translation.id, {
			collection: "memo",
			slug: "first",
			metadata: { title: "First, in English" },
			format: "paragraphs",
			body: "English body, back to [the first](/memos/first)",
			expectedVersion: translation.version,
		} as never);
	});

	beforeEach(async () => {
		if (target) await dropIsolatedTestPool(target.pool, target.schemaName);
		target = await makeSite([paragraphsFormat, markdownFormat, mdxFormat]);
	});

	afterAll(async () => {
		if (target) await dropIsolatedTestPool(target.pool, target.schemaName);
		if (source) await dropIsolatedTestPool(source.pool, source.schemaName);
		await closeGlobalPool();
	});

	const run = async (zip: Uint8Array, fields: Record<string, string> = {}) => {
		const response = await call(upload(zip, { mode: "run", ...fields }), { cms: target.cms });
		return { status: response.status, body: await response.json() };
	};
	const preview = async (zip: Uint8Array, fields: Record<string, string> = {}) => {
		const response = await call(upload(zip, { mode: "preview", ...fields }), { cms: target.cms });
		return { status: response.status, body: await response.json() };
	};
	type Result = { key: string; id: string | null; outcome: string; target: string | null; locale: string };
	const resultOf = (results: Result[], key: string) => results.find((result) => result.key === key) as Result;

	it("DATA-I1 a preview says what would happen and writes nothing", async () => {
		const { status, body } = await preview(await exportOf("paragraphs"));
		expect(status).toBe(200);
		expect(body.kind).toBe("export");
		expect(await entriesOf(target)).toHaveLength(0);

		const byKey = (key: string) => body.entries.find((entry: { key: string }) => entry.key === key);
		expect(byKey(ids.first)).toMatchObject({
			title: "First",
			slug: "first",
			locale: "ko",
			target: "memo",
			body: { kind: "text", format: "paragraphs" },
			skipped: null,
			outsideImages: 1,
		});
		expect(byKey(ids.translation)).toMatchObject({ locale: "en", isTranslation: true, target: "memo" });
		// The tag is an item collection of this site: skipped, with the reason.
		const skippedTag = body.entries.find((entry: { collection: string }) => entry.collection === "tag");
		expect(skippedTag.skipped.code).toBe("item_collection");
		expect(skippedTag.skipped.text).toContain("tag");
		// The values next to the title are not read, and the preview lists them per collection.
		expect(body.fieldsNotImported).toEqual([{ collection: "memo", target: "memo", fields: ["tagIds"], required: [] }]);
		expect(body.counts).toMatchObject({
			entries: 4,
			imported: 3,
			skipped: 1,
			conflicts: 0,
			outsideImages: 1,
			publishable: 1,
		});
		expect(body.targets.map((item: { name: string }) => item.name)).toEqual(["post", "memo"]);
	});

	it("DATA-I4 brings the bodies in as text, so the links written as paths find the new entries, and groups the translation", async () => {
		const { status, body } = await run(await exportOf("paragraphs"));
		expect(status).toBe(200);
		const first = resultOf(body.results, ids.first);
		const second = resultOf(body.results, ids.second);
		const translation = resultOf(body.results, ids.translation);
		expect([first.outcome, second.outcome, translation.outcome]).toEqual(["imported", "imported", "imported"]);
		// Every entry is new.
		expect(new Set([first.id, second.id, translation.id, ids.first, ids.second, ids.translation]).size).toBe(6);

		const firstDoc = (await target.store.getWorking({ entryId: first.id as string })).doc;
		expect(entryLinkIds(firstDoc.content)).toEqual([second.id]);
		const secondDoc = (await target.store.getWorking({ entryId: second.id as string })).doc;
		expect(entryLinkIds(secondDoc.content)).toEqual([first.id]);

		const stored = await entriesOf(target);
		const newTranslation = stored.find((entry) => entry.id === translation.id);
		expect(newTranslation).toMatchObject({ locale: "en", translationGroupId: first.id });
		expect(newTranslation?.working.metadata.title).toBe("First, in English");
		expect(stored.find((entry) => entry.id === first.id)?.working.metadata.title).toBe("First");
		// The tag is not imported, and neither is the value `tagIds`.
		expect(stored.filter((entry) => entry.collection === "tag")).toHaveLength(0);
		expect(stored.find((entry) => entry.id === first.id)?.working.metadata.tagIds).toBeUndefined();
		expect(body.counts).toMatchObject({ imported: 3, skipped: 1, failed: 0 });
	});

	it("DATA-I3 without the choice, nothing is published; with it, only what was published in the archive", async () => {
		const zip = await exportOf("paragraphs");
		const plain = await run(zip);
		const statusOf = async (id: string) => (await target.store.getEntry(id)).status;
		expect(await statusOf(resultOf(plain.body.results, ids.first).id as string)).toBe("draft");

		await dropIsolatedTestPool(target.pool, target.schemaName);
		target = await makeSite([paragraphsFormat, markdownFormat, mdxFormat]);
		const published = await run(zip, { publish: "true" });
		expect(await statusOf(resultOf(published.body.results, ids.first).id as string)).toBe("published");
		expect(await statusOf(resultOf(published.body.results, ids.second).id as string)).toBe("draft");
		expect(await statusOf(resultOf(published.body.results, ids.translation).id as string)).toBe("draft");
		expect(published.body.counts.published).toBe(1);
		expect(resultOf(published.body.results, ids.first)).toMatchObject({ publish: { status: "done" } });
	});

	it("DATA-I4 reads the stored documents when the archive has no text, and changes the ids of the links to the new ones", async () => {
		const { body } = await run(await exportOf());
		const first = resultOf(body.results, ids.first);
		const second = resultOf(body.results, ids.second);
		expect(first.outcome).toBe("imported");
		const firstDoc = (await target.store.getWorking({ entryId: first.id as string })).doc;
		expect(entryLinkIds(firstDoc.content)).toEqual([second.id]);
		const preview1 = await preview(await exportOf());
		expect(preview1.body.entries.find((entry: { key: string }) => entry.key === ids.first).body).toEqual({
			kind: "json",
		});
	});

	it("DATA-I7 leaves out an image that names a media file this site does not have, and counts it with the images that point elsewhere", async () => {
		const foreignImage = {
			type: "image",
			attrs: { mediaId: "22222222-2222-4222-8222-222222222222", alt: "from another site" },
		};
		const patched = createZipArchive(
			readZipArchive(await exportOf()).map((file) => {
				if (file.path !== `entries/memo/${ids.first}/published.doc.json`) return file;
				const doc = JSON.parse(new TextDecoder().decode(file.data));
				return { path: file.path, data: encode(JSON.stringify({ ...doc, content: [...doc.content, foreignImage] })) };
			}),
		);
		const planned = await preview(patched);
		// The picture with a URL stays and the one from another library is left out: both are outside this site's media.
		expect(planned.body.counts.outsideImages).toBe(2);
		expect(planned.body.entries.find((entry: { key: string }) => entry.key === ids.first).notes[0].code).toBe(
			"images_left_out",
		);
		const { body } = await run(patched);
		const first = resultOf(body.results, ids.first);
		expect(first.outcome).toBe("imported");
		const doc = (await target.store.getWorking({ entryId: first.id as string })).doc;
		expect(doc.content.filter((node) => node.type === "image")).toHaveLength(1);
	});

	it("DATA-I4 a link to an entry that is not imported stays as it was, and the result says so", async () => {
		await target.service.createDraft({
			collection: "memo",
			slug: "second",
			metadata: { title: "Already here" },
			doc: emptyStoredDocument(),
		} as never);
		const zip = await exportOf();
		const planned = await preview(zip);
		expect(planned.body.counts.conflicts).toBe(1);
		expect(planned.body.counts.keptLinks).toBeGreaterThan(0);
		const { body } = await run(zip);
		const first = resultOf(body.results, ids.first);
		const firstDoc = (await target.store.getWorking({ entryId: first.id as string })).doc;
		expect(entryLinkIds(firstDoc.content)).toEqual([ids.second]);
		expect(body.results.find((result: { key: string }) => result.key === ids.first).notes[0].code).toBe("links_kept");
	});

	it("DATA-I2 skips an entry whose slug exists, never overwrites, and skips the translation of a skipped source", async () => {
		const zip = await exportOf("paragraphs");
		await run(zip);
		const before = await entriesOf(target);
		const again = await run(zip);
		expect(again.body.counts).toMatchObject({ imported: 0, skipped: 4, failed: 0 });
		for (const key of [ids.first, ids.second]) {
			expect(resultOf(again.body.results, key).outcome).toBe("skipped");
		}
		const reasons = Object.fromEntries(
			again.body.results.map((result: { key: string; create: { reason: { code: string } } }) => [
				result.key,
				result.create.reason.code,
			]),
		);
		expect(reasons[ids.first]).toBe("slug_exists");
		expect(reasons[ids.translation]).toBe("source_skipped");
		const after = await entriesOf(target);
		expect(after).toHaveLength(before.length);
		expect(after.map((entry) => entry.working.contentHash).sort()).toEqual(
			before.map((entry) => entry.working.contentHash).sort(),
		);
	});

	it("DATA-I6 imports a collection into another one the person picks, or skips it", async () => {
		const zip = await exportOf("paragraphs");
		const moved = await preview(zip, { mapping: JSON.stringify({ memo: "post" }) });
		expect(moved.body.collections.find((item: { name: string }) => item.name === "memo").target).toBe("post");
		expect(moved.body.entries.filter((entry: { target: string | null }) => entry.target === "post")).toHaveLength(3);
		const left = await run(zip, { mapping: JSON.stringify({ memo: null }) });
		expect(left.body.counts).toMatchObject({ imported: 0, skipped: 4 });
		expect(left.body.results[0].create.reason.code).toBe("skipped_by_choice");
		expect(await entriesOf(target)).toHaveLength(0);
		// An item collection is not a place to import into.
		const refused = await preview(zip, { mapping: JSON.stringify({ memo: "tag" }) });
		expect(refused.status).toBe(400);
	});

	it("DATA-I8 a failure in a later step leaves the draft and says so", async () => {
		// A post needs a category before it can be published, and the import does not bring one.
		const { body } = await run(await exportOf("paragraphs"), {
			mapping: JSON.stringify({ memo: "post" }),
			publish: "true",
		});
		const first = resultOf(body.results, ids.first);
		expect(first.outcome).toBe("draft");
		const publishStep = body.results.find((result: { key: string }) => result.key === ids.first).publish;
		expect(publishStep.status).toBe("failed");
		// The reason says what was wrong with the content, not only that the publish failed.
		expect(publishStep.reason.code).toBe("write_failed");
		expect(publishStep.reason.text).toContain("categoryId");
		expect((await target.store.getEntry(first.id as string)).status).toBe("draft");
		expect(body.counts).toMatchObject({ draft: 1, published: 0 });
	});

	it("DATA-I5 reads a zip of .md and .mdx files with front matter, with an optional locale", async () => {
		const zip = createZipArchive([
			{
				path: "memo/hello.md",
				data: encode("---\ntitle: Hello\nslug: hello\ndate: 2026-01-02\n---\n\nSee [world](/memos/world)\n"),
			},
			{ path: "memo/world.mdx", data: encode("---\ntitle: World\nslug: world\n---\n\nPlain text\n") },
			{
				path: "memo/hello-en.md",
				data: encode("---\ntitle: Hello in English\nslug: hello\nlocale: en\n---\n\nEnglish\n"),
			},
			{ path: "__MACOSX/memo/._hello.md", data: encode("junk") },
			{ path: "notes.txt", data: encode("not an entry") },
		]);
		const planned = await preview(zip);
		expect(planned.body.kind).toBe("markdown");
		expect(planned.body.fieldsNotImported).toEqual([
			{ collection: "memo", target: "memo", fields: ["date"], required: [] },
		]);
		expect(planned.body.counts).toMatchObject({ entries: 3, imported: 3, otherFiles: 1 });
		const { body } = await run(zip);
		expect(body.counts).toMatchObject({ imported: 3, failed: 0 });
		const stored = await entriesOf(target);
		const hello = stored.find((entry) => entry.workingSlug === "hello" && entry.locale === "ko");
		const world = stored.find((entry) => entry.workingSlug === "world");
		expect(hello?.working.metadata.title).toBe("Hello");
		expect(entryLinkIds(hello?.working.doc.content)).toEqual([world?.id]);
		const english = stored.find((entry) => entry.locale === "en");
		expect(english).toMatchObject({ translationGroupId: hello?.id });
		expect(english?.working.metadata.title).toBe("Hello in English");
	});

	it("DATA-I5 refuses a text folder when no installed format reads its files", async () => {
		const noFormats = await makeSite([]);
		try {
			const zip = createZipArchive([{ path: "memo/hello.md", data: encode("---\ntitle: Hello\n---\n\nText\n") }]);
			const response = await call(upload(zip, { mode: "preview" }), { cms: noFormats.cms });
			expect(response.status).toBe(400);
			const { error } = await response.json();
			expect(error.code).toBe("invalid_input");
			expect(error.message).toContain("md");
		} finally {
			await dropIsolatedTestPool(noFormats.pool, noFormats.schemaName);
		}
	});

	it("DATA-I4 keeps a text the format cannot read as it is and says so", async () => {
		const zip = createZipArchive([
			{ path: "memo/odd.md", data: encode("---\ntitle: Odd\n---\n\nthis has <<< in it\n") },
		]);
		const planned = await preview(zip);
		expect(planned.body.entries[0].notes[0].code).toBe("body_unparsed");
		const { body } = await run(zip);
		expect(body.results[0].outcome).toBe("imported");
		expect(body.results[0].warnings.length).toBeGreaterThan(0);
		expect(body.results[0].notes[0].code).toBe("body_unparsed");
	});

	it("DATA-I9 refuses a file that is not a zip, a request without a file, and a different mode", async () => {
		const notZip = await call(upload(encode("hello"), { mode: "preview" }), { cms: target.cms });
		expect(notZip.status).toBe(400);
		const noFile = new Request("http://localhost/api/monti/v1/import/entries", {
			method: "POST",
			headers: { origin: "http://localhost", host: "localhost" },
			body: (() => {
				const form = new FormData();
				form.set("mode", "preview");
				return form;
			})(),
		});
		expect((await call(noFile, { cms: target.cms })).status).toBe(400);
		const badMode = await call(upload(await exportOf(), { mode: "nope" }), { cms: target.cms });
		expect(badMode.status).toBe(400);
	});

	it("DATA-I9 refuses an upload over the size limit with 413, before reading it", async () => {
		const request = new Request("http://localhost/api/monti/v1/import/entries", {
			method: "POST",
			headers: {
				origin: "http://localhost",
				host: "localhost",
				"content-type": "multipart/form-data; boundary=x",
				"content-length": String(MAX_IMPORT_BYTES + 1024 * 1024),
			},
			body: "x",
		});
		const response = await call(request, { cms: target.cms });
		expect(response.status).toBe(413);
		expect((await response.json()).error.code).toBe("payload_too_large");
	});
});

describe("reading a zip", () => {
	it("DATA-I9 stops at the size the entries inflate to, so a small zip cannot expand without limit", () => {
		const zip = createZipArchive([{ path: "big.txt", data: new Uint8Array(4 * 1024 * 1024) }]);
		expect(zip.byteLength).toBeLessThan(64 * 1024);
		expect(() => readZipArchive(zip, { maxTotalBytes: 1024 * 1024 })).toThrow(/limit/);
		expect(readZipArchive(zip, { maxTotalBytes: 8 * 1024 * 1024 })[0]?.data.byteLength).toBe(4 * 1024 * 1024);
	});
});
