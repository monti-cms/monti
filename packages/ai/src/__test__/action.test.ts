import { BLOCKS, cmsConfig } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { seoAi } from "../../../seo/src/ai";
import {
	type AiActionDefinition,
	type AiActionFactory,
	type AiActionInput,
	type AiActionResult,
	aiAction,
	aiActionOverrideSchema,
	aiInput,
	defineValidator,
	overrideFrom,
	renderPrompt,
	resolveAction,
	unknownPlaceholders,
	validateAiConfig,
} from "../action";
import { legacyFeatureOverride } from "../actions";
import type { AiCandidate } from "../definition";
import { lazyTranslator } from "../i18n";
import { aiPresets, KEBAB_PATTERN } from "../presets";
import { presetMessages } from "../presets.messages";
import { AI_ACTIONS, AI_SHARED, attachedTo } from "../registry";

const presetText = lazyTranslator(presetMessages);

/** Whether the two types are the same (for type checking). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Builds a preset (factory function) from the example config. The test fails if there is nowhere to attach it. */
const site = { collections: cmsConfig.collections, blocks: BLOCKS, locales: cmsConfig.locales, sharedKeys: [] };
type Def<F> = F extends (...args: never[]) => infer D ? NonNullable<D> : never;
function build<F extends AiActionFactory>(factory: F): Def<F> {
	const definition = factory(site);
	if (!definition) throw new Error("preset has nothing to attach to");
	return definition as Def<F>;
}

const collections = {
	post: {
		fields: {
			title: { kind: "text" },
			slug: { kind: "slug" },
			tagIds: { kind: "relation" },
			policy: { kind: "conditional", discriminant: { kind: "select" } },
		},
	},
	tag: { fields: { title: { kind: "text" } } },
} as const;

describe("AI action definition", () => {
	it("layers edited values onto the definition. Checks keep the definition's kind and order; only enabled and value change", () => {
		const slug = build(aiPresets.slug());
		const action = resolveAction("slug", slug, {
			prompt: "바꾼 지시문",
			send: ["title", "nope"],
			checks: [
				{ kind: "code", name: "unique-slug", enabled: false },
				{ kind: "code", name: "regex-runs", enabled: true },
				{ kind: "maxLength", max: 40, enabled: true },
			],
		});
		expect(action).toMatchObject({
			label: presetText("label.slug"),
			prompt: "바꾼 지시문",
			send: ["title"],
			apply: "replace",
		});
		// Required inputs cannot be turned off.
		expect(resolveAction("translate", build(aiPresets.translate()), { send: [] }).send).toEqual([
			"block",
			"from",
			"to",
		]);
		expect(action.checks).toEqual([
			{ kind: "pattern", pattern: KEBAB_PATTERN, enabled: true },
			{ kind: "maxLength", max: 40, enabled: true },
			{ kind: "code", name: "unique-slug", enabled: false },
		]);
		expect(Object.keys(action.validators)).toEqual(["unique-slug"]);
		expect(action.definedChecks).toEqual(["pattern", "maxLength", "code:unique-slug"]);
	});

	it("edited values for the formerly fixed checks (no duplicates, regex run, structure preserved) are read as enabling the same code check", () => {
		const override = aiActionOverrideSchema.parse({
			checks: [
				{ kind: "unique", enabled: false },
				{ kind: "regexRuns", enabled: true },
			],
		});
		expect(override.checks).toEqual([
			{ kind: "code", name: "unique-slug", enabled: false },
			{ kind: "code", name: "regex-runs", enabled: true },
		]);
		expect(resolveAction("slug", build(aiPresets.slug()), override).checks.at(-1)).toEqual({
			kind: "code",
			name: "unique-slug",
			enabled: false,
		});
	});

	it("code check names are lowercase hyphenated and used once per action", () => {
		const check = defineValidator({ name: "no-dup", label: "겹침 없음", run: () => true });
		const action = (checks: AiActionDefinition["checks"]) =>
			aiAction({ label: "x", input: { title: aiInput.text({ label: "제목" }) }, result: "text", prompt: "x", checks });
		expect(() => validateAiConfig({ actions: { a: action([check, check]) } }, collections)).toThrow("listed twice");
		expect(() =>
			validateAiConfig(
				{ actions: { a: action([defineValidator({ name: "Bad", label: "x", run: () => true })]) } },
				collections,
			),
		).toThrow("kebab-case");
	});

	it("checks added in the admin UI (format, length, one-of) are appended after the definition's checks, and the definition's checks cannot be removed", () => {
		const definition = build(seoAi.title());
		const action = resolveAction("seoTitle", definition, {
			checks: [
				{ kind: "maxLength", enabled: false, max: 60 },
				{ kind: "oneOf", enabled: true, items: ["가", "나"] },
				{ kind: "oneOf", enabled: true, items: ["중복"] },
				{ kind: "code", name: "unique-slug", enabled: true },
			],
		});
		expect(action.checks).toEqual([
			{ kind: "maxLength", enabled: false, max: 60 },
			{ kind: "oneOf", enabled: true, items: ["가", "나"] },
		]);
		expect(action.definedChecks).toEqual(["maxLength"]);
		// Added checks are stored as edited values and read back the same.
		const override = overrideFrom(definition, { checks: action.checks });
		expect(resolveAction("seoTitle", definition, override).checks).toEqual(action.checks);
	});

	it("only edited values that differ from the defaults are kept for saving", () => {
		const summary = build(aiPresets.summary());
		const base = resolveAction("summary", summary);
		expect(overrideFrom(summary, { ...base })).toEqual({});
		expect(overrideFrom(summary, { ...base, enabled: false, modelName: "m" })).toEqual({
			enabled: false,
			modelName: "m",
		});
	});

	it("only language inputs go into instructions as {{name}}, and unused language inputs are appended as lines", () => {
		const input = {
			block: aiInput.mdx({ label: "원문" }),
			to: aiInput.locale({ label: "대상 언어" }),
			from: aiInput.locale({ label: "원문 언어" }),
		};
		expect(unknownPlaceholders("{{to}}로 {{block}}", input)).toEqual(["block"]);
		const names = (code: string) => ({ ko: "한국어", en: "English" })[code] ?? code;
		expect(
			renderPrompt(
				{ prompt: "{{to}}로 옮긴다.", input, askInstruction: true },
				{ to: "en", from: "ko" },
				names,
				" 짧게 ",
			),
		).toBe(
			"English로 옮긴다.\n\nfrom: 한국어\n\nRequest for this run (takes priority over the instructions above):\n짧게",
		);
		expect(renderPrompt({ prompt: "p", input, askInstruction: false }, {}, names, "무시")).toBe("p");
	});

	it("config validation: reports options, attach points, and checks that do not match the definition", () => {
		const ok = (actions: Record<string, unknown>) => () =>
			validateAiConfig({ actions } as Parameters<typeof validateAiConfig>[0], cmsConfig.collections);
		const tags = build(aiPresets.tags());
		const slug = build(aiPresets.slug());
		const summary = build(aiPresets.summary());
		expect(ok({ tags })).not.toThrow();
		expect(ok({ tags: { ...tags, choices: { from: "collection", collection: "nope" } } })).toThrow(
			/unknown collection/,
		);
		expect(ok({ slug: { ...slug, attach: [{ slot: "field", field: "missing" }] } })).toThrow(/unknown field/);
		expect(ok({ slug: { ...slug, attach: [{ slot: "field", field: "summary", collections: ["tag"] }] } })).toThrow(
			/no field "summary"/,
		);
		expect(ok({ "bad-key": slug })).toThrow(/name/);
		expect(ok({ x: { ...summary, prompt: "{{title}}" } })).toThrow(/locale inputs/);
		expect(ok({ x: { ...summary, engine: "decide" } })).toThrow(/choices/);
		expect(ok({ x: { ...summary, checks: [{ kind: "exists" }] } })).toThrow(/choices/);
		expect(ok({ x: { ...aiPresets.codeFold(), attach: [{ slot: "field", field: "title" }] } })).not.toThrow();
		expect(ok({ x: { ...build(aiPresets.translate()), attach: [{ slot: "field", field: "title" }] } })).toThrow(
			/cannot fill/,
		);
		expect(
			ok({
				x: {
					...build(aiPresets.category()),
					choices: { from: "select", collection: "post", field: "policy" },
					attach: [],
				},
			}),
		).not.toThrow();
	});

	it("every action in the example config follows the definition rules", () => {
		expect(() =>
			validateAiConfig(
				{ actions: AI_ACTIONS, shared: AI_SHARED } as Parameters<typeof validateAiConfig>[0],
				cmsConfig.collections,
			),
		).not.toThrow();
	});

	it("block slot: attaches only to blocks the site uses, and the result is MDX", () => {
		const edit = (patch: object = {}) => ({
			label: "고치기",
			input: { block: { kind: "mdx" as const, label: "블록", required: true } },
			prompt: "고친다.",
			result: "mdx" as const,
			attach: [{ slot: "block" as const, block: "mermaid" }],
			...patch,
		});
		const check =
			(action: object, blocks: readonly string[] = ["image", "mermaid"]) =>
			() =>
				validateAiConfig({ actions: { a: action } } as Parameters<typeof validateAiConfig>[0], {}, blocks);
		expect(check(edit())).not.toThrow();
		expect(check(edit(), ["image"])).toThrow(/unknown block "mermaid"/);
		expect(check(edit({ result: "text" }))).toThrow(/block slot needs an mdx result/);
		// The block slot only gives the block source and the title.
		expect(check(edit({ input: { code: { kind: "code" as const, label: "코드", required: true } } }))).toThrow(
			/cannot fill/,
		);
		expect(attachedTo({ slot: "block", block: "mermaid" }, { slot: "block", target: "mermaid" })).toBe(true);
		expect(attachedTo({ slot: "block", block: "mermaid" }, { slot: "block", target: "chart" })).toBe(false);
	});

	it("only shared text names can go into instructions, and streaming is only for generate mode's text/MDX results", () => {
		const base = { actions: {} };
		const action = (patch: object) => ({
			label: "x",
			input: { body: { kind: "mdx" as const, label: "본문" } },
			prompt: "다듬는다.",
			result: "mdx" as const,
			...patch,
		});
		expect(() =>
			validateAiConfig(
				{
					...base,
					shared: { guide: { label: "가이드", text: "" } },
					actions: { a: action({ prompt: "{{shared.guide}}" }) },
				},
				{},
			),
		).not.toThrow();
		expect(() => validateAiConfig({ ...base, actions: { a: action({ prompt: "{{shared.nope}}" }) } }, {})).toThrow(
			/shared texts/,
		);
		expect(() =>
			validateAiConfig({ ...base, actions: { a: action({ stream: true, result: "candidates" }) } }, {}),
		).toThrow(/stream needs/);
	});

	it("moves stored values from the legacy action table into edited values (including legacy check shapes, missing inputs, and missing actions)", () => {
		expect(
			legacyFeatureOverride("summary", {
				enabled: false,
				prompt: "운영자가 고친 지시문",
				inputs: ["title", "tags", "body"],
				check: "maxLength",
				maxLength: 120,
				name: "무시되는 이름",
			}),
		).toEqual({
			enabled: false,
			prompt: "운영자가 고친 지시문",
			checks: [{ kind: "maxLength", max: 120, enabled: true }],
		});
		expect(legacyFeatureOverride("summary", { ...resolveAction("summary", AI_ACTIONS.summary as never) })).toEqual({});
		expect(legacyFeatureOverride("mediaAlt", { prompt: "x" })).toBeNull();
		expect(legacyFeatureOverride("translate", { inputs: [], prompt: AI_ACTIONS.translate?.prompt })).toEqual({});
		expect(legacyFeatureOverride("slug", { checks: [{ kind: "pattern", pattern: "(" }] })).toEqual({});
	});

	it("types: instruction placeholders, attach points, inputs, and results are checked from the definition", () => {
		type Translate = Def<ReturnType<typeof aiPresets.translate>>;
		const input: Equal<AiActionInput<Translate>, { block: string; from: string; to: string }> = true;
		const mdx: Equal<AiActionResult<Translate>, { kind: "mdx"; text: string }> = true;
		type Tags = Def<ReturnType<typeof aiPresets.tags>>;
		const candidates: Equal<AiActionResult<Tags>, { kind: "candidates"; items: AiCandidate[] }> = true;
		const summaryInput: Equal<
			AiActionInput<Def<ReturnType<typeof aiPresets.summary>>>,
			{ title?: string; summary?: string; body?: string; current?: string | readonly string[] }
		> = true;
		expect([input, mdx, candidates, summaryInput]).toEqual([true, true, true, true]);
		aiAction({
			label: "x",
			input: { to: aiInput.locale({ label: "언어" }) },
			result: "text",
			prompt: "{{to}}로 쓴다",
		});
		aiAction({
			label: "x",
			input: { title: aiInput.text({ label: "제목" }) },
			result: "text",
			// @ts-expect-error only language inputs can go into instructions
			prompt: "{{title}}을 쓴다",
		});
		aiAction({
			label: "x",
			input: { instruction: aiInput.text({ label: "요청", required: true }) },
			result: "mdx",
			prompt: "초안을 쓴다",
			// @ts-expect-error the slot beside a field cannot fill the required input `instruction`
			attach: [{ slot: "field", field: "body" }],
		});
	});
});
