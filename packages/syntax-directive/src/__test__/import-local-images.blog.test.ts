import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { formatReport, runImport } from "@monti-cms/core/cli";
import { closeGlobalPool, type Entry } from "@monti-cms/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createImportHarness, type ImportHarness, png } from "./import-harness";

/**
 * (The `.blog.test.ts` name keeps the other-site rerun from running it again: it brings its own blog schema.)
 *
 * Local images of imported posts when the site has no media storage: they are copied into `public/media` and the posts point to those addresses, so the page
 * shows them. An image that is already under `public/` keeps its address, and a dry run copies nothing.
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
			"---\ntitle: One\nsummary: S\n---\n\n![A cat](./img/cat.png)\n\n![The diagram](/images/diagram.png)\n\n![Gone](./img/missing.png)\n",
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

	it("a dry run says what it would copy and copies nothing", async () => {
		const report = await run({ dryRun: true });
		expect(report.media).toMatchObject({ configured: false, wouldCopy: 2, copied: 0 });
		expect(existsSync(path.join(cwd, "public/media"))).toBe(false);
		const text = formatReport(report);
		expect(text).toMatch(/Images: 2 to copy into the public folder/);
		expect(report.notes.join("\n")).toMatch(/copied into contentlayer\/public\/media|copied into public\/media/);
	});

	it("copies the images into public/media and rewrites the addresses, so they show without storage", async () => {
		const report = await run({ publish: false });
		expect(report.media).toMatchObject({ configured: false, copied: 2 });
		expect(readFileSync(path.join(cwd, "public/media/cat.png")).equals(cat)).toBe(true);

		const store = h.cms.store();
		const list = await store.listEntries({ collection: "post", pageSize: 100 });
		const entries = await Promise.all(list.items.map((item) => store.getEntry(item.id)));
		const one = entries.find((entry) => JSON.stringify(entry.working.doc.content).includes("The diagram"));
		expect(one).toBeDefined();
		const found = srcs(one as Entry);
		// The copy, the image already in public/ (unchanged), and the missing one as written.
		expect(found).toEqual(["/media/cat.png", "/images/diagram.png", "./img/missing.png"]);
		expect(formatReport(report)).toMatch(/Images: 2 copied into the public folder/);
	});

	it("two images with one name do not overwrite each other, and a second run copies nothing new", async () => {
		const names = [...new Set(["cat.png"])];
		for (const name of names) expect(existsSync(path.join(cwd, "public/media", name))).toBe(true);
		const copies = (await import("node:fs")).readdirSync(path.join(cwd, "public/media")).sort();
		expect(copies).toHaveLength(2);
		expect(copies.filter((name) => name.startsWith("cat"))).toHaveLength(2);

		const again = await run({ publish: false });
		expect(again.media.copied).toBe(0);
		expect((await import("node:fs")).readdirSync(path.join(cwd, "public/media"))).toHaveLength(2);
	});
});
