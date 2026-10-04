import { describe, expect, it } from "vitest";
import { likeContainsPattern, likePrefixPattern } from "../store/sql";

describe("LIKE 패턴", () => {
	it("포함 패턴은 앞뒤에 %를 붙인다", () => {
		expect(likeContainsPattern("hello")).toBe("%hello%");
	});

	it("접두 패턴은 뒤에만 %를 붙인다", () => {
		expect(likePrefixPattern("image/")).toBe("image/%");
	});

	it("검색어의 %·_·\\는 글자 그대로 찾게 이스케이프한다", () => {
		expect(likeContainsPattern("100%_a\\b")).toBe("%100\\%\\_a\\\\b%");
		expect(likePrefixPattern("a_%")).toBe("a\\_\\%%");
	});
});
