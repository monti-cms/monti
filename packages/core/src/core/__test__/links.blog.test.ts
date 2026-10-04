import { describe, expect, it } from "vitest";
import { contentPath, LINKABLE_COLLECTIONS, parseContentPath, parseInternalLink, previewHref } from "../links";

/**
 * Checks the addresses of the reference blog config (`test/cms.config.ts`) as is (does not run with other site configs).
 * Posts `/posts/:slug`, memos `/memos/:slug`, site `https://example.dev` (+www). Rules independent of the config are in `links.test.ts`.
 */
describe("internal body link rules (reference blog config)", () => {
	it("only collections with a path can be linked to", () => {
		expect(LINKABLE_COLLECTIONS).toEqual(["post", "memo"]);
		expect(contentPath("post", "nextjs-guide")).toBe("/posts/nextjs-guide");
		expect(contentPath("memo", "한글 메모")).toBe("/memos/한글%20메모");
		expect(contentPath("tag", "react")).toBeNull();
		expect(contentPath("post", "")).toBeNull();
	});

	it("reads the collection and slug from a path", () => {
		expect(parseContentPath("/posts/a")).toEqual({ collection: "post", slug: "a" });
		expect(parseContentPath("/memos/%ED%95%9C%EA%B8%80/")).toEqual({ collection: "memo", slug: "한글" });
		expect(parseContentPath("/posts/a/b")).toBeNull();
		expect(parseContentPath("/tags/react")).toBeNull();
		expect(parseContentPath("/posts/%E0%A4%A")).toBeNull();
	});

	it("only links written as a path or with the site address count as internal links", () => {
		expect(parseInternalLink("/posts/a?x=1#h")).toEqual({ collection: "post", slug: "a", url: "/posts/a?x=1#h" });
		expect(parseInternalLink("https://www.example.dev/memos/b")?.slug).toBe("b");
		expect(parseInternalLink("//example.dev/posts/c")?.slug).toBe("c");
		expect(parseInternalLink("https://example.com/posts/a")).toBeNull();
		expect(parseInternalLink("mailto:me@example.dev")).toBeNull();
		expect(parseInternalLink("posts/a")).toBeNull();
	});
});

describe("draft preview addresses (reference blog config)", () => {
	it("appends the public path under the preview path and passes the locale when it is not the default", () => {
		expect(previewHref("post", "nextjs-guide", "ko")).toBe("/preview/posts/nextjs-guide");
		expect(previewHref("memo", "한글 메모", "en")).toBe(`/preview/memos/${encodeURIComponent("한글 메모")}?locale=en`);
		expect(previewHref("tag", "react")).toBeNull();
		expect(previewHref("post", null)).toBeNull();
	});
});
