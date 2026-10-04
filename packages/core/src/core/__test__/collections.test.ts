import { describe, expect, it } from "vitest";
import { contentCollection, recordCollection, recordRelationField } from "../../../test/any-site";
import { storedFields } from "../../schema/derive";
import {
	COLLECTIONS,
	DEFAULT_COLLECTION,
	DOCUMENT_COLLECTIONS,
	isDocumentCollection,
	isItemCollection,
	taxonomyFieldsOf,
} from "../collections";

/**
 * 설정과 상관없는 컬렉션 도우미 규칙. 컬렉션·필드 이름은 지금 설정에서 찾는다(`test/any-site.ts`).
 * 블로그 예시 설정의 컬렉션 목록 그대로는 `collections.blog.test.ts`가 확인한다.
 */
describe("컬렉션 도우미", () => {
	it("기본 컬렉션은 처음 선언한 발행형 컬렉션이다", () => {
		expect(DEFAULT_COLLECTION).toBe(COLLECTIONS.find((name) => !isItemCollection(name)));
		expect(DOCUMENT_COLLECTIONS[0]).toBe(DEFAULT_COLLECTION);
		expect(isDocumentCollection(contentCollection)).toBe(true);
		expect(isDocumentCollection(recordCollection)).toBe(false);
		expect(isDocumentCollection("nope")).toBe(false);
	});

	it("분류 필드는 분류용(record) 컬렉션을 가리키는 관계 필드다", () => {
		const first = recordRelationField(contentCollection);
		if (first) expect(taxonomyFieldsOf(contentCollection)[0]).toMatchObject({ name: first.name, to: first.to });

		for (const collection of COLLECTIONS) {
			const relations = storedFields(collection).flatMap((stored) =>
				stored.field.kind === "relation" ? [{ name: stored.name, to: stored.field.to }] : [],
			);
			// 항목 컬렉션을 가리키는 관계만 선언 순서대로 남고, 발행형 컬렉션을 가리키는 관계(글 목록 등)는 빠진다.
			expect(taxonomyFieldsOf(collection).map((stored) => [stored.name, stored.to])).toEqual(
				relations.filter(({ to }) => isItemCollection(to)).map(({ name, to }) => [name, to]),
			);
		}
		expect(taxonomyFieldsOf("nope")).toEqual([]);
	});
});
