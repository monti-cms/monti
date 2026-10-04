import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { colorMessages } from "./messages.js";
const t = createActiveTranslator(colorMessages);
/**
 * Text color and text background color (`:color[text]{fg="#dc2626" fgDark="#f87171"}`). Stores hex values as light/dark theme pairs.
 * The picker list and value checks live in `./colors`. On the public page the site draws it with a `Color` component (`textColorProps`).
 */
export const colorBlock = defineBlock({
    name: "color",
    get label() {
        return t("label");
    },
    syntax: { kind: "text", directive: "color" },
    component: "Color",
    attributes: {
        fg: {
            type: "string",
            get label() {
                return t("fg.label");
            },
        },
        fgDark: {
            type: "string",
            get label() {
                return t("fgDark.label");
            },
        },
        bg: {
            type: "string",
            get label() {
                return t("bg.label");
            },
        },
        bgDark: {
            type: "string",
            get label() {
                return t("bgDark.label");
            },
        },
    },
    editor: { view: "mark" },
});
