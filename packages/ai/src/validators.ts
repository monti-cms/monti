import type { CodeRule } from "@monti-cms/core/code-block";
import { defineValidator } from "./action";
import { lazyTranslator } from "./i18n";
import { validatorMessages } from "./validators.messages";

const t = lazyTranslator(validatorMessages);

/**
 * 기본 기능이 쓰는 코드 검사. 사이트 기능에도 그대로 넣을 수 있다.
 *
 * ```ts
 * aiAction({ ..., checks: [{ kind: "pattern", pattern: "^[a-z-]+$" }, uniqueSlug] })
 * ```
 *
 * 사이트 설정이 이 파일을 불러오므로, 사이트 설정을 읽는 본체 모듈(코드 블록·MDX 읽기)은 검사를 실행할 때 불러온다.
 */

/** 같은 컬렉션·언어의 다른 항목이 이미 쓰는 주소(slug)는 뺀다. 컬렉션을 모르는 실행이면 보지 않는다. */
export const uniqueSlug = defineValidator({
	name: "unique-slug",
	get label() {
		return t("uniqueSlug.label");
	},
	run: async (value, context) => {
		if (!context.collection) return true;
		const slug = value.trim();
		const taken = await context.content.slugsInUse({
			collection: context.collection,
			locale: context.locale,
			slugs: [slug],
			...(context.entryId ? { excludeEntryId: context.entryId } : {}),
		});
		return !taken.has(slug);
	},
});

/** `regexRuns`가 정규식을 돌려 볼 코드 규칙의 모양. 없으면 문서 전체(`document`)의 접기(`fold`) 규칙이다. */
export interface RegexRunsRule {
	readonly name?: CodeRule["name"];
	readonly scope?: CodeRule["scope"];
}

/**
 * 올바른 정규식이고 코드 입력(`input`, 없으면 `code`)에서 한 곳 이상 찾는 것만. 찾은 곳 수를 후보 옆에 붙인다.
 * `rule`은 찾을 때 쓸 코드 규칙의 이름·범위다.
 */
export const regexRuns = (input = "code", rule: RegexRunsRule = {}) =>
	defineValidator({
		name: "regex-runs",
		get label() {
			return t("regexRuns.label");
		},
		run: async (value, context) => {
			const { checkPattern, ruleMatches } = await import("@monti-cms/core/code-block");
			if (checkPattern(value, "g")) return false;
			const code = context.input[input];
			const count = ruleMatches(
				{
					id: "check",
					scope: rule.scope ?? "document",
					name: rule.name ?? "fold",
					pattern: value,
					flags: "g",
					attrs: {},
				},
				typeof code === "string" ? code : "",
			).length;
			return count > 0 ? { detail: t("regexRuns.detail", { count }) } : false;
		},
	});

/** MDX 결과가 원문 입력(`input`)과 같은 뼈대(요소·링크·코드·속성)인 것만. 번역에 쓴다. */
export const sameStructure = (input: string) =>
	defineValidator({
		name: "same-structure",
		get label() {
			return t("sameStructure.label");
		},
		run: async (value, context) => {
			const source = context.input[input];
			if (typeof source !== "string") return true;
			const { compareStructure } = await import("@monti-cms/core/client");
			const verdict = compareStructure(source, value);
			return verdict.ok ? true : verdict.reason;
		},
	});
