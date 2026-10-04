import { describe, expect, it, vi } from "vitest";
import type { AiValidatorContext } from "../action";
import { lazyTranslator } from "../i18n";
import { regexRuns, sameStructure, uniqueSlug } from "../validators";
import { validatorMessages } from "../validators.messages";

const validatorText = lazyTranslator(validatorMessages);

const context = (
	input: Record<string, unknown>,
	taken: string[] = [],
	extra: Partial<AiValidatorContext> = {},
): AiValidatorContext => ({
	input,
	locale: "ko",
	content: { slugsInUse: async ({ slugs }) => new Set(slugs.filter((slug) => taken.includes(slug))) },
	...extra,
});

describe("기본 코드 검사", () => {
	it("중복 없음은 본체 콘텐츠 조회로 다른 항목이 쓰는 주소를 뺀다", async () => {
		const post = { collection: "post" };
		expect(await uniqueSlug.run("taken-slug", context({}, ["taken-slug"], post))).toBe(false);
		expect(await uniqueSlug.run(" taken-slug ", context({}, ["taken-slug"], post))).toBe(false);
		expect(await uniqueSlug.run("fresh-slug", context({}, ["taken-slug"], post))).toBe(true);
		// 컬렉션을 모르면 묻지 않고 통과시킨다.
		expect(await uniqueSlug.run("taken-slug", context({}, ["taken-slug"]))).toBe(true);
	});

	it("중복 없음은 컬렉션·언어·고치는 항목을 조회에 넘긴다", async () => {
		const slugsInUse = vi.fn(async () => new Set<string>());
		await uniqueSlug.run("a", {
			input: {},
			collection: "post",
			locale: "en",
			entryId: "e1",
			content: { slugsInUse },
		});
		expect(slugsInUse).toHaveBeenCalledWith({ collection: "post", locale: "en", slugs: ["a"], excludeEntryId: "e1" });
	});

	it("정규식 실행은 문법이 맞고 코드 입력에서 한 곳 이상 찾는 것만 남기고 찾은 곳 수를 붙인다", async () => {
		const code = "import { a, b, c } from 'x';\nconst value = 1;\nconst other = 2;";
		const check = regexRuns("code");
		expect(await check.run("const \\w+", context({ code }))).toEqual({
			detail: validatorText("regexRuns.detail", { count: 2 }),
		});
		expect(await check.run("(", context({ code }))).toBe(false);
		expect(await check.run("nothing-here", context({ code }))).toBe(false);
		// 규칙 이름을 바꿔도 같은 입력에서 찾는다.
		expect(await regexRuns("code", { name: "strong" }).run("const \\w+", context({ code }))).toEqual({
			detail: validatorText("regexRuns.detail", { count: 2 }),
		});
	});

	it("구조 유지는 원문 입력과 뼈대가 다르면 이유를 돌려준다", async () => {
		const check = sameStructure("block");
		expect(await check.run("Hello [link](/a)", context({ block: "안녕 [링크](/a)" }))).toBe(true);
		expect(await check.run("Hello", context({ block: "안녕 [링크](/a)" }))).toEqual(expect.any(String));
	});
});
