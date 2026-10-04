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
 * Where default actions (presets) attach, and turning them on/off. The first group finds fields in the current config (both the reference blog example and the other site) and
 * checks them; the second group checks with a small config built inside the test.
 */

const presetText = lazyTranslator(presetMessages);

type FieldAttach = Extract<AiAttach, { slot: "field" }>;
const fieldAttaches = (definition: AiActionDefinition | undefined): FieldAttach[] =>
	(definition?.attach ?? []).filter((attach): attach is FieldAttach => attach.slot === "field");
/** (collection, field) pairs an action attaches to. */
const pairs = (definition: AiActionDefinition | undefined) =>
	fieldAttaches(definition)
		.flatMap((attach) => (attach.collections ?? []).map((collection) => `${collection}.${attach.field}`))
		.sort();

const collections = cmsConfig.collections as CollectionsConfig;
const bodyCollections = Object.entries(collections).filter(([, schema]) => schema.body);
const isRecord = (name: string) => collections[name]?.kind === "item";

describe("current config: default field actions attach by field kind, role, and relation target", () => {
	it("slug suggestion attaches to the slug field (`fields.slug`) of collections that have a body", () => {
		const expected = bodyCollections.flatMap(([name, schema]) =>
			Object.entries(schema.fields)
				.filter(([, field]) => field.kind === "slug")
				.map(([field]) => `${name}.${field}`),
		);
		expect(expected.length).toBeGreaterThan(0);
		expect(pairs(AI_ACTIONS.slug)).toEqual(expected.sort());
	});

	it("summary generation attaches to the summary-role field, and the character count is the field's `max` (160 if absent)", () => {
		const targets = bodyCollections.flatMap(([name, schema]) =>
			valueFieldsOf(schema)
				.filter(({ field }) => field.role === SUMMARY_ROLE)
				.map(({ name: field, field: definition }) => ({ pair: `${name}.${field}`, definition })),
		);
		expect(targets.length).toBeGreaterThan(0);
		const summary = AI_ACTIONS.summary;
		// The other site's config changed the summary action into an option (`maxLength: 200`).
		if (summary?.prompt.includes("at most 200 characters")) return;
		expect(pairs(summary)).toEqual(targets.map(({ pair }) => pair).sort());
		const max = targets[0]?.definition.kind === "text" ? (targets[0].definition.max ?? 160) : 160;
		expect(summary?.checks).toContainEqual({ kind: "maxLength", max });
	});

	it("tag/category suggestion attaches to many/one relation fields pointing to a classification (record) collection, and the options are that target", () => {
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

	it("block and SEO extension AI actions attach even when not listed in the config", () => {
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

	it("field-side actions come first (admin AI screen order)", () => {
		const keys = Object.keys(AI_ACTIONS);
		const firstOther = keys.findIndex((key) => fieldAttaches(AI_ACTIONS[key]).length === 0);
		expect(keys.slice(firstOther).every((key) => fieldAttaches(AI_ACTIONS[key]).length === 0)).toBe(true);
	});
});

describe("turning default actions on, off, and changing them (`resolveAiActions`)", () => {
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

	it("with no actions listed, all default actions that have somewhere to attach are on", () => {
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
		// Default instructions are in English and fix neither the site kind nor a language (tone and notation are handled by the shared text `styleGuide`).
		for (const [key, definition] of Object.entries(actions)) {
			expect(definition.prompt).not.toMatch(/blog|React Query|Korean/i);
			// Only the translatable attribute list of translation gets the site's block labels.
			if (key !== "translate") expect(definition.prompt).toMatch(/^[\x20-\x7E\n]*$/);
		}
	});

	it("the translation instruction's translatable attributes are built from the block definitions. With one language there is no translation action", () => {
		const translate = resolveAiActions({}, site).translate;
		expect(translate?.prompt).toContain("곁상자(heading)");
		expect(translate?.prompt).toContain(`${BLOCKS.find((block) => block.name === "image")?.label}(alt·caption·title)`);
		expect(translate?.prompt).not.toContain("콜아웃");
		expect(resolveAiActions({}, { ...site, locales: [{ code: "ko" }] }).translate).toBeUndefined();
	});

	it("an action with nowhere to attach is not turned on (a site without a body)", () => {
		const records = resolveAiActions({}, { ...site, collections: { label, shelf } as CollectionsConfig });
		expect(Object.keys(records)).toEqual(["imageAlt", "imageCaption", "mediaFilename", "translate", "codeFold"]);
	});

	it("`false` turns off, a definition/preset replaces in place, and a new name is added", () => {
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

	it("the shared text `styleGuide` goes into the instructions of writing actions only when it exists", () => {
		const writing = ["slug", "summary", "imageAlt", "imageCaption", "mediaFilename", "translate", "polish", "draft"];
		const without = resolveAiActions({}, site);
		for (const key of writing) expect(without[key]?.prompt).not.toContain("{{shared.");
		const shared = { styleGuide: { label: "Style guide", text: "" } };
		const withGuide = resolveAiActions({ shared }, site);
		for (const key of writing) expect(withGuide[key]?.prompt).toContain("{{shared.styleGuide}}");
		// Choosing actions (tags/categories) and regex actions have no writing style.
		for (const key of ["tags", "category", "codeFold"]) expect(withGuide[key]?.prompt).not.toContain("{{shared.");
	});

	it("a field name attaches to that field, and options attach to fields pointing to that collection", () => {
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

describe("AI actions contributed by other plugins (`contributes.ai.actions`)", () => {
	const blocksOf = (plugins: readonly { blocks?: readonly BlockDefinition[] }[]) => [
		...BLOCKS.filter((block) => block.name === "image"),
		...plugins.flatMap((plugin) => plugin.blocks ?? []),
	];
	const blogSite = (plugins: readonly { blocks?: readonly BlockDefinition[] }[]) => ({
		collections,
		blocks: blocksOf(plugins),
		locales: cmsConfig.locales,
	});

	it("adding a block extension attaches its block AI actions, and removing it removes them", () => {
		const plugins = [mermaid(), chart()];
		const actions = resolveAiActions({}, blogSite(plugins), plugins);
		expect(Object.keys(actions)).toEqual(
			expect.arrayContaining(["diagramDraft", "diagramEdit", "chartDraft", "chartEdit"]),
		);
		const none = resolveAiActions({}, blogSite([]), []);
		expect(none.diagramDraft).toBeUndefined();
		expect(none.chartEdit).toBeUndefined();
	});

	it("the SEO extension adds search title/description suggestions. Turn off with `false` or don't add with `seo({ ai: false })`", () => {
		const withSeo = resolveAiActions({}, blogSite([]), [seo()]);
		const titled = Object.values(collections).some((schema) =>
			valueFieldsOf(schema).some(({ field }) => field.role === "seoTitle"),
		);
		expect(withSeo.seoTitle !== undefined).toBe(titled);
		expect(resolveAiActions({ actions: { seoTitle: false } }, blogSite([]), [seo()]).seoTitle).toBeUndefined();
		expect(resolveAiActions({}, blogSite([]), [seo({ ai: false })]).seoTitle).toBeUndefined();
	});

	it("adding an existing name is a config error (also in the plugin check)", () => {
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
