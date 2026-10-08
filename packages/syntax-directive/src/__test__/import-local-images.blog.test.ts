import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { formatReport, runImport } from "@monti-cms/core/cli";
import { closeGlobalPool, type Entry } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createImportHarness, type ImportHarness, png } from "./import-harness";

/**
 * (The `.blog.test.ts` name keeps the other-site rerun from running it again: it brings its own blog schema.)
 *
 * Local images of imported posts when the site has no media storage: nothing is copied and the body keeps the address it had, and the report says how many
 * images were left so.
 */
describe("monti import: local images without media storage", () => {
	let h: ImportHarness;
	let cwd: string;
	let mappingFile: string;
	const cat = png(6, 4, 33);
	const dog = png(3, 3, 77);

	beforeAll(async () => {
		h = await createImportHarness({ withMedia: false });
		cwd = path.join(h.dir, "contentlayer");
		mappingFile = path.join(cwd, "monti.import.json");
		mkdirSync(path.join(cwd, "extra/img"), { recursive: true });
		writeFileSync(path.join(cwd, "extra/img/cat.png"), cat);
		writeFileSync(path.join(cwd, "extra/img/dog.png"), dog);
		writeFileSync(
			path.join(cwd, "extra/one.mdx"),
			"---\ntitle: One\nsummary: S\n---\n\n![A cat](./img/cat.png)\n\n![The diagram](/images/diagram.png)\n\n![Gone](./img/missing.png)\n\n![Remote](https://example.com/r.png)\n",
		);
		// Another post with a different image of the same name.
		mkdirSync(path.join(cwd, "extra/other"), { recursive: true });
		writeFileSync(path.join(cwd, "extra/other/cat.png"), dog);
		writeFileSync(
			path.join(cwd, "extra/two.mdx"),
			"---\ntitle: Two\nsummary: S\n---\n\n![A cat](./img/cat.png) ![Other](./other/cat.png)\n",
		);
	});
	afterAll(async () => {
		await h.close();
		await closeGlobalPool();
	});

	const run = (extra: Partial<Parameters<typeof runImport>[0]> = {}) =>
		runImport({ cms: h.cms, cwd, target: "extra", mappingFile, collection: "post", ...extra });
	const srcs = (entry: Entry) =>
		[...JSON.stringify(entry.working.doc.content).matchAll(/"src":"([^"]+)"/g)].map((m) => m[1]);
	const sentence = "3 images were left as they are; configure `storage` to upload images";

	it("a dry run says how many images stay as they are and writes no copy", async () => {
		const report = await run({ dryRun: true });
		expect(report.media).toMatchObject({ configured: false, left: 3 });
		expect(report.notes.filter((note) => note.includes("configure `storage`"))).toEqual([sentence]);
		expect(formatReport(report)).toContain(sentence);
		expect(existsSync(path.join(cwd, "public/media"))).toBe(false);
	});

	it("keeps every address as written, copies nothing, and says so once", async () => {
		const report = await run({ publish: false });
		expect(report.media).toMatchObject({ configured: false, left: 3 });
		expect(report.notes.filter((note) => note.includes("configure `storage`"))).toEqual([sentence]);
		expect(existsSync(path.join(cwd, "public/media"))).toBe(false);
		expect(readdirSync(path.join(cwd, "extra")).sort()).toEqual(["img", "one.mdx", "other", "two.mdx"]);

		const store = h.cms.store();
		const list = await store.listEntries({ collection: "post", pageSize: 100 });
		const entries = await Promise.all(list.items.map((item) => store.getEntry(item.id)));
		const one = entries.find((entry) => JSON.stringify(entry.working.doc.content).includes("The diagram"));
		expect(one).toBeDefined();
		expect(srcs(one as Entry)).toEqual([
			"./img/cat.png",
			"/images/diagram.png",
			"./img/missing.png",
			"https://example.com/r.png",
		]);
		// The image that is not on disk is told about on its file, not counted as left.
		expect(formatReport(report)).toMatch(/img\/missing\.png was not found on disk/);
	});
});
