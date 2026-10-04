import { createTranslator } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { checkCandidates, checkText } from "../checks";
import type { AiCheck } from "../definition";
import { KEBAB_PATTERN } from "../presets";
import { runMessages } from "../run.messages";

const t = createTranslator(runMessages);

const on = <T extends Omit<AiCheck, "enabled">>(check: T) => ({ ...check, enabled: true }) as AiCheck;

describe("AI 결과 검사", () => {
	it("형식·길이를 차례로 적용하고, 값을 고치지 않고 버린다. 코드 검사는 여기서 보지 않는다", () => {
		const checks = [
			on({ kind: "pattern", pattern: KEBAB_PATTERN }),
			on({ kind: "maxLength", max: 20 }),
			on({ kind: "code", name: "unique-slug" }),
		];
		const items = checkCandidates(
			checks,
			["react-query-guide", "Next.js Scroll", "a-very-long-slug-over-twenty", "same", "react-query-guide"],
			{ current: "same" },
		);
		expect(items.map((item) => item.value)).toEqual(["react-query-guide"]);
	});

	it("있는 값만 받고, 검사가 없어도 선택지 이름으로 보인다", () => {
		const options = new Map([
			["t1", "React"],
			["t2", "Next.js"],
		]);
		expect(checkCandidates([on({ kind: "exists" })], ["t1", "unknown"], { options })).toEqual([
			{ value: "t1", label: "React" },
		]);
		expect(checkCandidates([], ["t2", "unknown"], { options })).toEqual([
			{ value: "t2", label: "Next.js" },
			{ value: "unknown", label: "unknown" },
		]);
	});

	it("꺼 둔 검사는 적용하지 않는다", () => {
		const checks: AiCheck[] = [{ kind: "maxLength", max: 3, enabled: false }];
		expect(checkCandidates(checks, ["네 글자다"], {}).map((item) => item.value)).toEqual(["네 글자다"]);
	});

	it("긴 글은 형식·길이만 본다", () => {
		expect(checkText([on({ kind: "maxLength", max: 5 })], "여섯 글자다")).toBe(t("check.maxLength", { max: 5 }));
		expect(checkText([on({ kind: "pattern", pattern: "^요약" })], "요약입니다")).toBeNull();
		expect(checkText([], "  ")).toBeTruthy();
	});
});
