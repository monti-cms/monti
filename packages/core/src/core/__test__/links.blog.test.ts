import { describe, expect, it } from "vitest";
import { contentPath, LINKABLE_COLLECTIONS, parseContentPath, parseInternalLink, previewHref } from "../links";

/**
 * 블로그 예시 설정(`test/cms.config.ts`)의 주소를 그대로 확인한다(다른 사이트 설정으로는 돌지 않는다).
 * 게시글 `/posts/:slug`, 메모 `/memos/:slug`, 사이트 `https://example.dev`(+www). 설정과 상관없는 규칙은 `links.test.ts`.
 */
describe("본문 내부 링크 규칙(블로그 예시 설정)", () => {
	it("경로가 있는 컬렉션만 링크로 가리킬 수 있다", () => {
		expect(LINKABLE_COLLECTIONS).toEqual(["post", "memo"]);
		expect(contentPath("post", "nextjs-guide")).toBe("/posts/nextjs-guide");
		expect(contentPath("memo", "한글 메모")).toBe("/memos/한글%20메모");
		expect(contentPath("tag", "react")).toBeNull();
		expect(contentPath("post", "")).toBeNull();
	});

	it("경로에서 컬렉션과 slug를 읽는다", () => {
		expect(parseContentPath("/posts/a")).toEqual({ collection: "post", slug: "a" });
		expect(parseContentPath("/memos/%ED%95%9C%EA%B8%80/")).toEqual({ collection: "memo", slug: "한글" });
		expect(parseContentPath("/posts/a/b")).toBeNull();
		expect(parseContentPath("/tags/react")).toBeNull();
		expect(parseContentPath("/posts/%E0%A4%A")).toBeNull();
	});

	it("경로와 사이트 주소로 적은 링크만 내부 링크로 본다", () => {
		expect(parseInternalLink("/posts/a?x=1#h")).toEqual({ collection: "post", slug: "a", url: "/posts/a?x=1#h" });
		expect(parseInternalLink("https://www.example.dev/memos/b")?.slug).toBe("b");
		expect(parseInternalLink("//example.dev/posts/c")?.slug).toBe("c");
		expect(parseInternalLink("https://example.com/posts/a")).toBeNull();
		expect(parseInternalLink("mailto:me@example.dev")).toBeNull();
		expect(parseInternalLink("posts/a")).toBeNull();
	});
});

describe("초안 미리보기 주소(블로그 예시 설정)", () => {
	it("미리보기 경로 아래에 공개 경로를 붙이고, 기본 언어가 아니면 언어를 넘긴다", () => {
		expect(previewHref("post", "nextjs-guide", "ko")).toBe("/preview/posts/nextjs-guide");
		expect(previewHref("memo", "한글 메모", "en")).toBe(`/preview/memos/${encodeURIComponent("한글 메모")}?locale=en`);
		expect(previewHref("tag", "react")).toBeNull();
		expect(previewHref("post", null)).toBeNull();
	});
});
