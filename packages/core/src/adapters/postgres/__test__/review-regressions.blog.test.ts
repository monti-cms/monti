import { describe, expect, it } from "vitest";
import { prepareSnapshot, validateForPublish } from "../../../core/snapshot";

/**
 * 코드 리뷰(2026-09-26) 회귀 테스트 중 블로그 예시 설정의 블록(탭·툴팁·정렬)을 쓰는 것.
 * 설정과 상관없는 나머지는 `review-regressions.test.ts`에 있다.
 */
describe("review regressions (blog blocks)", () => {
	it("blocks publishing blocks without required attributes (§5.6)", async () => {
		const cases: [string, string][] = [
			["::::tabs\n:::tab\n첫\n:::\n:::tab\n둘\n:::\n::::", "missing_block_attribute"],
			["문장 :tooltip[표시] 끝", "missing_block_attribute"],
			[":::text-align\n가운데\n:::", "missing_block_attribute"],
			[':::text-align{align="justify"}\n가운데\n:::', "invalid_block_attribute"],
			[
				'::::tabs{defaultValue="없음"}\n:::tab{label="a"}\n1\n:::\n:::tab{label="b"}\n2\n:::\n::::',
				"invalid_block_attribute",
			],
		];
		for (const [mdx, code] of cases) {
			const snapshot = await prepareSnapshot({ collection: "memo", slug: "m", metadata: { title: "m" }, mdx });
			const result = validateForPublish(snapshot, { targets: [], media: [] });
			expect(result.ready, mdx).toBe(false);
			expect(
				result.issues.map((issue) => issue.code),
				mdx,
			).toContain(code);
		}
	});
});
