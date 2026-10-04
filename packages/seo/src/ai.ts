// The AI plugin is an optional dependency, so only its types are read (this file does not load AI plugin code).
import type { AiActionDefinition, AiContribution } from "@monti-cms/ai";
import { type CollectionsConfig, createActiveTranslator, valueFieldsOf } from "@monti-cms/core";
import { SEO_DEFAULT_LIMITS, SEO_ROLES } from "./fields";
import { seoMessages } from "./messages";

/**
 * Features the SEO extension adds to the AI plugin (search title and description suggestions). The `seo()` plugin adds them through `contributes.ai`, so they attach only to sites
 * that use the AI plugin. To change one: `aiPlugin({ actions: { seoTitle: seoAi.title({ prompt }) } })`; to turn it off: `seoTitle: false`.
 */

// These features are built after the site config is seen (`(site) => …`). The language is chosen then.
const t = createActiveTranslator(seoMessages);

const fieldInput = () =>
	({
		title: { kind: "text", label: t("ai.input.title") },
		summary: { kind: "text", label: t("ai.input.summary") },
		body: { kind: "mdx", label: t("ai.input.body") },
		current: { kind: "value", label: t("ai.input.current") },
	}) as const;

/**
 * The part of the site view (`AiSiteView`) passed by the AI plugin that this file reads, and the shape of the attach target (`AiAttach`). Written here so the published type declarations
 * do not reference the AI plugin (sites without the AI plugin still pass type checking). `satisfies` checks that the shape matches.
 */
export interface SeoSiteView {
	readonly collections: CollectionsConfig;
}
export interface FieldAttach {
	readonly slot: "field";
	readonly field: string;
	readonly collections: readonly string[];
}

/** Collections and fields that have that role field. One attach target per field name; length is field `max` → recommended length → default. */
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
	/** Title candidates shown in search results. Attaches to the search title role (`seoTitle`) field. */
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

	/** Description shown in search results. Attaches to the search description role (`seoDescription`) field. */
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

/** What `seo()` adds to the AI plugin. The feature names (`seoTitle`, `seoDescription`) are the keys of values edited in the admin AI screen. */
export const seoAiContribution = {
	actions: { seoTitle: seoAi.title(), seoDescription: seoAi.description() },
} satisfies AiContribution;
