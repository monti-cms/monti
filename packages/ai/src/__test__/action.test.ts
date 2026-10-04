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
import { AI_ACTIONS, attachedTo } from "../registry";

const presetText = lazyTranslator(presetMessages);

/** 두 타입이 같은가(타입 검사용). */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** 프리셋(만드는 함수)을 예시 설정으로 만든다. 붙을 곳이 없으면 테스트 실패다. */
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

describe("AI 기능 정의", () => {
	it("정의에 고친 값을 얹는다. 검사는 정의의 종류·순서를 지키고 켜기·값만 바뀐다", () => {
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
		// 필수 입력은 끌 수 없다.
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

	it("예전에 정해진 검사였던 중복 없음·정규식 실행·구조 유지의 고친 값은 같은 코드 검사의 켜기로 읽는다", () => {
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

	it("코드 검사 이름은 소문자 하이픈이고 한 기능에 한 번만 쓴다", () => {
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

	it("관리자 화면에서 더한 검사(형식·길이·선택지 안)는 정의의 검사 뒤에 붙고, 정의의 검사는 빼지 못한다", () => {
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
		// 더한 검사는 고친 값으로 저장되고, 다시 읽어도 같다.
		const override = overrideFrom(definition, { checks: action.checks });
		expect(resolveAction("seoTitle", definition, override).checks).toEqual(action.checks);
	});

	it("저장할 고친 값은 기본값과 다른 것만 남긴다", () => {
		const summary = build(aiPresets.summary());
		const base = resolveAction("summary", summary);
		expect(overrideFrom(summary, { ...base })).toEqual({});
		expect(overrideFrom(summary, { ...base, enabled: false, modelName: "m" })).toEqual({
			enabled: false,
			modelName: "m",
		});
	});

	it("지시문에는 언어 입력만 {{이름}}으로 넣고, 쓰지 않은 언어 입력은 줄로 붙인다", () => {
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

	it("설정 확인: 선택지·붙을 곳·검사가 정의와 맞지 않으면 알린다", () => {
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

	it("예시 설정의 모든 기능이 정의 규칙에 맞는다", () => {
		expect(Object.keys(AI_ACTIONS)).toEqual([
			"slug",
			"summary",
			"tags",
			"category",
			"seoTitle",
			"seoDescription",
			"imageAlt",
			"imageCaption",
			"mediaFilename",
			"translate",
			"codeFold",
			"polish",
			"draft",
			"diagramDraft",
			"diagramEdit",
			"chartDraft",
			"chartEdit",
		]);
	});

	it("블록 자리: 사이트가 쓰는 블록에만 붙고, 결과는 MDX다", () => {
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
		// 블록 자리는 블록 원문과 제목만 준다.
		expect(check(edit({ input: { code: { kind: "code" as const, label: "코드", required: true } } }))).toThrow(
			/cannot fill/,
		);
		expect(attachedTo({ slot: "block", block: "mermaid" }, { slot: "block", target: "mermaid" })).toBe(true);
		expect(attachedTo({ slot: "block", block: "mermaid" }, { slot: "block", target: "chart" })).toBe(false);
	});

	it("공통 문구 이름만 지시문에 넣을 수 있고, 흘려받기는 생성 방식의 글·MDX 결과만이다", () => {
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

	it("예전 기능 표의 저장 값을 고친 값으로 옮긴다(예전 검사 모양·없는 입력·없는 기능 포함)", () => {
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

	it("타입: 지시문 자리 표시·붙을 곳·입력·결과를 정의에서 확인한다", () => {
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
			// @ts-expect-error 지시문에는 언어 입력만 넣을 수 있다
			prompt: "{{title}}을 쓴다",
		});
		aiAction({
			label: "x",
			input: { instruction: aiInput.text({ label: "요청", required: true }) },
			result: "mdx",
			prompt: "초안을 쓴다",
			// @ts-expect-error 필드 옆 자리는 필수 입력 `instruction`을 채울 수 없다
			attach: [{ slot: "field", field: "body" }],
		});
	});
});
