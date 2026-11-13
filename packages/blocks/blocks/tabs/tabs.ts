import { defineBlock, z } from "@monti-cms/core";
import { Tab, Tabs } from "./site";

/** Tabs (`::::tabs` holding `:::tab{label="npm"}`): the same thing said a few ways, one shown at a time (doc 18). */
export const tabs = defineBlock({
	type: "tabs",
	label: { ko: "탭", en: "Tabs" },
	description:
		"Tabs: the same thing for a few cases (npm, pnpm, yarn; macOS, Windows), one shown at a time. Its children are tab blocks, two to eight; `defaultValue` is the label of the tab shown first (the first when left out).",
	menu: "insert",
	attrs: z.object({ defaultValue: z.string().optional() }),
	fields: { defaultValue: { label: { ko: "처음 보일 탭", en: "Tab shown first" }, input: "own" } },
	holds: "blocks",
	children: ["tab"],
	check: (block) =>
		(block.children ?? []).some((tab) => typeof tab.attrs?.label !== "string" || tab.attrs.label.trim() === "")
			? [{ level: "warn", message: { ko: "이름 없는 탭", en: "A tab with no name" } }]
			: [],
	Site: Tabs,
});

/** One tab of `tabs`: its name and its blocks. */
export const tab = defineBlock({
	type: "tab",
	label: { ko: "탭 하나", en: "Tab" },
	description: "One tab of a tabs block: its `label` and the blocks it shows.",
	attrs: z.object({ label: z.string() }),
	fields: { label: { label: { ko: "탭 이름", en: "Tab name" }, input: "text" } },
	holds: "blocks",
	translate: { attrs: ["label"] },
	Site: Tab,
});
