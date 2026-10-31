import { describe, expect, it } from "vitest";
import {
	checkPathPattern,
	fillPattern,
	matchPattern,
	patternsOverlap,
	patternUnder,
	splitPattern,
} from "../path-pattern";

describe("path patterns", () => {
	it("SCHEMA-N1 accepts a shape that starts with / and holds :slug once", () => {
		for (const path of ["/posts/:slug", "/:slug", "/a-:slug.html", "/blog/2024/:slug/"]) {
			expect(checkPathPattern(path), path).toBeUndefined();
		}
	});

	it("SCHEMA-N1 names the rule a shape breaks", () => {
		expect(checkPathPattern("posts/:slug")?.code).toBe("slash");
		for (const path of ["/posts", "/:slug/:slug", "/:lang/:slug", "/t/:slug?x", "/t/:slug#x"]) {
			expect(checkPathPattern(path)?.code, path).toBe("slug");
		}
	});

	it("SITE-R8 fills a slug in, and reads it back from a path", () => {
		expect(splitPattern("/posts/:slug.html")).toEqual(["/posts/", ".html"]);
		expect(fillPattern("/posts/:slug.html", "hello")).toBe("/posts/hello.html");
		expect(matchPattern("/posts/:slug.html", "/posts/hello.html")).toBe("hello");
		expect(matchPattern("/posts/:slug", "/posts/hello/")).toBe("hello");
		expect(matchPattern("/posts/:slug", "/memos/hello")).toBeNull();
		expect(matchPattern("/posts/:slug", "/posts/a/b")).toBeNull();
	});

	it("builds the shape for a folder", () => {
		expect(patternUnder("blog")).toBe("/blog/:slug");
		expect(patternUnder("/blog/")).toBe("/blog/:slug");
		expect(checkPathPattern(patternUnder("notes"))).toBeUndefined();
	});

	it("CONF-S3 tells whether two shapes can make the same URL", () => {
		expect(patternsOverlap("/posts/:slug", "/posts/:slug/")).toBe(true);
		expect(patternsOverlap("/posts/:slug", "/posts/archive-:slug")).toBe(true);
		expect(patternsOverlap("/posts/:slug", "/posts/archive")).toBe(true);
		expect(patternsOverlap("/:slug", "/about")).toBe(true);
		expect(patternsOverlap("/a-:slug", "/a-b-:slug.html")).toBe(true);
		expect(patternsOverlap("/posts/:slug", "/memos/:slug")).toBe(false);
		expect(patternsOverlap("/posts/:slug", "/posts/:slug/edit")).toBe(false);
		expect(patternsOverlap("/p-:slug", "/q-:slug")).toBe(false);
		expect(patternsOverlap("/:slug.html", "/:slug.json")).toBe(false);
		expect(patternsOverlap("/posts/:slug", "/posts/")).toBe(false);
	});
});
