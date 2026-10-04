import { createActiveTranslator, defineBlock } from "@monti-cms/core";
import { keywordList } from "../shared/text.js";
import { chartMessages } from "./messages.js";
const t = createActiveTranslator(chartMessages);
/** Chart (` ```chart `). The chart syntax is read by `parseChartDsl`. The editor preview comes from the extension (a site can replace it); the public page is rendered by the site. */
export const chartBlock = defineBlock({
    name: "chart",
    get label() {
        return t("label");
    },
    get description() {
        return t("description");
    },
    syntax: { kind: "fence", lang: "chart" },
    component: "Chart",
    attributes: {},
    editor: {
        view: "node",
        insertable: true,
        get keywords() {
            return ["chart", ...keywordList(t("keywords"))];
        },
        icon: "chart-column",
        get placeholder() {
            return t("placeholder");
        },
        get insert() {
            return {
                code: [
                    "chart bar",
                    "x month",
                    `series views | ${t("insert.series")} | chart-1`,
                    "",
                    "data",
                    "month | views",
                    "Jan | 1200",
                ].join("\n"),
            };
        },
    },
});
