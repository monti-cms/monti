import { translate } from "@monti-cms/core";
import { type ChartText, chartErrorLine } from "../chart/errors";
import { chartMessages } from "../chart/messages";
import type { ChartRenderError } from "../chart/types";
import { publicLabelMessages } from "./labels.messages";

/** Fixed text that public page blocks show to readers. Chosen to match the site language (`context.locale`). */
export interface BlockLabels {
	readonly calloutNote: string;
	readonly calloutTip: string;
	readonly calloutInfo: string;
	readonly calloutWarning: string;
	readonly calloutDanger: string;
	/** Title of a collapsible block with no title. */
	readonly collapsibleFallback: string;
	/** Accessible name of the code explorer's file tree. */
	readonly codeExplorerFiles: string;
	/** Hint of the button that opens and closes the code explorer's file list on a narrow screen. */
	readonly codeExplorerToggle: string;
	readonly chartError: string;
	/** One chart syntax error line (`line 3: …`). The error text is built in this language from the code and values. */
	readonly chartErrorLine: (error: ChartRenderError) => string;
}

/** The leading part of a language code (`ko`, `ko-KR`, `en`, …). For an unknown language, the dictionary falls back to English. */
const languageOf = (locale?: string): string => (locale ?? "").toLowerCase().split(/[-_]/)[0] ?? "";

/** Text for a language code (`ko`, `ko-KR`, `en`, …). An unknown language gets English. */
export function blockLabels(locale?: string): BlockLabels {
	const language = languageOf(locale);
	const text = (key: keyof (typeof publicLabelMessages)["messages"]["en"]) =>
		translate(publicLabelMessages, language, key);
	const chart: ChartText = (key, vars) => translate(chartMessages, language, key, vars);
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
