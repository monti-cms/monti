import path from "node:path";
import { formatReport, type ImportReport, runImport } from "@monti-cms/core/cli";
import { closeGlobalPool, type Entry } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createImportHarness, type ImportHarness } from "./import-harness";

/**
 * (The `.blog.test.ts` name keeps the other-site rerun from running it again: it brings its own blog schema.)
 *
 * Content the way Hugo and Astro sites really have it, with keys the blog schema has no field for: they are reported as not mapped and left out, never put in
 * a field of another meaning. The blog schema has no `cover` or `updatedAt`, but it does have `summary`, `tagIds` and `categoryId`.
 */

const allEntries = async (h: ImportHarness, collection: string): Promise<Entry[]> => {
	const store = h.cms.store();
	const list = await store.listEntries({ collection, pageSize: 100 });
	return Promise.all(list.items.map((item) => store.getEntry(item.id)));
};

const find = (report: ImportReport, suffix: string) => {
	const file = report.files.find((item) => item.path.endsWith(suffix));
	if (!file) throw new Error(`${suffix} is not in the report: ${report.files.map((item) => item.path).join(", ")}`);
	return file;
};

/** Every field a post of the blog schema has. Nothing else may show up in an imported entry. */
const POST_FIELDS = ["categoryId", "slug", "summary", "tagIds", "title"];

describe("monti import: a Hugo site (page bundle, translation, TOML)", () => {
	let h: ImportHarness;
	let report: ImportReport;
	beforeAll(async () => {
		h = await createImportHarness({ withMedia: false });
		const cwd = path.join(h.dir, "hugo");
		report = await runImport({
			cms: h.cms,
			cwd,
			target: "content/post",
			mappingFile: path.join(cwd, "monti.import.json"),
			collection: "post",
		});
	});
	afterAll(async () => {
		await h.close();
		await closeGlobalPool();
	});

	it("maps the keys the table knows and leaves everything else out", () => {
		expect(report.mapping.folders["content/post"]?.fields).toEqual({
			title: "title",
			date: "@publishedAt",
			// `lastmod` is the time of the last edit, not the publish date.
			lastmod: "@skip",
			draft: "@draft",
			slug: "@slug",
			summary: "summary",
			categories: { field: "categoryId", create: true },
			tags: { field: "tagIds", create: true },
			weight: "@skip",
			aliases: "@skip",
			featured_image: "@skip",
			images: "@skip",
			layout: "@skip",
			keywords: "@skip",
			author: "@skip",
			url: "@skip",
		});
	});

	it("tells which keys were left out, on the file that had them", () => {
		const bundle = find(report, "busan-weekend/index.md");
		const left = bundle.notices.filter((notice) => notice.kind === "unknown_field").map((notice) => notice.message);
		for (const key of ["lastmod", "weight", "aliases", "featured_image", "images", "layout"]) {
			expect(left.some((message) => message.startsWith(`"${key}" is not mapped`) && message.endsWith("left out"))).toBe(
				true,
			);
		}
		expect(left).toHaveLength(6);
		expect(formatReport(report)).toMatch(/unknown field: "lastmod" is not mapped/);
	});

	it("imports the bundle, its translation and the note, and fails the TOML file with the reason", async () => {
		expect(report.counts).toEqual({ imported: 3, updated: 0, skipped: 0, failed: 1 });
		expect(find(report, "old-toml-post.md")).toMatchObject({ status: "failed" });
		expect(find(report, "old-toml-post.md").reason).toMatch(/TOML/);

		const entries = await allEntries(h, "post");
		expect(entries).toHaveLength(3);
		// The translation has the address of its source.
		const titles = entries
			.filter((entry) => entry.workingSlug === "busan-weekend")
			.map((entry) => entry.working.metadata.title);
		expect(titles.sort()).toEqual(["A weekend in Busan: notes & photos", "부산 주말 여행"].sort());
		for (const entry of entries) {
			expect(Object.keys(entry.working.metadata).every((key) => POST_FIELDS.includes(key))).toBe(true);
		}
		const tags = (await allEntries(h, "tag")).map((entry) => entry.workingSlug).sort();
		// `keywords` of the note is not a tag list for this site: it was one more key than the post can take, and it was left out.
		expect(tags).toEqual(["busan", "food", "misc", "street-photography"]);
	});
});

describe("monti import: an Astro blog (pubDate, heroImage, an MDX file with an import line)", () => {
	let h: ImportHarness;
	let report: ImportReport;
	beforeAll(async () => {
		h = await createImportHarness({ withMedia: false });
		const cwd = path.join(h.dir, "astro-blog");
		report = await runImport({
			cms: h.cms,
			cwd,
			target: "src/content",
			mappingFile: path.join(cwd, "monti.import.json"),
			collection: "post",
		});
	});
	afterAll(async () => {
		await h.close();
		await closeGlobalPool();
	});

	it("maps pubDate, description and tags; heroImage, updatedDate and author are left out", () => {
		expect(report.mapping.folders["src/content/blog"]?.fields).toEqual({
			title: "title",
			description: "summary",
			pubDate: "@publishedAt",
			updatedDate: "@skip",
			heroImage: "@skip",
			tags: { field: "tagIds", create: true },
			author: "@skip",
		});
		const left = find(report, "blog/first-post.md")
			.notices.filter((notice) => notice.kind === "unknown_field")
			.map((notice) => notice.message);
		expect(left.some((message) => message.startsWith('"heroImage" is not mapped'))).toBe(true);
		expect(left.some((message) => message.startsWith('"updatedDate" is not mapped'))).toBe(true);
	});

	it("fails the MDX file with an import line and says why, instead of dropping the line", () => {
		expect(report.counts).toEqual({ imported: 2, updated: 0, skipped: 0, failed: 1 });
		const failed = find(report, "blog/using-mdx.mdx");
		expect(failed.status).toBe("failed");
		expect(failed.reason).toMatch(/import\/export isn't allowed in the body/);
	});

	it("keeps imported entries to the fields of the schema and says what it did with a date it cannot read", async () => {
		expect(find(report, "blog/someday.md").notices.map((notice) => notice.kind)).toContain("date");
		const entries = await allEntries(h, "post");
		expect(entries).toHaveLength(2);
		for (const entry of entries) {
			expect(Object.keys(entry.working.metadata).every((key) => POST_FIELDS.includes(key))).toBe(true);
		}
		const tags = (await allEntries(h, "tag")).map((entry) => entry.workingSlug).sort();
		expect(tags).toEqual(["astro", "news"]);
	});
});
