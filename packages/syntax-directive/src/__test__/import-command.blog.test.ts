import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ImportError, type ImportReport, runCli, runImport, scriptedPrompter } from "@monti-cms/core/cli";
import { closeGlobalPool, type Entry } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createImportHarness, type ImportHarness } from "./import-harness";

/**
 * (The `.blog.test.ts` name keeps the other-site rerun from running it again: it brings its own blog schema and does not read the suite's site config.)
 *
 * `monti import` against a real store: the mdx format with the directive notation, Postgres in an isolated schema and a media storage that takes uploads over
 * HTTP. The two layouts are the ones people have: Astro (`src/content/blog/*.md`, `pubDate`, `description`) and Next with contentlayer (`content/posts/*.mdx`,
 * `date`, `summary`, `hello.ko.mdx` translations).
 */

/** Every entry of a collection, whole. */
const allEntries = async (cms: ImportHarness["cms"], collection: string): Promise<Entry[]> => {
	const store = cms.store();
	const list = await store.listEntries({ collection, pageSize: 100 });
	return Promise.all(list.items.map((item) => store.getEntry(item.id)));
};

const find = (report: ImportReport, suffix: string) => {
	const file = report.files.find((item) => item.path.endsWith(suffix));
	if (!file) throw new Error(`${suffix} is not in the report: ${report.files.map((item) => item.path).join(", ")}`);
	return file;
};

const linkIds = (
	nodes: readonly { marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: unknown[] }[],
): string[] => {
	const ids: string[] = [];
	const visit = (list: readonly unknown[]) => {
		for (const node of list as { marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: unknown[] }[]) {
			for (const mark of node.marks ?? []) {
				if (mark.type === "link" && typeof mark.attrs?.entryId === "string") ids.push(mark.attrs.entryId);
			}
			if (node.content) visit(node.content);
		}
	};
	visit(nodes);
	return ids;
};

const hrefs = (nodes: readonly unknown[]): string[] => {
	const found: string[] = [];
	const visit = (list: readonly unknown[]) => {
		for (const node of list as { marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: unknown[] }[]) {
			for (const mark of node.marks ?? []) {
				if (mark.type === "link" && typeof mark.attrs?.href === "string") found.push(mark.attrs.href);
			}
			if (node.content) visit(node.content);
		}
	};
	visit(nodes);
	return found;
};

describe("monti import: Next with contentlayer", () => {
	let h: ImportHarness;
	let cwd: string;
	let target: string;
	let mappingFile: string;
	beforeAll(async () => {
		h = await createImportHarness();
		// Run from the project folder, as a person does: `monti import content`.
		cwd = path.join(h.dir, "contentlayer");
		target = "content";
		mappingFile = path.join(cwd, "monti.import.json");
	});
	afterAll(async () => {
		await h.close();
		await closeGlobalPool();
	});

	const run = (extra: Partial<Parameters<typeof runImport>[0]> = {}) =>
		runImport({ cms: h.cms, cwd, target, mappingFile, ...extra });
	const entries = async () => ({ items: await allEntries(h.cms, "post") });

	it("a dry run reports counts, the mapping and the problem files, and writes nothing", async () => {
		const report = await run({ dryRun: true });

		expect(report.dryRun).toBe(true);
		expect(report.counts).toEqual({ imported: 5, updated: 0, skipped: 1, failed: 1 });
		expect(report.collections.post).toMatchObject({ files: 6, imported: 5, failed: 1, translations: 1 });
		// The folder with no collection is left out, and the report says how to decide it.
		expect(find(report, "pages/about.mdx")).toMatchObject({ status: "skipped" });
		expect(report.notes.join("\n")).toMatch(/--collection/);
		// A file that does not parse is a problem with the line it fails on.
		expect(find(report, "posts/broken.mdx")).toMatchObject({ status: "failed" });
		expect(find(report, "posts/broken.mdx").reason).toMatch(/line 5/);
		// Keys the collection does not have, and fields it requires, are problems of the files that have them.
		expect(find(report, "posts/unknown-fields.mdx").notices.map((notice) => notice.kind)).toEqual(
			expect.arrayContaining(["unknown_field", "missing_required"]),
		);
		expect(report.mapping.folders.posts).toMatchObject({
			collection: "post",
			fields: {
				title: "title",
				slug: "@slug",
				date: "@publishedAt",
				summary: "summary",
				tags: { field: "tagIds", create: true },
				category: { field: "categoryId", create: true },
				draft: "@draft",
				author: "@skip",
			},
		});
		expect(report.createdTargets).toEqual({
			tag: expect.arrayContaining(["web", "Next.js", "notes"]),
			category: ["guides"],
		});
		expect(report.media).toMatchObject({ configured: true, wouldUpload: 1, uploaded: 0 });

		expect((await entries()).items).toHaveLength(0);
		expect(existsSync(mappingFile)).toBe(false);
		expect(h.media.objects.size).toBe(0);
	});

	it("imports through the write pipeline as drafts, with links, images, relations and translations", async () => {
		const report = await run();

		expect(report.counts).toEqual({ imported: 5, updated: 0, skipped: 1, failed: 1 });
		expect(report.mappingSaved).toBe(true);
		expect(JSON.parse(readFileSync(mappingFile, "utf8")).folders.posts.collection).toBe("post");
		for (const name of ["intro.mdx", "intro.ko.mdx", "directive.mdx", "draft-notes.mdx", "unknown-fields.mdx"]) {
			expect(find(report, `posts/${name}`).status).toBe("imported");
			expect(find(report, `posts/${name}`).state).toBe("draft");
		}
		expect(report.summary).toMatch(/drafts/);
		expect(report.summary).toMatch(/--publish/);

		const store = h.cms.store();
		const intro = await store.getEntry(find(report, "posts/intro.mdx").entryId as string);
		const ko = await store.getEntry(find(report, "posts/intro.ko.mdx").entryId as string);
		const directive = await store.getEntry(find(report, "posts/directive.mdx").entryId as string);
		const notes = await store.getEntry(find(report, "posts/draft-notes.mdx").entryId as string);

		// Fields, the address from the front matter, and the translation paired with its source.
		expect(intro).toMatchObject({ status: "draft", locale: "en", workingSlug: "intro-to-monti" });
		expect(intro.working.metadata).toMatchObject({
			title: "Introducing Monti",
			summary: "A CMS that keeps your posts as documents.",
		});
		expect(ko).toMatchObject({ locale: "ko", translationGroupId: intro.id, workingSlug: "intro-to-monti" });
		expect(ko.working.metadata).toMatchObject({ title: "Monti 소개" });

		// Tags and the category are entries of their collections, created because they did not exist, and the post points to them by id.
		const tags = { items: await allEntries(h.cms, "tag") };
		expect(tags.items.map((item) => item.workingSlug).sort()).toEqual(["nextjs", "notes", "web"]);
		const tagIds = intro.working.metadata.tagIds as string[];
		expect(tagIds).toHaveLength(2);
		expect(tagIds.every((id) => tags.items.some((item) => item.id === id))).toBe(true);
		expect(typeof intro.working.metadata.categoryId).toBe("string");
		// A tag two posts use is one entry.
		expect((directive.working.metadata.tagIds as string[])[0]).toBe(tagIds[0]);

		// Links between the files are entry ids: a relative path, a site path of the new site (`/posts/draft-notes`) and a path of the old one (`/blog/intro-to-monti`).
		expect(linkIds(intro.working.doc.content as never)).toEqual([directive.id, notes.id]);
		expect(linkIds(ko.working.doc.content as never)).toEqual([directive.id]);
		expect(linkIds(directive.working.doc.content as never)).toEqual([intro.id]);
		expect(linkIds(notes.working.doc.content as never)).toEqual([intro.id]);
		// An outside link stays an address.
		expect(hrefs(directive.working.doc.content as never)).toEqual(["https://example.com/docs"]);
		expect(report.links.resolved).toBeGreaterThanOrEqual(5);

		// The image became a media item in the configured storage.
		const image = JSON.stringify(intro.working.doc.content);
		expect(image).toMatch(/"mediaId":"[0-9a-f-]{36}"/);
		expect(image).not.toMatch(/diagram\.png/);
		expect(report.media.uploaded).toBe(1);

		// The directive notation was read into the document.
		expect(JSON.stringify(directive.working.doc.content)).toMatch(/underline/);

		expect((await entries()).items).toHaveLength(5);
	});

	it("runs again without changing anything", async () => {
		const before = await entries();
		const report = await run();

		expect(report.counts).toEqual({ imported: 0, updated: 0, skipped: 6, failed: 1 });
		expect(find(report, "posts/intro.mdx")).toMatchObject({
			status: "skipped",
			reason: expect.stringMatching(/unchanged/),
		});
		expect(report.mappingSaved).toBe(false);
		expect(report.media).toMatchObject({ uploaded: 0 });
		expect(report.createdTargets).toEqual({});
		const after = await entries();
		expect(after.items.map((item) => [item.id, item.version])).toEqual(
			before.items.map((item) => [item.id, item.version]),
		);
	});

	it("updates only the file that changed, and keeps its entry", async () => {
		const file = path.join(cwd, target, "posts/intro.mdx");
		const original = readFileSync(file, "utf8");
		const before = await entries();
		const introBefore = before.items.find((item) => item.workingSlug === "intro-to-monti" && item.locale === "en");
		writeFileSync(file, original.replace("keeps posts as **documents**", "keeps posts as **documents you own**"));

		const report = await run();

		expect(report.counts).toMatchObject({ imported: 0, updated: 1, failed: 1 });
		expect(find(report, "posts/intro.mdx")).toMatchObject({ status: "updated", entryId: introBefore?.id });
		const after = await entries();
		expect(after.items).toHaveLength(5);
		const introAfter = await h.cms.store().getEntry(introBefore?.id as string);
		expect(JSON.stringify(introAfter.working.doc.content)).toMatch(/documents you own/);
		expect(introAfter.version).toBeGreaterThan(introBefore?.version as number);
		// The links of the rewritten body are still entry ids.
		expect(linkIds(introAfter.working.doc.content as never)).toHaveLength(2);
		for (const item of after.items.filter((item) => item.id !== introBefore?.id)) {
			expect(item.version).toBe(before.items.find((old) => old.id === item.id)?.version);
		}
	});

	it("does not overwrite an entry that was edited in the CMS, unless asked", async () => {
		const file = path.join(cwd, target, "posts/unknown-fields.mdx");
		const store = h.cms.store();
		const first = (await run()).files.find((item) => item.path.endsWith("unknown-fields.mdx"));
		const entry = await store.getEntry(first?.entryId as string);
		await h.cms.contentService().saveDraft(
			entry.id,
			{
				collection: "post",
				slug: "unknown-fields",
				metadata: { ...entry.working.metadata, summary: "Edited in the admin" },
				doc: entry.working.doc,
				expectedVersion: entry.version,
			} as never,
			{ publishImmediately: false },
		);
		writeFileSync(file, `${readFileSync(file, "utf8")}\nOne more line.\n`);

		const skipped = await run();
		expect(find(skipped, "unknown-fields.mdx")).toMatchObject({
			status: "skipped",
			reason: expect.stringMatching(/edited in the CMS/),
		});

		const forced = await run({ overwrite: true });
		expect(find(forced, "unknown-fields.mdx").status).toBe("updated");
	});

	it("--publish publishes what is not a draft, with the front matter date, and shows what blocks publishing", async () => {
		const report = await run({ publish: true });

		// `summary` is required and some files have none: those stay drafts, with the reason.
		const directive = find(report, "posts/directive.mdx");
		expect(directive.status).toBe("failed");
		expect(directive.reason).toMatch(/could not be published/);
		const store = h.cms.store();
		const intro = await store.getEntry(find(report, "posts/intro.mdx").entryId as string);
		expect(intro.status).toBe("published");
		expect(intro.publishedAt?.toISOString()).toBe("2024-03-01T00:00:00.000Z");
		const ko = await store.getEntry(find(report, "posts/intro.ko.mdx").entryId as string);
		expect(ko.status).toBe("published");
		// A file whose front matter says draft stays a draft.
		const notes = await store.getEntry(find(report, "posts/draft-notes.mdx").entryId as string);
		expect(notes.status).toBe("draft");
		expect(report.counts.failed).toBeGreaterThanOrEqual(1);
	});
});

describe("monti import: Astro", () => {
	let h: ImportHarness;
	let cwd: string;
	let target: string;
	let mappingFile: string;
	beforeAll(async () => {
		h = await createImportHarness();
		cwd = path.join(h.dir, "astro");
		target = "src/content";
		mappingFile = path.join(cwd, "monti.import.json");
	});
	afterAll(async () => {
		await h.close();
		await closeGlobalPool();
	});

	it("asks where an unclear folder goes, then saves the answers so the next run asks nothing", async () => {
		// The folder question takes "1" (post); the tags question and the final confirmation take their defaults.
		const prompter = scriptedPrompter(["1", "", ""]);
		const first = await runImport({ cms: h.cms, cwd, target, mappingFile, publish: true, prompter });

		expect(prompter.asked.length).toBeGreaterThanOrEqual(3);
		expect(prompter.said.join("\n")).toMatch(/Which collection do the 3 files in "blog" go to\?/);
		expect(first.counts).toEqual({ imported: 3, updated: 0, skipped: 0, failed: 0 });
		expect(first.mapping.folders.blog).toMatchObject({
			collection: "post",
			fields: {
				title: "title",
				description: "summary",
				pubDate: "@publishedAt",
				tags: { field: "tagIds", create: true },
			},
		});

		const store = h.cms.store();
		const hello = await store.getEntry(find(first, "blog/hello-world.md").entryId as string);
		const second = await store.getEntry(find(first, "blog/second-post.md").entryId as string);
		const setup = await store.getEntry(find(first, "blog/guides/setup.md").entryId as string);
		expect(hello.workingSlug).toBe("hello-world");
		// Two relative links, one with a trailing slash and no extension (`guides/setup/`), and the one to a file that is not there stays as written.
		expect(linkIds(hello.working.doc.content as never)).toEqual([second.id, setup.id]);
		expect(linkIds(second.working.doc.content as never)).toEqual([hello.id]);
		expect(hrefs(second.working.doc.content as never)).toEqual(["./nope.md"]);
		expect(linkIds(setup.working.doc.content as never)).toEqual([hello.id]);
		expect(find(first, "blog/second-post.md").notices.map((notice) => notice.kind)).toContain("link");
		// The image next to the posts (`../../assets/cover.png`) is uploaded.
		expect(JSON.stringify(hello.working.doc.content)).toMatch(/"mediaId"/);
		// `pubDate` is the publish date; `setup` has no summary, so only it stays a draft.
		expect(hello.status).toBe("published");
		expect(hello.publishedAt?.toISOString()).toBe("2024-02-01T00:00:00.000Z");
		expect(find(first, "blog/guides/setup.md").state).toBe("draft");
		expect(find(first, "blog/guides/setup.md").reason).toMatch(/blocked/);

		// The saved mapping answers everything.
		const quiet = scriptedPrompter([]);
		const second_run = await runImport({ cms: h.cms, cwd, target, mappingFile, publish: true, prompter: quiet });
		expect(quiet.asked).toEqual([]);
		// The one that cannot be published (it has no summary) is tried again, and says why again.
		expect(second_run.counts).toEqual({ imported: 0, updated: 0, skipped: 2, failed: 1 });
		expect(find(second_run, "blog/guides/setup.md").reason).toMatch(/could not be published/);
		expect(await allEntries(h.cms, "post")).toHaveLength(3);
	});
});

describe("monti import: flags and the command", () => {
	let h: ImportHarness;
	beforeAll(async () => {
		h = await createImportHarness();
	});
	afterAll(async () => {
		await h.close();
		await closeGlobalPool();
	});

	it("--collection sends every folder to one collection, and --yes never asks", async () => {
		const cwd = path.join(h.dir, "contentlayer");
		const prompter = scriptedPrompter([]);
		const report = await runImport({
			cms: h.cms,
			cwd,
			target: "content",
			mappingFile: path.join(cwd, "monti.import.json"),
			dryRun: true,
			collection: "post",
		});
		expect(find(report, "pages/about.mdx").status).toBe("imported");
		expect(report.collections.post?.files).toBe(7);
		expect(prompter.asked).toEqual([]);
		await expect(
			runImport({
				cms: h.cms,
				cwd,
				target: "content",
				mappingFile: path.join(cwd, "x.json"),
				dryRun: true,
				collection: "nope",
			}),
		).rejects.toThrow(/no such collection/);
	});

	it("the command loads the config, prints JSON with --json and exits 1 when a file failed", async () => {
		const cwd = path.join(h.dir, "contentlayer");
		const out: string[] = [];
		const errors: string[] = [];
		process.env.MONTI_IMPORT_TEST_SCHEMA = h.schemaName;
		const code = await runCli(
			[
				"import",
				"content",
				"--config",
				path.join(__dirname, "import-app.ts"),
				"--no-env-file",
				"--json",
				"--mapping",
				"map.json",
			],
			{ cwd, log: (line) => out.push(line), error: (line) => errors.push(line) },
		);
		expect(errors).toEqual([]);
		const report = JSON.parse(out.join("\n")) as ImportReport;
		// The broken file failed, the folder nobody could place was left out, and the rest were created as drafts.
		expect(code).toBe(1);
		expect(report.counts).toEqual({ imported: 5, updated: 0, skipped: 1, failed: 1 });
		expect(report.notes.join(" ")).toMatch(/--collection/);
		expect(existsSync(path.join(cwd, "map.json"))).toBe(true);

		expect(await allEntries(h.cms, "post")).toHaveLength(5);
	});

	it("explains a missing path", async () => {
		const errors: string[] = [];
		const code = await runCli(["import"], { cwd: h.dir, log: () => undefined, error: (line) => errors.push(line) });
		expect(code).toBe(1);
		expect(errors.join("\n")).toMatch(/usage: monti import <path>/);
	});
});

describe("monti import: setup problems", () => {
	let h: ImportHarness;
	afterAll(async () => {
		await h?.close();
		await closeGlobalPool();
	});

	it("says what to add when no format reads the files", async () => {
		h = await createImportHarness({ withMdx: false });
		await expect(
			runImport({
				cms: h.cms,
				cwd: h.dir,
				target: path.join(h.dir, "contentlayer/content"),
				mappingFile: path.join(h.dir, "monti.import.json"),
				dryRun: true,
			}),
		).rejects.toThrow(/MDX plugin.*mdx\(\)/s);
		await expect(
			runImport({
				cms: h.cms,
				cwd: h.dir,
				target: path.join(h.dir, "nothing-here"),
				mappingFile: path.join(h.dir, "x.json"),
			}),
		).rejects.toBeInstanceOf(Error);
		await expect(
			runImport({
				cms: h.cms,
				cwd: h.dir,
				target: path.join(h.dir, "contentlayer/public"),
				mappingFile: path.join(h.dir, "x.json"),
			}),
		).rejects.toBeInstanceOf(ImportError);
	});
});
