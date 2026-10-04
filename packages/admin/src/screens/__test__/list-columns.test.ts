import { describe, expect, it, vi } from "vitest";

// 주소 필드 이름이 `slug`가 아닌 사이트.
vi.mock("@monti-cms/core/client", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@monti-cms/core/client")>();
	const article = {
		label: "Article",
		kind: "document",
		body: true,
		fields: {
			title: { kind: "text", label: "Title" },
			permalink: { kind: "slug", label: "Permalink", from: "title" },
		},
		list: { columns: ["title", "permalink", "status"] },
	};
	const note = { ...article, fields: { title: { kind: "text", label: "Title" } }, list: { columns: ["title"] } };
	// 목록 설정(`list`)이 없는 컬렉션: 기본 컬럼을 쓴다.
	const story = {
		label: "Story",
		kind: "document",
		body: true,
		fields: {
			title: { kind: "text", label: "Title" },
			topicId: { kind: "relation", label: "Topic", to: "topic" },
		},
	};
	const topic = {
		label: "Topic",
		kind: "item",
		body: false,
		fields: { title: { kind: "text", label: "Title" }, key: { kind: "slug", label: "Key", from: "title" } },
	};
	const own: Record<string, unknown> = { article, note, story, topic };
	const taxonomy: Record<string, unknown[]> = {
		story: [{ name: "topicId", field: story.fields.topicId, to: "topic" }],
	};
	return {
		...actual,
		// 언어가 둘 이상인 사이트.
		LOCALES: ["en", "ko"],
		isCollection: (name: string) => name in own || actual.isCollection(name),
		schemaOf: (name: string) => own[name] ?? actual.schemaOf(name as never),
		taxonomyFieldsOf: (name: string) => taxonomy[name] ?? (name in own ? [] : actual.taxonomyFieldsOf(name as never)),
	};
});

const { columnsFor, defaultListColumns } = await import("../list-columns");

describe("list columns", () => {
	it("finds the slug column by field kind, not by name", () => {
		const { available, defaults } = columnsFor("article");
		expect(available).toContain("slug");
		expect(defaults).toEqual(["title", "slug", "status"]);
	});

	it("has no slug column without a slug field, and always has a title column", () => {
		const { available } = columnsFor("note");
		expect(available).not.toContain("slug");
		expect(available).toContain("title");
	});

	it("목록 설정이 없으면 기본 컬럼이다: 문서는 제목·상태·언어·분류 필드·수정일·발행일, 항목은 제목·주소·언어·상태·수정일", () => {
		expect(defaultListColumns("story")).toEqual(["title", "status", "locale", "topicId", "updatedAt", "publishedAt"]);
		expect(columnsFor("story").defaults).toEqual(["title", "status", "locale", "topicId", "updatedAt", "publishedAt"]);
		expect(defaultListColumns("topic")).toEqual(["title", "slug", "locale", "status", "updatedAt"]);
		expect(columnsFor("topic").defaults).toEqual(["title", "slug", "locale", "status", "updatedAt"]);
	});
});
