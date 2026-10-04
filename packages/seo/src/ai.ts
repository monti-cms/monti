// AI 플러그인은 고를 수 있는 의존성이라 타입만 읽는다(이 파일은 AI 플러그인 코드를 불러오지 않는다).
import type { AiActionDefinition, AiContribution } from "@monti-cms/ai";
import { type CollectionsConfig, createActiveTranslator, valueFieldsOf } from "@monti-cms/core";
import { SEO_DEFAULT_LIMITS, SEO_ROLES } from "./fields";
import { seoMessages } from "./messages";

/**
 * SEO 확장이 AI 플러그인에 더하는 기능(검색 제목·설명 추천). `seo()` 플러그인이 `contributes.ai`로 더하므로 AI 플러그인을
 * 쓰는 사이트에만 붙는다. 바꾸려면 `aiPlugin({ actions: { seoTitle: seoAi.title({ prompt }) } })`, 끄려면 `seoTitle: false`.
 */

// 이 기능들은 사이트 설정을 본 뒤에 만들어진다(`(site) => …`). 언어는 그때 고른다.
const t = createActiveTranslator(seoMessages);

const fieldInput = () =>
	({
		title: { kind: "text", label: t("ai.input.title") },
		summary: { kind: "text", label: t("ai.input.summary") },
		body: { kind: "mdx", label: t("ai.input.body") },
		current: { kind: "value", label: t("ai.input.current") },
	}) as const;

/**
 * AI 플러그인이 넘기는 사이트 보기(`AiSiteView`) 중 이 파일이 읽는 것과 붙을 곳(`AiAttach`)의 모양. 여기 적어 배포 타입 선언이
 * AI 플러그인을 가리키지 않게 한다(AI 플러그인이 없는 사이트도 타입 검사를 통과한다). 맞는 모양인지는 `satisfies`가 확인한다.
 */
export interface SeoSiteView {
	readonly collections: CollectionsConfig;
}
export interface FieldAttach {
	readonly slot: "field";
	readonly field: string;
	readonly collections: readonly string[];
}

/** 그 역할 필드가 있는 컬렉션과 필드. 필드 이름마다 붙을 곳 하나, 길이는 필드 `max` → 권장 글자 수 → 기본값. */
function roleTargets(site: SeoSiteView, role: string, fallback: number) {
	const byName = new Map<string, string[]>();
	const limits: number[] = [];
	for (const [collection, schema] of Object.entries(site.collections)) {
		const found = valueFieldsOf(schema).find((stored) => stored.field.role === role);
		if (!found) continue;
		byName.set(found.name, [...(byName.get(found.name) ?? []), collection]);
		const limit =
			("max" in found.field ? found.field.max : undefined) ??
			(typeof found.field.inputOptions?.limit === "number" ? found.field.inputOptions.limit : undefined);
		if (limit !== undefined) limits.push(limit);
	}
	const attach: FieldAttach[] = [...byName].map(([field, collections]) => ({ slot: "field", field, collections }));
	return { attach, max: limits.length > 0 ? Math.min(...limits) : fallback };
}

export const seoAi = {
	/** 검색 결과에 보일 제목 후보. 검색 제목 역할(`seoTitle`) 필드에 붙는다. */
	title:
		(options: { readonly prompt?: string; readonly maxLength?: number } = {}) =>
		(site: SeoSiteView) => {
			const { attach, max } = roleTargets(site, SEO_ROLES.title, SEO_DEFAULT_LIMITS.title);
			if (attach.length === 0) return undefined;
			const limit = options.maxLength ?? max;
			return {
				label: t("ai.title.label"),
				input: fieldInput(),
				send: ["title", "summary", "body"],
				result: "candidates",
				askInstruction: true,
				checks: [{ kind: "maxLength", max: limit }],
				prompt: options.prompt ?? t("ai.title.prompt", { limit }),
				attach,
			} satisfies AiActionDefinition;
		},

	/** 검색 결과에 보일 설명. 검색 설명 역할(`seoDescription`) 필드에 붙는다. */
	description:
		(options: { readonly prompt?: string; readonly maxLength?: number } = {}) =>
		(site: SeoSiteView) => {
			const { attach, max } = roleTargets(site, SEO_ROLES.description, SEO_DEFAULT_LIMITS.description);
			if (attach.length === 0) return undefined;
			const limit = options.maxLength ?? max;
			return {
				label: t("ai.description.label"),
				input: fieldInput(),
				send: ["title", "summary", "body"],
				result: "text",
				askInstruction: true,
				checks: [{ kind: "maxLength", max: limit }],
				prompt: options.prompt ?? t("ai.description.prompt", { limit }),
				attach,
			} satisfies AiActionDefinition;
		},
};

/** `seo()`가 AI 플러그인에 더하는 것. 기능 이름(`seoTitle`·`seoDescription`)은 관리자 AI 화면에서 고친 값의 키다. */
export const seoAiContribution = {
	actions: { seoTitle: seoAi.title(), seoDescription: seoAi.description() },
} satisfies AiContribution;
