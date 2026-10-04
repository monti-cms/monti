import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { collapsibleMessages } from "./messages";

const t = createActiveTranslator(collapsibleMessages);

/** Collapsible (`:::collapsible{title="…"}`). An area that expands when its title is clicked. */
export const collapsibleBlock = defineBlock({
	name: "collapsible",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "container", directive: "collapsible" },
	component: "Collapsible",
	attributes: {
		title: {
			type: "string",
			get label() {
				return t("title.label");
			},
			translatable: true,
		},
		defaultOpen: {
			type: "boolean",
			get label() {
				return t("defaultOpen.label");
			},
			defaultValue: false,
		},
	},
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["collapsible", ...keywordList(t("keywords"))];
		},
		icon: "chevrons-up-down",
		get insert() {
			return { values: { title: t("insert.title") }, text: t("insert.text") };
		},
	},
});
