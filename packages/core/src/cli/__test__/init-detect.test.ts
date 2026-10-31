import { describe, expect, it } from "vitest";
import { type ContentFolder, mergeLocaleFolders, parseFrontMatterKeys } from "../init-detect";

describe("front matter keys", () => {
	it("INIT-C1 types the top-level keys and ignores nested ones and the body", () => {
		const keys = parseFrontMatterKeys(
			'---\ntitle: "Hello: world"\ncount: 3\nok: true\nwhen: 2024-02-03T10:00:00Z\ntags: [a, b]\nauthors:\n  - name: x\nnested:\n  inner: 1\n---\nbody: not a key\n',
		);
		expect([...keys]).toEqual([
			["title", "string"],
			["count", "number"],
			["ok", "boolean"],
			["when", "date"],
			["tags", "list"],
			["authors", "list"],
			["nested", "string"],
		]);
		expect(parseFrontMatterKeys("# no front matter\n").size).toBe(0);
		expect(parseFrontMatterKeys("﻿---\r\ntitle: x\r\n---\r\n").has("title")).toBe(true);
	});
});

describe("language folders", () => {
	const folder = (dir: string, files: number): ContentFolder => ({
		dir,
		files,
		keys: [{ name: "title", count: files, type: "string" }],
	});

	it("INIT-Q3 merges sibling language folders into one set of posts, the language whose files have no pair first", () => {
		const merged = mergeLocaleFolders(
			[folder("content/en", 1), folder("content/ko", 2)],
			new Map([
				["content/en", ["hello.mdx"]],
				["content/ko", ["hello.mdx", "about.mdx"]],
			]),
		);
		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({
			dir: "content",
			files: 3,
			localesFrom: "folder",
			keys: [{ name: "title", count: 3, type: "string" }],
		});
		expect(merged[0]?.locales?.map((locale) => locale.code)).toEqual(["ko", "en"]);
	});

	it("INIT-Q3 leaves a single folder named like a language alone", () => {
		const lone = [folder("content/it", 1)];
		expect(mergeLocaleFolders(lone, new Map([["content/it", ["pasta.mdx"]]]))).toEqual(lone);
	});
});
