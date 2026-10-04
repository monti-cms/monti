import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { codeRefMessages } from "./messages";

const t = createActiveTranslator(codeRefMessages);

/**
 * Code ref (`:code-ref[text]{to="c1"}`). Links body text to a line of a code block in the same post. `to` is a code block line anchor
 * (code fence comment `// @line anchor {2-4} id="c1"`, a core code block feature). On the public page, hovering or pressing the text
 * highlights that line (the site's `CodeRef` component).
 *
 * `to` carries `codeAnchor`, so the admin editor's code block uses this mark for line picking, link guidance, and hover line highlighting.
 */
export const codeRefBlock = defineBlock({
	name: "code-ref",
	get label() {
		return t("label");
	},
	syntax: { kind: "text", directive: "code-ref" },
	component: "CodeRef",
	attributes: {
		to: {
			type: "string",
			get label() {
				return t("to.label");
			},
			required: true,
			codeAnchor: true,
		},
	},
	editor: { view: "mark" },
});
