import { describe, expect, it } from "vitest";
import { formatContentLinkMdx, type InternalLinkItem, parseInternalLinkTrigger } from "./internal-link";

describe("M3-ED-2 Internal Link ([[) Trigger & Format Contract", () => {
	it("detects [[ trigger correctly", () => {
		expect(parseInternalLinkTrigger("Hello world [[").active).toBe(true);
		expect(parseInternalLinkTrigger("Hello world [[").query).toBe("");

		expect(parseInternalLinkTrigger("참조할 글: [[리액트").active).toBe(true);
		expect(parseInternalLinkTrigger("참조할 글: [[리액트").query).toBe("리액트");

		expect(parseInternalLinkTrigger("이미 닫힌 링크 [[완료]]").active).toBe(false);
		expect(parseInternalLinkTrigger("일반 텍스트 [단일 대괄호]").active).toBe(false);
	});

	it("formats internal links as plain markdown links", () => {
		const item: InternalLinkItem = {
			id: "123e4567-e89b-12d3-a456-426614174000",
			collection: "post",
			title: "Next.js 완전 정복",
			slug: "nextjs-guide",
		};

		expect(formatContentLinkMdx(item)).toBe("[Next.js 완전 정복](/posts/nextjs-guide)");
		expect(formatContentLinkMdx(item, "가이드 보기")).toBe("[가이드 보기](/posts/nextjs-guide)");
		expect(formatContentLinkMdx({ ...item, slug: "" })).toBe("Next.js 완전 정복");
		expect(formatContentLinkMdx({ ...item, collection: "memo", slug: "한글 메모" })).toBe(
			"[Next.js 완전 정복](/memos/한글%20메모)",
		);
	});
});
