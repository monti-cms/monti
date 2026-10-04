import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { tabsMessages } from "./messages";

const t = createActiveTranslator(tabsMessages);

/** 탭 묶음(`::::tabs` 안에 `:::tab{label="…"}` 2~8개). */
export const tabsBlock = defineBlock({
	name: "tabs",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "container", directive: "tabs" },
	component: "Tabs",
	attributes: {
		defaultValue: {
			type: "string",
			get label() {
				return t("defaultValue.label");
			},
			get description() {
				return t("defaultValue.description");
			},
			childValue: "label",
		},
	},
	children: { blocks: ["tab"], min: 2, max: 8 },
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["tabs", ...keywordList(t("keywords"))];
		},
		icon: "square-stack",
		get insert() {
			return {
				children: [
					{ values: { label: t("insert.first") }, text: t("insert.text") },
					{ values: { label: t("insert.second") }, text: t("insert.text") },
				],
			};
		},
	},
});

export const tabBlock = defineBlock({
	name: "tab",
	get label() {
		return t("tab.label");
	},
	syntax: { kind: "container", directive: "tab" },
	component: "Tab",
	attributes: {
		label: {
			type: "string",
			get label() {
				return t("tab.name.label");
			},
			required: true,
			translatable: true,
		},
	},
	parent: "tabs",
	translateInside: true,
	editor: { view: "node" },
});
