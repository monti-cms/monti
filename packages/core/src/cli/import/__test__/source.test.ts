import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { derivePath, readSource, scanSources } from "../source";

const LOCALES = ["en", "ko"];

describe("derivePath", () => {
	it("takes the folder, the name and the group of a plain file", () => {
		expect(derivePath("posts/hello.mdx", LOCALES)).toEqual({
			folder: "posts",
			name: "hello",
			groupKey: "posts/hello",
			isIndex: false,
		});
		expect(derivePath("hello.md", LOCALES)).toMatchObject({ folder: ".", name: "hello", groupKey: "hello" });
	});

	it("reads the language from the file name, and pairs the files of one post", () => {
		const ko = derivePath("posts/hello.ko.mdx", LOCALES);
		expect(ko).toMatchObject({ localeFromFilename: "ko", name: "hello", groupKey: "posts/hello" });
		expect(derivePath("posts/hello.mdx", LOCALES).groupKey).toBe(ko.groupKey);
		// A suffix that is not a language of the site is part of the name.
		expect(derivePath("posts/v1.beta.mdx", LOCALES)).toMatchObject({ name: "v1.beta" });
		expect(derivePath("posts/hello.KO.mdx", LOCALES).localeFromFilename).toBe("ko");
	});

	it("reads the language from a folder and does not count it as the folder of the post", () => {
		expect(derivePath("ko/blog/hello.md", LOCALES)).toMatchObject({
			folder: "blog",
			localeFromFolder: "ko",
			groupKey: "blog/hello",
		});
	});

	it("lets an index file stand for its folder", () => {
		expect(derivePath("blog/hello/index.mdx", LOCALES)).toMatchObject({
			folder: "blog",
			name: "hello",
			isIndex: true,
			groupKey: "blog/hello",
		});
		expect(derivePath("blog/hello/index.ko.mdx", LOCALES)).toMatchObject({ localeFromFilename: "ko", name: "hello" });
		expect(derivePath("index.mdx", LOCALES)).toMatchObject({ name: "index", isIndex: false });
	});
});

describe("scanSources", () => {
	it("finds .md and .mdx files, in order, and leaves node_modules and dot folders alone", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "monti-scan-"));
		try {
			for (const file of ["b.mdx", "a.md", "notes.txt", "sub/c.MD", "node_modules/x/y.md", ".hidden/z.md"]) {
				mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
				writeFileSync(path.join(dir, file), "---\ntitle: x\n---\n");
			}
			const { files, root } = scanSources(dir, ".");
			expect(root).toBe(dir);
			expect(files.map((file) => file.rel)).toEqual(["a.md", "b.mdx", "sub/c.MD"]);
			expect(scanSources(dir, "b.mdx").files.map((file) => file.rel)).toEqual(["b.mdx"]);
			expect(() => scanSources(dir, "missing")).toThrow(/cannot find missing/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("readSource", () => {
	it("reads the front matter, and the line the body starts on", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "monti-read-"));
		try {
			writeFileSync(path.join(dir, "a.md"), "---\ntitle: A\ntags: [x]\n---\n\nBody\n");
			writeFileSync(path.join(dir, "b.md"), "---\ntitle: [unclosed\n---\n\nBody\n");
			const { files } = scanSources(dir, ".");
			const [a, b] = files.map(readSource);
			expect(a?.front).toEqual({ title: "A", tags: ["x"] });
			expect(a?.body).toBe("Body\n");
			expect(a?.bodyLineOffset).toBe(5);
			expect(b?.error).toMatch(/front matter is not valid YAML/);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
