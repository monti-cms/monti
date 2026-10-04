import { describe, expect, it, vi } from "vitest";

/**
 * 컬렉션 종류(`kind`)·필수 필드(`required: true`)·빈 본문 검사(`body`)를 테스트 설정 하나로 시험한다(M10-3).
 * 블로그·다른 사이트 설정과 상관없이 돌도록 `@cms-config`를 이 파일의 설정으로 바꾼다.
 */
vi.mock("@cms-config", async () => {
	const { defineCollection, defineConfig, fields } = await import("../..");
	const title = fields.text({ label: "Title", required: true });
	const slug = fields.slug({ label: "Slug", from: "title", required: "publish" });
	return {
		default: defineConfig({
			collections: {
				// 본문 없는 문서(예: 링크 모음). 발행은 하지만 본문을 검사하지 않는다.
				page: defineCollection({ label: "Page", kind: "document", body: false, fields: { title, slug } }),
				note: defineCollection({
					label: "Note",
					kind: "document",
					fields: {
						title,
						slug,
						pageId: fields.relation({ label: "Page", to: "page", allowUnpublished: true }),
						summary: fields.text({ label: "Summary", fillFromBody: { maxLength: 40 }, max: 30 }),
					},
				}),
				// 예전 이름(`workflow`)도 받는다.
				label: defineCollection({ label: "Label", workflow: "record", fields: { title, slug } }),
			},
			locales: [{ code: "en", name: "English" }],
			defaultLocale: "en",
		}),
	};
});

const { COLLECTION_DEFINITIONS, DOCUMENT_COLLECTIONS, isDocumentCollection, isItemCollection } = await import(
	"../collections"
);
const { validateForPublish } = await import("../snapshot");
const { missingRequiredIssues, schemaOf, storedField } = await import("../../schema/derive");
const { fillFromBodyLength } = await import("../../schema/fields");

/** 이 파일의 설정 컬렉션(타입은 패키지 테스트 설정이라 넓혀 쓴다). */
const c = (name: "page" | "note" | "label") => name as never;

const snapshot = (collection: string, patch: object = {}) =>
	({
		collection,
		slug: "a",
		metadata: { title: "T" },
		mdx: "",
		schemaVersion: 1,
		contentHash: "h",
		references: [],
		issues: [],
		imageSources: [],
		...patch,
	}) as never;

describe("컬렉션 종류", () => {
	it("본체는 정리한 `kind`만 읽는다(예전 `workflow`는 바꿔 둔다)", () => {
		expect((COLLECTION_DEFINITIONS as Record<string, { kind: string }>).label?.kind).toBe("item");
		expect(schemaOf(c("label")).body).toBe(false);
		expect(isItemCollection("label")).toBe(true);
		expect(isDocumentCollection("page")).toBe(true);
		expect(DOCUMENT_COLLECTIONS).toEqual(["page", "note"]);
	});
});

describe("필수 필드(`required: true`)", () => {
	it('비어 있으면 문제다(예전 값 `"publish"`도 같다)', () => {
		expect(missingRequiredIssues(c("label"), { slug: null, metadata: {} })).toEqual([
			{ code: "null_slug", path: "slug" },
			{ code: "missing_field", path: "title", message: "Title" },
		]);
		expect(missingRequiredIssues(c("label"), { slug: "a", metadata: { title: "T" } })).toEqual([]);
	});
});

describe("빈 본문 검사", () => {
	it("본문을 쓰는 컬렉션(`body`)만 막는다", () => {
		expect(validateForPublish(snapshot("page"), { targets: [], media: [] }).issues).toEqual([]);
		expect(validateForPublish(snapshot("note"), { targets: [], media: [] }).issues).toContainEqual(
			expect.objectContaining({ code: "empty_body" }),
		);
	});

	it("관계 대상 컬렉션이 다르면 미공개를 허용하는 관계도 `invalid_reference_collection`이다", () => {
		const target = "123e4567-e89b-12d3-a456-426614174001";
		const result = validateForPublish(snapshot("note", { mdx: "본문", metadata: { title: "T", pageId: target } }), {
			targets: [{ id: target, isPublished: false, collection: "note" }],
			media: [],
		});
		expect(result.issues.map((issue) => issue.code)).toEqual(["invalid_reference_collection"]);
	});
});

describe("본문에서 채우기(`fillFromBody`)", () => {
	it("`{ maxLength }`를 쓰고 필드 `max`를 넘지 않는다", () => {
		const field = storedField(c("note"), "summary")?.field;
		expect(field?.kind === "text" && fillFromBodyLength(field)).toBe(30);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: true })).toBe(160);
		expect(fillFromBodyLength({ kind: "text", label: "a", fillFromBody: { maxLength: 80 } })).toBe(80);
		expect(fillFromBodyLength({ kind: "text", label: "a" })).toBeUndefined();
	});
});
