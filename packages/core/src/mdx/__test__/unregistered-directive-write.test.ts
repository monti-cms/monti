import { describe, expect, it } from "vitest";
import { BLOCKS } from "../../blocks/active";
import { analyze, serialize, toDocument } from "..";
import { DIRECTIVE_NAMES } from "../directives";

/**
 * 설정에 없는 지시자(블록 이름)의 저장 왕복. 블로그 예시 설정과 다른 사이트 설정 둘 다로 돈다.
 * 다른 사이트 설정에는 탭이 없어 `::::tabs` 안의 `:::tab{…}`이 저장할 때마다 `\{` → `\\\{`로 백슬래시가 늘던 회귀다.
 * 미등록 블록 지시자는 원문을 이스케이프하지 않고 그대로 써야 다시 읽고 다시 써도 같다.
 */

/** 지금 설정에 없는 이름. 설정에 탭이 없으면 실제로 겪은 `tabs`/`tab`을, 있으면 아무 설정에도 없을 이름을 쓴다. */
const unregistered = (preferred: string, fallback: string) => (DIRECTIVE_NAMES.has(preferred) ? fallback : preferred);
const outer = unregistered("tabs", "unregistered-outer");
const inner = unregistered("tab", "unregistered-inner");

/** 쓰기 경로: `MDX → analyze → toDocument → serialize`. */
const write = (source: string): string => serialize(toDocument(analyze(source)));

/** 원문 그대로 남아야 하는 본문(맨 위 블록). */
const verbatim: [string, string][] = [
	["묶음 안 미등록 컨테이너", `::::${outer}\n:::${inner}{label="a"}\n본문\n:::\n::::\n`],
	["마크다운 특수 글자가 든 컨테이너", `:::${outer}{title="x"}\na_b *c* \\ [d] \\{e} \`f\`\n:::\n`],
	["리프", `::${outer}{a="b" c}\n`],
	["앞뒤 문단 사이", `앞 문단\n\n::::${outer}\n:::${inner}{label="a"}\n본문\n:::\n::::\n\n뒤 문단\n`],
];

/** 다른 블록 안에 든 경우. 바깥 블록의 정본 모양으로 한 번 바뀔 수는 있지만 그 뒤로는 같아야 한다. */
const nested: [string, string][] = [
	["인용 안", `> :::${outer}{label="a"}\n> a_b\n> :::\n`],
	["목록 안", `- :::${outer}{label="a"}\n  a_b\n  :::\n`],
];

describe("미등록 지시자 저장 왕복", () => {
	it("이 시험이 쓰는 이름은 지금 설정에 없다", () => {
		for (const name of [outer, inner]) {
			expect(DIRECTIVE_NAMES.has(name)).toBe(false);
			expect(BLOCKS.some((block) => block.name === name)).toBe(false);
		}
	});

	it.each(verbatim)("%s는 원문 그대로 쓴다", (_label, source) => {
		const first = write(source);
		expect(first).toBe(source);
		expect(write(first)).toBe(first);
	});

	it.each(nested)("%s도 두 번째 저장부터 같다", (_label, source) => {
		const first = write(source);
		const second = write(first);
		expect(second).toBe(first);
		expect(write(second)).toBe(first);
		// 바깥 블록 접두(`> `, 들여쓰기)가 지시자 원문에 섞여 겹치지 않는다.
		expect(first).not.toContain("> >");
		expect(first).toContain("a_b");
	});
});
