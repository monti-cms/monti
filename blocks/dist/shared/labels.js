import { translate } from "@monti-cms/core";
import { chartErrorLine } from "../chart/errors.js";
import { chartMessages } from "../chart/messages.js";
import { publicLabelMessages } from "./labels.messages.js";
/** The leading part of a language code (`ko`, `ko-KR`, `en`, …). For an unknown language, the dictionary falls back to English. */
const languageOf = (locale) => (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";
/** Text for a language code (`ko`, `ko-KR`, `en`, …). An unknown language gets English. */
export function blockLabels(locale) {
    const language = languageOf(locale);
    const text = (key) => translate(publicLabelMessages, language, key);
    const chart = (key, vars) => translate(chartMessages, language, key, vars);
    return {
        calloutNote: text("calloutNote"),
        calloutTip: text("calloutTip"),
        calloutInfo: text("calloutInfo"),
        calloutWarning: text("calloutWarning"),
        calloutDanger: text("calloutDanger"),
        collapsibleFallback: text("collapsibleFallback"),
        codeExplorerFiles: text("codeExplorerFiles"),
        codeExplorerToggle: text("codeExplorerToggle"),
        chartError: chart("error.title"),
        chartErrorLine: (error) => chartErrorLine(error, chart),
    };
}
