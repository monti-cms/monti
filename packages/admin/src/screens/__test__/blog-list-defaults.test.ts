import { describe, expect, it } from "vitest";
import { columnsFor } from "../list-columns";

/**
 * 블로그 설정은 목록 설정(`list.columns`)을 지우고 기본 컬럼을 쓴다(M10-3). 기본 컬럼이 예전에 적어 두었던 컬럼과 같은지 본다.
 * 블로그 예시 설정(`packages/core/test/cms.config.ts`)으로만 돈다.
 */
describe("블로그 목록 기본 컬럼", () => {
	it.each([
		["post", ["title", "status", "locale", "categoryId", "tagIds", "updatedAt", "publishedAt"]],
		["memo", ["title", "status", "locale", "tagIds", "updatedAt", "publishedAt"]],
		["category", ["title", "slug", "locale", "status", "updatedAt"]],
		["tag", ["title", "slug", "locale", "status", "updatedAt"]],
		["collection", ["title", "slug", "locale", "status", "updatedAt"]],
	])("%s는 예전 목록 설정과 같다", (collection, columns) => {
		expect(columnsFor(collection).defaults).toEqual(columns);
	});
});
