import { createTranslator } from "@monti-cms/core/client";
import type { AiCandidate, AiCheck } from "./definition";
import { runMessages } from "./run.messages";

const t = createTranslator(runMessages);

/**
 * 정해진 결과 검사(순수 함수). 기능에 적힌 검사 목록 중 켜 둔 것을 차례로 적용해, 통과하지 못한 후보는 버린다.
 * 후보를 고치거나 잘라 내지 않는다. 코드 검사(`defineValidator`)는 이 검사 다음에 실행기가 부른다.
 */

export interface CheckEnv {
	/** 현재 값. 이미 같은 값인 후보는 뺀다. */
	current?: string | readonly string[];
	/** 고를 수 있는 값 → 보이는 이름(`있는 값만` 검사, 후보 이름 표시). */
	options?: ReadonlyMap<string, string>;
}

const matchesPattern = (pattern: string, value: string) => {
	try {
		return new RegExp(pattern, "u").test(value);
	} catch {
		return false;
	}
};

/** 정해진 검사 하나를 통과하는가. 코드 검사는 여기서 보지 않는다(실행기가 따로 부른다). */
function passes(check: AiCheck, value: string, env: CheckEnv): boolean {
	switch (check.kind) {
		case "pattern":
			return matchesPattern(check.pattern, value);
		case "maxLength":
			return Array.from(value).length <= check.max;
		case "exists":
			return env.options?.has(value) ?? false;
		case "oneOf":
			return check.items.includes(value);
		case "code":
			return true;
	}
}

export function checkCandidates(checks: readonly AiCheck[], raw: readonly string[], env: CheckEnv): AiCandidate[] {
	const current = new Set(Array.isArray(env.current) ? env.current : env.current ? [env.current] : []);
	const seen = new Set<string>();
	const items: AiCandidate[] = [];
	for (const value of raw.map((text) => text.trim())) {
		if (!value || seen.has(value) || current.has(value)) continue;
		seen.add(value);
		if (checks.some((check) => check.enabled && !passes(check, value, env))) continue;
		items.push({ value, label: env.options?.get(value) ?? value });
	}
	return items;
}

/** 긴 글 결과의 검사. 통과하지 못하면 이유를 돌려준다. */
export function checkText(checks: readonly AiCheck[], text: string): string | null {
	if (!text.trim()) return t("emptyResult");
	for (const check of checks) {
		if (!check.enabled) continue;
		if (check.kind === "pattern" && !matchesPattern(check.pattern, text.trim())) return t("check.format");
		if (check.kind === "maxLength" && Array.from(text.trim()).length > check.max)
			return t("check.maxLength", { max: check.max });
		if (check.kind === "oneOf" && !check.items.includes(text.trim())) return t("check.oneOf");
	}
	return null;
}
