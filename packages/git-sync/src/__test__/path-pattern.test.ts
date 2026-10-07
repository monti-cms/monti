import { describe, expect, it } from "vitest";
import { DEFAULT_PATH_PATTERN, resolveTarget } from "../options";
import { createPathPattern } from "../path-pattern";

const patternOf = (target: Parameters<typeof resolveTarget>[0]) =>
	createPathPattern({ target: resolveTarget(target, 0), locales: ["en", "ko"], extension: "mdx" });

const values = { collection: "post", slug: "hello-world", locale: "ko", id: "8a3b5c1e-0000-4000-8000-000000000001" };

describe("path pattern", () => {
	it("renders and parses the default pattern under the folder", () => {
		const pattern = patternOf({ repo: "acme/site", folder: "content", collections: ["post", "memo"] });
		expect(pattern.render(values)).toBe("content/post/hello-world.ko.mdx");
		expect(pattern.parse("content/post/hello-world.ko.mdx")).toEqual({
			collection: "post",
			slug: "hello-world",
			locale: "ko",
		});
		expect(DEFAULT_PATH_PATTERN).toBe("{collection}/{slug}.{locale}.{ext}");
	});

	it("takes a literal extension or the format's", () => {
		const literal = patternOf({ repo: "acme/site", collections: ["post"], path: "{collection}/{slug}.{locale}.md" });
		expect(literal.render(values)).toBe("post/hello-world.ko.md");
		expect(literal.parse("post/hello-world.ko.md")).toMatchObject({ slug: "hello-world" });
		expect(literal.parse("post/hello-world.ko.mdx")).toBeNull();
	});

	it("handles a Hugo-style layout with a folder per entry", () => {
		const pattern = patternOf({
			repo: "acme/site",
			collections: ["post"],
			path: "content/{collection}/{slug}/index.{locale}.md",
		});
		expect(pattern.render(values)).toBe("content/post/hello-world/index.ko.md");
		expect(pattern.parse("content/post/hello-world/index.ko.md")).toEqual({
			collection: "post",
			slug: "hello-world",
			locale: "ko",
		});
		expect(pattern.parse("content/post/hello-world/other.ko.md")).toBeNull();
	});

	it("parses only what the target covers: its collections, the site's languages, its folder", () => {
		const pattern = patternOf({ repo: "acme/site", folder: "content", collections: ["post"] });
		expect(pattern.parse("content/memo/a.en.mdx")).toBeNull();
		expect(pattern.parse("content/post/a.fr.mdx")).toBeNull();
		expect(pattern.parse("other/post/a.en.mdx")).toBeNull();
		expect(pattern.parse("content/post/a.en.mdx.bak")).toBeNull();
		expect(pattern.parse("content/post/a.en.mdx")).toMatchObject({ slug: "a" });
	});

	it("keeps dots and unicode in a slug, and does not mistake the language for part of it", () => {
		const pattern = patternOf({ repo: "acme/site", collections: ["post"] });
		expect(pattern.parse("post/v1.2-notes.en.mdx")).toMatchObject({ slug: "v1.2-notes", locale: "en" });
		expect(pattern.parse("post/한글-제목.ko.mdx")).toMatchObject({ slug: "한글-제목", locale: "ko" });
	});

	it("supports the entry id as a placeholder", () => {
		const pattern = patternOf({ repo: "acme/site", collections: ["post"], path: "{collection}/{id}.{ext}" });
		expect(pattern.render(values)).toBe("post/8a3b5c1e-0000-4000-8000-000000000001.mdx");
		expect(pattern.parse("post/8a3b5c1e-0000-4000-8000-000000000001.mdx")).toEqual({
			collection: "post",
			id: "8a3b5c1e-0000-4000-8000-000000000001",
		});
		expect(pattern.parse("post/not-an-id.mdx")).toBeNull();
	});

	it("leaves out the parts the pattern has no placeholder for", () => {
		const pattern = patternOf({ repo: "acme/site", collections: ["post"], path: "{slug}.{ext}" });
		expect(pattern.parse("hello.mdx")).toEqual({ slug: "hello" });
	});
});
