import { describe, expect, it } from "vitest";
import { contentCollection, defaultLocale, recordCollection, secondLocale } from "../../../test/any-site";
import { cmsConfig } from "../../config/resolved";
import { schemaOf } from "../../schema/derive";
import { COLLECTIONS } from "../collections";
import { contentPath, LINKABLE_COLLECTIONS, parseContentPath, parseInternalLink, previewHref } from "../links";

/**
 * 설정과 상관없는 본문 내부 링크 규칙. 컬렉션과 공개 경로·사이트 주소는 지금 설정에서 찾는다(`test/any-site.ts`).
 * 블로그 예시 설정의 주소 그대로는 `links.blog.test.ts`가 확인한다.
 */
const pathOf = (slug: string) => {
	const path = schemaOf(contentCollection).path;
	if (!path) throw new Error("links test: the content collection has no path");
	return path.replace(":slug", slug);
};
const siteHost = new URL(cmsConfig.site?.url ?? "https://example.invalid").hostname;
const aliasHost = cmsConfig.site?.aliases?.[0] ?? siteHost;

describe("본문 내부 링크 규칙", () => {
	it("경로가 있는 컬렉션만 링크로 가리킬 수 있다", () => {
		expect(LINKABLE_COLLECTIONS).toEqual(COLLECTIONS.filter((name) => schemaOf(name).path));
		expect(LINKABLE_COLLECTIONS).toContain(contentCollection);
		expect(contentPath(contentCollection, "nextjs-guide")).toBe(pathOf("nextjs-guide"));
		expect(contentPath(contentCollection, "한글 메모")).toBe(pathOf("한글%20메모"));
		expect(contentPath(recordCollection, "react")).toBeNull();
		expect(contentPath(contentCollection, "")).toBeNull();
	});

	it("경로에서 컬렉션과 slug를 읽는다", () => {
		expect(parseContentPath(pathOf("a"))).toEqual({ collection: contentCollection, slug: "a" });
		// 끝 빗금은 있어도 없어도 같은 글이다.
		const encoded = pathOf("%ED%95%9C%EA%B8%80").replace(/\/?$/, "/");
		expect(parseContentPath(encoded)).toEqual({ collection: contentCollection, slug: "한글" });
		expect(parseContentPath(pathOf("a/b"))).toBeNull();
		expect(parseContentPath(`/${recordCollection}-unknown/react`)).toBeNull();
		expect(parseContentPath(pathOf("%E0%A4%A"))).toBeNull();
	});

	it("경로와 사이트 주소로 적은 링크만 내부 링크로 본다", () => {
		const relative = `${pathOf("a")}?x=1#h`;
		expect(parseInternalLink(relative)).toEqual({ collection: contentCollection, slug: "a", url: relative });
		expect(parseInternalLink(`https://${aliasHost}${pathOf("b")}`)?.slug).toBe("b");
		expect(parseInternalLink(`//${siteHost}${pathOf("c")}`)?.slug).toBe("c");
		expect(parseInternalLink(`https://other.example.com${pathOf("a")}`)).toBeNull();
		expect(parseInternalLink(`mailto:me@${siteHost}`)).toBeNull();
		expect(parseInternalLink(pathOf("a").slice(1))).toBeNull();
	});
});

describe("초안 미리보기 주소", () => {
	const previewPath = cmsConfig.site?.previewPath;

	it.skipIf(!previewPath)("미리보기 경로 아래에 공개 경로를 붙인다", () => {
		const href = previewHref(contentCollection, "nextjs-guide", defaultLocale);
		expect(href?.startsWith(previewPath?.replace(/\/$/, "") ?? "")).toBe(true);
		expect(href?.endsWith(pathOf("nextjs-guide"))).toBe(true);
		expect(previewHref(recordCollection, "react")).toBeNull();
		expect(previewHref(contentCollection, null)).toBeNull();
	});

	// 기본 언어가 아니면 언어를 넘긴다(쿼리든 경로 접두사든). 언어가 하나뿐인 설정에는 없다.
	it.skipIf(!previewPath || !secondLocale)("기본 언어가 아니면 언어를 넘긴다", () => {
		const href = previewHref(contentCollection, "한글 메모", secondLocale);
		expect(href).toContain(secondLocale);
		expect(href).toContain(encodeURIComponent("한글 메모"));
		expect(href).not.toBe(previewHref(contentCollection, "한글 메모", defaultLocale));
	});
});
