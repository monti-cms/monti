import { ListBoxes } from "@monti-cms/admin/icons";
import { defineBlock, z } from "@monti-cms/core";
import { lazy } from "react";
import { Tab, Tabs } from "./site";
import { words } from "./words";

/** Tabs (`::::tabs` holding `:::tab{label="npm"}`): the same thing said a few ways, one shown at a time (doc 18). */
export const tabs = defineBlock({
	type: "tabs",
	label: words.tabs,
	description:
		"Tabs: the same thing for a few cases (npm, pnpm, yarn; macOS, Windows), one shown at a time. Its children are tab blocks, two to eight; `defaultValue` is the label of the tab shown first (the first when left out).",
	menu: "insert",
	attrs: z.object({ defaultValue: z.string().optional() }),
	fields: { defaultValue: { label: words.first } },
	holds: "blocks",
	children: ["tab"],
	check: (block) =>
		(block.children ?? []).some((tab) => typeof tab.attrs?.label !== "string" || tab.attrs.label.trim() === "")
			? [{ level: "warn", message: words.aTabWithNo }]
			: [],
	Site: Tabs,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor")),
	Icon: ListBoxes,
	starter: (language) => ({
		children: [
			{ type: "tab", attrs: { label: words.firstTab[language] }, children: [{ type: "paragraph" }] },
			{ type: "tab", attrs: { label: words.secondTab[language] }, children: [{ type: "paragraph" }] },
		],
	}),
});

/** One tab of `tabs`: its name and its blocks. */
export const tab = defineBlock({
	type: "tab",
	label: words.tab,
	description: "One tab of a tabs block: its `label` and the blocks it shows.",
	attrs: z.object({ label: z.string() }),
	fields: { label: { label: words.name } },
	holds: "blocks",
	translate: { attrs: ["label"] },
	Site: Tab,
	// The editor's view (its own tool row and settings), loaded in the admin the first time it is drawn.
	Editor: lazy(() => import("./editor").then((module) => ({ default: module.TabEditor }))),
});
