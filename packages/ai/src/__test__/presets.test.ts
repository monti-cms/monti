import {
	type BlockDefinition,
	type CollectionsConfig,
	defineBlock,
	defineCollection,
	definePlugin,
	fields,
	SUMMARY_ROLE,
	valueFieldsOf,
} from "@monti-cms/core";
import { BLOCKS, cmsConfig } from "@monti-cms/core/client";
import { describe, expect, it } from "vitest";
import { chart, mermaid } from "../../../blocks/src";
import { seo } from "../../../seo/src";
import type { AiActionDefinition, AiAttach } from "../action";
import { lazyTranslator } from "../i18n";
import { aiPlugin } from "../plugin";
import { aiPresets, DEFAULT_AI_ACTIONS } from "../presets";
import { presetMessages } from "../presets.messages";
import { AI_ACTIONS } from "../registry";
import { resolveAiActions } from "../resolve";

/**
 * 기본 기능(프리셋)이 붙는 곳과 켜고 끄기(M10-2). 앞 묶음은 지금 설정(블로그 예시·다른 사이트 둘 다)에서 필드를 찾아
 * 확인하고, 뒤 묶음은 테스트 안에서 만든 작은 설정으로 확인한다.
 */

const presetText = lazyTranslator(presetMessages);

type FieldAttach = Extract<AiAttach, { slot: "field" }>;
const fieldAttaches = (definition: AiActionDefinition | undefined): FieldAttach[] =>
	(definition?.attach ?? []).filter((attach): attach is FieldAttach => attach.slot === "field");
/** 기능이 붙는 (컬렉션, 필드) 쌍. */
const pairs = (definition: AiActionDefinition | undefined) =>
	fieldAttaches(definition)
		.flatMap((attach) => (attach.collections ?? []).map((collection) => `${collection}.${attach.field}`))
		.sort();

const collections = cmsConfig.collections as CollectionsConfig;
const bodyCollections = Object.entries(collections).filter(([, schema]) => schema.body);
const isRecord = (name: string) => collections[name]?.kind === "item";

describe("지금 설정: 기본 필드 기능은 필드 종류·역할·관계 대상으로 붙는다", () => {
	it("주소 추천은 본문이 있는 컬렉션의 주소 필드(`fields.slug`)에 붙는다", () => {
		const expected = bodyCollections.flatMap(([name, schema]) =>
			Object.entries(schema.fields)
				.filter(([, field]) => field.kind === "slug")
				.map(([field]) => `${name}.${field}`),
		);
		expect(expected.length).toBeGreaterThan(0);
		expect(pairs(AI_ACTIONS.slug)).toEqual(expected.sort());
	});

	it("요약 만들기는 요약 역할 필드에 붙고, 글자 수는 필드 `max`(없으면 160)다", () => {
		const targets = bodyCollections.flatMap(([name, schema]) =>
			valueFieldsOf(schema)
				.filter(({ field }) => field.role === SUMMARY_ROLE)
				.map(({ name: field, field: definition }) => ({ pair: `${name}.${field}`, definition })),
		);
		expect(targets.length).toBeGreaterThan(0);
		const summary = AI_ACTIONS.summary;
		// 다른 사이트 설정은 요약 기능을 옵션으로 바꿨다(`maxLength: 200`).
		if (summary?.prompt.includes("at most 200 characters")) return;
		expect(pairs(summary)).toEqual(targets.map(({ pair }) => pair).sort());
		const max = targets[0]?.definition.kind === "text" ? (targets[0].definition.max ?? 160) : 160;
		expect(summary?.checks).toContainEqual({ kind: "maxLength", max });
	});

	it("태그·카테고리 추천은 분류(record) 컬렉션을 가리키는 여러 개·하나 관계 필드에 붙고, 선택지는 그 대상이다", () => {
		for (const [key, many] of [
			["tags", true],
			["category", false],
		] as const) {
			const definition = AI_ACTIONS[key];
			const relations = bodyCollections.flatMap(([name, schema]) =>
				valueFieldsOf(schema).flatMap(({ name: field, field: definition }) =>
					definition.kind === "relation" && Boolean(definition.many) === many && isRecord(definition.to)
						? [{ pair: `${name}.${field}`, to: definition.to }]
						: [],
				),
			);
			if (relations.length === 0) {
				expect(definition).toBeUndefined();
				continue;
			}
			const to = relations[0]?.to;
			expect(definition?.choices).toEqual({ from: "collection", collection: to });
			expect(definition?.pick).toBe(many ? "many" : "one");
			expect(pairs(definition)).toEqual(
				relations
					.filter((relation) => relation.to === to)
					.map(({ pair }) => pair)
					.sort(),
			);
		}
	});

	it("블록·SEO 확장의 AI 기능은 설정에 적지 않아도 붙는다", () => {
		const blocks = BLOCKS.map((block) => block.name);
		if (blocks.includes("chart")) {
			expect(AI_ACTIONS.chartDraft?.attach).toEqual([{ slot: "insert" }]);
			expect(AI_ACTIONS.chartEdit?.attach).toEqual([{ slot: "block", block: "chart" }]);
		}
		expect(AI_ACTIONS.diagramDraft !== undefined).toBe(blocks.includes("mermaid"));
		const seoTitle = Object.entries(collections).flatMap(([name, schema]) =>
			valueFieldsOf(schema)
				.filter(({ field }) => field.role === "seoTitle")
				.map(({ name: field }) => `${name}.${field}`),
		);
		expect(pairs(AI_ACTIONS.seoTitle)).toEqual(seoTitle.sort());
	});

	it("필드 옆 기능이 앞에 온다(관리자 AI 화면 순서)", () => {
		const keys = Object.keys(AI_ACTIONS);
		const firstOther = keys.findIndex((key) => fieldAttaches(AI_ACTIONS[key]).length === 0);
		expect(keys.slice(firstOther).every((key) => fieldAttaches(AI_ACTIONS[key]).length === 0)).toBe(true);
	});
});

describe("기본 기능 켜기·끄기·바꾸기(`resolveAiActions`)", () => {
	const title = fields.text({ label: "제목", max: 100 });
	const note = defineCollection({
		label: "노트",
		kind: "document",
		fields: {
			title,
			slug: fields.slug({ label: "주소", from: "title" }),
			lead: fields.text({ label: "머리말", role: "summary", max: 90 }),
			labelIds: fields.relation({ label: "라벨", to: "label", many: true }),
			shelfId: fields.relation({ label: "책장", to: "shelf" }),
			relatedId: fields.relation({ label: "관련 노트", to: "note" }),
		},
		list: { columns: [] },
	});
	const label = defineCollection({
		label: "라벨",
		kind: "item",
		fields: { title, slug: fields.slug({ label: "주소" }) },
		list: { columns: [] },
	});
	const shelf = defineCollection({ label: "책장", kind: "item", fields: { title }, list: { columns: [] } });
	const callout = defineBlock({
		name: "aside-box",
		label: "곁상자",
		syntax: { kind: "container", directive: "aside-box" },
		component: "AsideBox",
		attributes: { heading: { type: "string", label: "제목", translatable: true } },
		editor: { view: "node" },
	});
	const site = {
		collections: { note, label, shelf } as CollectionsConfig,
		blocks: [...BLOCKS.filter((block) => !block.parent && block.name === "image"), callout] as BlockDefinition[],
		locales: [{ code: "ko" }, { code: "en" }],
	};

	it("기능을 적지 않으면 붙을 곳이 있는 기본 기능이 모두 켜진다", () => {
		const actions = resolveAiActions({}, site);
		expect(Object.keys(actions)).toEqual(Object.keys(DEFAULT_AI_ACTIONS));
		expect(pairs(actions.slug)).toEqual(["note.slug"]);
		expect(pairs(actions.summary)).toEqual(["note.lead"]);
		expect(actions.summary?.checks).toEqual([{ kind: "maxLength", max: 90 }]);
		expect(actions.summary?.prompt).toContain("at most 90 characters");
		expect(pairs(actions.tags)).toEqual(["note.labelIds"]);
		expect(actions.tags).toMatchObject({
			label: presetText("label.suggest", { name: "라벨" }),
			choices: { from: "collection", collection: "label" },
		});
		expect(pairs(actions.category)).toEqual(["note.shelfId"]);
		expect(actions.category).toMatchObject({ pick: "one", choices: { from: "collection", collection: "shelf" } });
		expect(actions.category?.prompt).toBe("Choose the one that this content belongs to.");
		// 기본 지시문은 영어이고 사이트 종류나 고정 언어를 정하지 않는다(말투·표기는 공통 문구 `styleGuide`가 맡는다).
		for (const [key, definition] of Object.entries(actions)) {
			expect(definition.prompt).not.toMatch(/blog|React Query|Korean/i);
			// 번역의 번역할 속성 목록만 사이트의 블록 이름표가 들어간다.
			if (key !== "translate") expect(definition.prompt).toMatch(/^[\x20-\x7E\n]*$/);
		}
	});

	it("번역 지시문의 번역할 속성은 블록 정의에서 만든다. 언어가 하나면 번역 기능은 없다", () => {
		const translate = resolveAiActions({}, site).translate;
		expect(translate?.prompt).toContain("곁상자(heading)");
		expect(translate?.prompt).toContain(`${BLOCKS.find((block) => block.name === "image")?.label}(alt·caption·title)`);
		expect(translate?.prompt).not.toContain("콜아웃");
		expect(resolveAiActions({}, { ...site, locales: [{ code: "ko" }] }).translate).toBeUndefined();
	});

	it("붙을 곳이 없는 기능은 켜지지 않는다(본문 없는 사이트)", () => {
		const records = resolveAiActions({}, { ...site, collections: { label, shelf } as CollectionsConfig });
		expect(Object.keys(records)).toEqual(["imageAlt", "imageCaption", "mediaFilename", "translate", "codeFold"]);
	});

	it("`false`는 끄고, 정의·프리셋을 주면 그 자리에서 바꾸고, 새 이름은 더한다", () => {
		const custom = { ...aiPresets.codeFold(), label: "내 기능" };
		const actions = resolveAiActions(
			{ actions: { draft: false, summary: aiPresets.summary({ maxLength: 50 }), mine: custom } },
			site,
		);
		expect(actions.draft).toBeUndefined();
		expect(actions.summary?.checks).toEqual([{ kind: "maxLength", max: 50 }]);
		expect(Object.keys(actions).indexOf("summary")).toBe(1);
		expect(actions.mine?.label).toBe("내 기능");
		expect(() => resolveAiActions({ actions: { nope: false } }, site)).toThrow(/does not exist/);
	});

	it("공통 문구 `styleGuide`가 있을 때만 글을 쓰는 기능의 지시문에 넣는다", () => {
		const writing = ["slug", "summary", "imageAlt", "imageCaption", "mediaFilename", "translate", "polish", "draft"];
		const without = resolveAiActions({}, site);
		for (const key of writing) expect(without[key]?.prompt).not.toContain("{{shared.");
		const shared = { styleGuide: { label: "Style guide", text: "" } };
		const withGuide = resolveAiActions({ shared }, site);
		for (const key of writing) expect(withGuide[key]?.prompt).toContain("{{shared.styleGuide}}");
		// 고르는 기능(태그·분류)과 정규식 기능에는 문체가 없다.
		for (const key of ["tags", "category", "codeFold"]) expect(withGuide[key]?.prompt).not.toContain("{{shared.");
	});

	it("필드 이름을 주면 그 필드에, 선택지를 주면 그 컬렉션을 가리키는 필드에 붙는다", () => {
		const actions = resolveAiActions(
			{
				actions: { summary: aiPresets.summary({ field: "title" }), category: aiPresets.category({ field: "shelfId" }) },
			},
			site,
		);
		expect(pairs(actions.summary)).toEqual(["note.title"]);
		expect(actions.summary?.checks).toEqual([{ kind: "maxLength", max: 100 }]);
		expect(pairs(actions.category)).toEqual(["note.shelfId"]);
	});
});

describe("다른 플러그인이 더하는 AI 기능(`contributes.ai.actions`)", () => {
	const blocksOf = (plugins: readonly { blocks?: readonly BlockDefinition[] }[]) => [
		...BLOCKS.filter((block) => block.name === "image"),
		...plugins.flatMap((plugin) => plugin.blocks ?? []),
	];
	const blogSite = (plugins: readonly { blocks?: readonly BlockDefinition[] }[]) => ({
		collections,
		blocks: blocksOf(plugins),
		locales: cmsConfig.locales,
	});

	it("블록 확장을 넣으면 그 블록의 AI 기능이 붙고, 빼면 없다", () => {
		const plugins = [mermaid(), chart()];
		const actions = resolveAiActions({}, blogSite(plugins), plugins);
		expect(Object.keys(actions)).toEqual(
			expect.arrayContaining(["diagramDraft", "diagramEdit", "chartDraft", "chartEdit"]),
		);
		const none = resolveAiActions({}, blogSite([]), []);
		expect(none.diagramDraft).toBeUndefined();
		expect(none.chartEdit).toBeUndefined();
	});

	it("SEO 확장은 검색 제목·설명 추천을 더한다. `false`로 끄거나 `seo({ ai: false })`로 더하지 않는다", () => {
		const withSeo = resolveAiActions({}, blogSite([]), [seo()]);
		const titled = Object.values(collections).some((schema) =>
			valueFieldsOf(schema).some(({ field }) => field.role === "seoTitle"),
		);
		expect(withSeo.seoTitle !== undefined).toBe(titled);
		expect(resolveAiActions({ actions: { seoTitle: false } }, blogSite([]), [seo()]).seoTitle).toBeUndefined();
		expect(resolveAiActions({}, blogSite([]), [seo({ ai: false })]).seoTitle).toBeUndefined();
	});

	it("이미 있는 이름을 더하면 설정 오류다(플러그인 검사에서도)", () => {
		const clash = definePlugin({
			name: "clash",
			options: {},
			contributes: { ai: { actions: { summary: aiPresets.codeFold() } } },
		});
		expect(() => resolveAiActions({}, blogSite([]), [clash])).toThrow(/plugins.clash adds AI action "summary"/);
		const plugin = aiPlugin();
		expect(() =>
			plugin.validate?.({
				collections,
				locales: cmsConfig.locales,
				defaultLocale: cmsConfig.defaultLocale,
				blocks: BLOCKS.map((block) => block.name),
				blockDefinitions: BLOCKS,
				plugins: [clash, plugin],
			}),
		).toThrow(/already defined/);
	});
});
