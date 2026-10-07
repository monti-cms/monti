import { describe, expect, it } from "vitest";
import config from "../../../test/cms.config";
import { createSite } from "../../site";

const site = createSite(config);

/**
 * Checks the addresses of the reference blog config (`test/cms.config.ts`) as is (does not run with other site configs).
 * Posts `/posts/:slug`, memos `/memos/:slug`, site `https://example.dev` (+www). Rules independent of the config are in `links.test.ts`.
 */
describe("internal body link rules (reference blog config)", () => {
	it("only collections with a path can be linked to", () => {
		expect(site.LINKABLE_COLLECTIONS).toEqual(["post", "memo"]);
		expect(site.contentPath("post", "nextjs-guide")).toBe("/posts/nextjs-guide");
		expect(site.contentPath("memo", "한글 메모")).toBe("/memos/한글%20메모");
		expect(site.contentPath("tag", "react")).toBeNull();
		expect(site.contentPath("post", "")).toBeNull();
	});

	it("reads the collection and slug from a path", () => {
		expect(site.parseContentPath("/posts/a")).toEqual({ collection: "post", slug: "a" });
		expect(site.parseContentPath("/memos/%ED%95%9C%EA%B8%80/")).toEqual({ collection: "memo", slug: "한글" });
		expect(site.parseContentPath("/posts/a/b")).toBeNull();
		expect(site.parseContentPath("/tags/react")).toBeNull();
		expect(site.parseContentPath("/posts/%E0%A4%A")).toBeNull();
	});

	it("only links written as a path or with the site address count as internal links", () => {
		expect(site.parseInternalLink("/posts/a?x=1#h")).toEqual({ collection: "post", slug: "a", url: "/posts/a?x=1#h" });
		expect(site.parseInternalLink("https://www.example.dev/memos/b")?.slug).toBe("b");
		expect(site.parseInternalLink("//example.dev/posts/c")?.slug).toBe("c");
		expect(site.parseInternalLink("https://example.com/posts/a")).toBeNull();
		expect(site.parseInternalLink("mailto:me@example.dev")).toBeNull();
		expect(site.parseInternalLink("posts/a")).toBeNull();
	});
});

describe("draft preview addresses (reference blog config)", () => {
	it("appends the public path under the preview path and passes the locale when it is not the default", () => {
		expect(site.previewHref("post", "nextjs-guide", "ko")).toBe("/preview/posts/nextjs-guide");
		expect(site.previewHref("memo", "한글 메모", "en")).toBe(
			`/preview/memos/${encodeURIComponent("한글 메모")}?locale=en`,
		);
		expect(site.previewHref("tag", "react")).toBeNull();
		expect(site.previewHref("post", null)).toBeNull();
	});
});
