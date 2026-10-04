import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECTION, isDocumentCollection, taxonomyFieldsOf } from "../collections";

/**
 * 블로그 예시 설정(`test/cms.config.ts`)의 컬렉션 목록을 그대로 확인한다(다른 사이트 설정으로는 돌지 않는다).
 * 게시글(카테고리 하나·태그 여러 개), 메모(태그), 분류용 태그·카테고리·모음집. 설정과 상관없는 규칙은 `collections.test.ts`.
 */
describe("컬렉션 도우미(블로그 예시 설정)", () => {
	it("기본 컬렉션은 처음 선언한 발행형 컬렉션이다", () => {
		expect(DEFAULT_COLLECTION).toBe("post");
		expect(isDocumentCollection("memo")).toBe(true);
		expect(isDocumentCollection("tag")).toBe(false);
		expect(isDocumentCollection("nope")).toBe(false);
	});

	it("분류 필드는 분류용(record) 컬렉션을 가리키는 관계 필드다", () => {
		expect(taxonomyFieldsOf("post").map((stored) => [stored.name, stored.to])).toEqual([
			["categoryId", "category"],
			["tagIds", "tag"],
		]);
		expect(taxonomyFieldsOf("memo").map((stored) => stored.name)).toEqual(["tagIds"]);
		// 모음집의 글 목록은 발행형 컬렉션을 가리켜 분류 필드가 아니다.
		expect(taxonomyFieldsOf("collection")).toEqual([]);
		expect(taxonomyFieldsOf("nope")).toEqual([]);
	});
});
