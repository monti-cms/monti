import { describe, expect, it } from "vitest";
import { seoAi } from "../../../seo/src/ai";
import { testSite } from "../../test/site";
import {
	type AiActionDefinition,
	type AiActionFactory,
	type AiActionInput,
	type AiActionResult,
	aiAction,
	aiInput,
	checkAiConfig,
	defineValidator,
	overrideFrom,
	renderPrompt,
	resolveAction,
	unknownPlaceholders,
} from "../action";
import type { AiCandidate } from "../definition";
import { aiPresets, KEBAB_PATTERN } from "../presets";
import { presetMessages } from "../presets.messages";
import { aiRegistryOf, aiSiteViewOf, attachedTo } from "../registry";

const presetText = testSite.createTranslator(presetMessages);
const { actions: AI_ACTIONS, snippets: AI_SNIPPETS } = aiRegistryOf(testSite);

/** Whether the two types are the same (for type checking). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Builds a preset (factory function) from the example config. The test fails if there is nowhere to attach it. */
const site = { ...aiSiteViewOf(testSite), snippetKeys: [] };
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

	it("only a slot with a place to type asks for an extra request: a field action that asks is a config error and never asks once resolved", () => {
		const definition = (attach: AiActionDefinition["attach"]) =>
			aiAction({
				label: "x",
				input: { title: aiInput.text({ label: "제목" }) },
				result: "text",
				prompt: "x",
				askInstruction: true,
				attach,
			});
		const issues = (attach: AiActionDefinition["attach"]) =>
			checkAiConfig({ actions: { a: definition(attach) } }, collections).map((issue) => issue.code);
		expect(issues([{ slot: "field", field: "title" }])).toContain("askInstruction");
		expect(issues([{ slot: "selection" }])).not.toContain("askInstruction");
		expect(resolveAction("a", definition([{ slot: "field", field: "title" }])).askInstruction).toBe(false);
		expect(resolveAction("a", definition([{ slot: "insert" }])).askInstruction).toBe(true);
	});

	it("code check names are lowercase hyphenated and used once per action", () => {
		const check = defineValidator({ name: "no-dup", label: "겹침 없음", run: () => true });
		const action = (checks: AiActionDefinition["checks"]) =>
			aiAction({ label: "x", input: { title: aiInput.text({ label: "제목" }) }, result: "text", prompt: "x", checks });
		const messages = (checks: AiActionDefinition["checks"]) =>
			checkAiConfig({ actions: { a: action(checks) } }, collections).map((issue) => issue.message);
		expect(messages([check, check])).toEqual([expect.stringContaining("listed twice")]);
		expect(messages([defineValidator({ name: "Bad", label: "x", run: () => true })])).toEqual([
			expect.stringContaining("kebab-case"),
		]);
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
		const issuesOf = (actions: Record<string, unknown>) =>
			checkAiConfig({ actions } as Parameters<typeof checkAiConfig>[0], testSite.config.collections);
		const codesOf = (actions: Record<string, unknown>) => issuesOf(actions).map((issue) => issue.code);
		const tags = build(aiPresets.tags());
		const slug = build(aiPresets.slug());
		const summary = build(aiPresets.summary());
		expect(issuesOf({ tags })).toEqual([]);
		expect(issuesOf({ tags: { ...tags, choices: { from: "collection", collection: "nope" } } })).toEqual([
			expect.objectContaining({ path: "plugins.ai.actions.tags", code: "choices" }),
		]);
		expect(issuesOf({ slug: { ...slug, attach: [{ slot: "field", field: "missing" }] } })[0]?.message).toMatch(
			/unknown field/,
		);
		expect(
			issuesOf({ slug: { ...slug, attach: [{ slot: "field", field: "summary", collections: ["tag"] }] } })[0]?.message,
		).toMatch(/no field "summary"/);
		expect(codesOf({ "bad-key": slug })).toContain("name");
		expect(issuesOf({ x: { ...summary, prompt: "{{title}}" } })[0]?.message).toMatch(/locale inputs/);
		expect(codesOf({ x: { ...summary, engine: "decide" } })).toContain("choices");
		expect(codesOf({ x: { ...summary, checks: [{ kind: "exists" }] } })).toContain("choices");
		expect(issuesOf({ x: { ...build(aiPresets.codeFold()), attach: [{ slot: "field", field: "title" }] } })).toEqual(
			[],
		);
		expect(
			issuesOf({ x: { ...build(aiPresets.translate()), attach: [{ slot: "field", field: "title" }] } })[0]?.message,
		).toMatch(/cannot fill/);
		expect(
			issuesOf({
				x: {
					...build(aiPresets.category()),
					choices: { from: "select", collection: "post", field: "policy" },
					attach: [],
				},
			}),
		).toEqual([]);
	});

	it("every action in the example config follows the definition rules", () => {
		expect(
			checkAiConfig(
				{ actions: AI_ACTIONS, snippets: AI_SNIPPETS } as Parameters<typeof checkAiConfig>[0],
				testSite.config.collections,
			),
		).toEqual([]);
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
		const check = (action: object, blocks: readonly string[] = ["image", "mermaid"]) =>
			checkAiConfig({ actions: { a: action } } as Parameters<typeof checkAiConfig>[0], {}, blocks).map(
				(issue) => issue.message,
			);
		expect(check(edit())).toEqual([]);
		expect(check(edit(), ["image"])).toEqual([expect.stringMatching(/unknown block "mermaid"/)]);
		expect(check(edit({ result: "text" }))).toEqual([expect.stringMatching(/block slot needs an mdx result/)]);
		// The block slot only gives the block source and the title.
		expect(check(edit({ input: { code: { kind: "code" as const, label: "코드", required: true } } }))).toEqual([
			expect.stringMatching(/cannot fill/),
		]);
		expect(attachedTo({ slot: "block", block: "mermaid" }, { slot: "block", target: "mermaid" })).toBe(true);
		expect(attachedTo({ slot: "block", block: "mermaid" }, { slot: "block", target: "chart" })).toBe(false);
	});

	it("only prompt snippet names can go into instructions, and streaming is only for generate mode's text/MDX results", () => {
		const base = { actions: {} };
		const action = (patch: object) => ({
			label: "x",
			input: { body: { kind: "mdx" as const, label: "본문" } },
			prompt: "다듬는다.",
			result: "mdx" as const,
			...patch,
		});
		expect(
			checkAiConfig(
				{
					...base,
					snippets: { guide: { label: "가이드", text: "" } },
					actions: { a: action({ prompt: "{{snippet.guide}}" }) },
				},
				{},
			),
		).toEqual([]);
		expect(checkAiConfig({ ...base, actions: { a: action({ prompt: "{{snippet.nope}}" }) } }, {})[0]?.message).toMatch(
			/prompt snippets/,
		);
		expect(
			checkAiConfig({ ...base, actions: { a: action({ stream: true, result: "candidates" }) } }, {})[0]?.code,
		).toBe("stream");
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
