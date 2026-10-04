import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { tooltipMessages } from "./messages.js";
const t = createActiveTranslator(tooltipMessages);
/**
 * Tooltip (`:tooltip[text]{content="description"}`). Hovering the text shows the description. On the public page the site draws it with a `Tooltip`
 * component (`content` attribute, the text is the child).
 */
export const tooltipBlock = defineBlock({
    name: "tooltip",
    get label() {
        return t("label");
    },
    syntax: { kind: "text", directive: "tooltip" },
    component: "Tooltip",
    attributes: {
        content: {
            type: "string",
            get label() {
                return t("content.label");
            },
            required: true,
            translatable: true,
        },
    },
    editor: { view: "mark" },
});
