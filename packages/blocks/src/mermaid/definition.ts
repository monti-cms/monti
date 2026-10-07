import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text";
import { mermaidMessages } from "./messages";
import { validateMermaidBlock } from "./validate";

const t = createActiveTranslator(mermaidMessages);

/** Mermaid diagram (` ```mermaid `). The extension draws the editor preview (a site can replace it), and the site draws the public page. */
export const mermaidBlock = defineBlock({
	name: "mermaid",
	get label() {
		return t("label");
	},
	get description() {
		return t("description");
	},
	syntax: { kind: "fence", lang: "mermaid" },
	component: "Mermaid",
	attributes: {},
	validate: validateMermaidBlock,
	editor: {
		view: "node",
		insertable: true,
		get keywords() {
			return ["mermaid", ...keywordList(t("keywords"))];
		},
		icon: "workflow",
		get placeholder() {
			return t("placeholder");
		},
		insert: { code: "graph TD\n  A --> B" },
	},
});
