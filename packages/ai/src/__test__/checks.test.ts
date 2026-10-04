import { createTranslator } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { checkCandidates, checkText } from "../checks";
import type { AiCheck } from "../definition";
import { KEBAB_PATTERN } from "../presets";
import { runMessages } from "../run.messages";

const t = createTranslator(runMessages);

const on = <T extends Omit<AiCheck, "enabled">>(check: T) => ({ ...check, enabled: true }) as AiCheck;

describe("AI result checks", () => {
	it("applies format and length checks in order and discards values without modifying them; code checks are not covered here", () => {
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

	it("accepts only existing values, and shows choice labels even without checks", () => {
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

	it("does not apply disabled checks", () => {
		const checks: AiCheck[] = [{ kind: "maxLength", max: 3, enabled: false }];
		expect(checkCandidates(checks, ["네 글자다"], {}).map((item) => item.value)).toEqual(["네 글자다"]);
	});

	it("long text is checked for format and length only", () => {
		expect(checkText([on({ kind: "maxLength", max: 5 })], "여섯 글자다")).toBe(t("check.maxLength", { max: 5 }));
		expect(checkText([on({ kind: "pattern", pattern: "^요약" })], "요약입니다")).toBeNull();
		expect(checkText([], "  ")).toBeTruthy();
	});
});
