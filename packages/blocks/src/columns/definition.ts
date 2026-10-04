import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { columnsMessages } from "./messages";

const t = createActiveTranslator(columnsMessages);

/** 단 나누기(`::::columns{widths="60,40"}` 안에 `:::column` 2~4개). */
export const columnsBlock = defineBlock({
	name: "columns",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "container", directive: "columns" },
	component: "Columns",
	attributes: {
		widths: {
			type: "string",
			get label() {
				return t("widths.label");
			},
			get description() {
				return t("widths.description");
			},
		},
	},
	children: { blocks: ["column"], min: 2, max: 4 },
	translateInside: true,
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["columns", ...keywordList(t("keywords"))];
		},
		icon: "columns-2",
		get insert() {
			return { children: [{ text: t("insert.text") }, { text: t("insert.text") }] };
		},
	},
});

export const columnBlock = defineBlock({
	name: "column",
	get label() {
		return t("column.label");
	},
	syntax: { kind: "container", directive: "column" },
	component: "Column",
	attributes: {},
	parent: "columns",
	translateInside: true,
	editor: { view: "node" },
});
