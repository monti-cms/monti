import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text.js";
import { calloutMessages } from "./messages.js";
// Labels are resolved when the text is read (the UI language is not yet known when the config file imports this module).
const t = createActiveTranslator(calloutMessages);
/** Callout (`:::callout{variant="tip" title="…"}`). A box that highlights content such as notes and warnings. */
export const calloutBlock = defineBlock({
    name: "callout",
    get label() {
        return t("label");
    },
    get description() {
        return t("description");
    },
    syntax: { kind: "container", directive: "callout" },
    component: "Callout",
    attributes: {
        variant: {
            type: "string",
            get label() {
                return t("variant.label");
            },
            options: {
                get note() {
                    return t("option.note");
                },
                get tip() {
                    return t("option.tip");
                },
                get info() {
                    return t("option.info");
                },
                get warning() {
                    return t("option.warning");
                },
                get danger() {
                    return t("option.danger");
                },
            },
            defaultValue: "note",
        },
        title: {
            type: "string",
            get label() {
                return t("title.label");
            },
            translatable: true,
        },
    },
    // A callout with only a title is also allowed.
    children: { min: 0 },
    translateInside: true,
    editor: {
        view: "node",
        insertable: true,
        get keywords() {
            return ["callout", ...keywordList(t("keywords"))];
        },
        icon: "message-square-warning",
        get insert() {
            return { values: { variant: "info" }, text: t("insert.text") };
        },
    },
});
