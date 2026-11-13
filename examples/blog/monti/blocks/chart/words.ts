import type { ChartDslErrorCode, ChartDslParseError } from "./types";

/**
 * The chart's words (doc 18): the old block's, in each admin language for the editor and the publish to-do list. The site's own words for readers
 * are in `site.tsx`. Change them here.
 */
export const words = {
	label: { ko: "차트", en: "Chart" },
	source: { ko: "소스", en: "Source" },
	empty: { ko: "차트 입력", en: "Enter a chart" },
	placeholder: { ko: "chart bar로 시작하는 차트 글", en: "Chart text, starting with chart bar" },
	errorTitle: { ko: "차트 문법 오류", en: "Chart syntax error" },
	sampleSeries: { ko: "조회수", en: "Views" },
};

const ERRORS: Record<"ko" | "en", Record<ChartDslErrorCode, string>> = {
	en: {
		y_range_format: "The y-range line must be in the form y-range <min> <max>.",
		y_range_number: "y-range values must be numbers.",
		y_range_order: "y-range requires min < max.",
		first_line: "The first line must be in the form chart <type>.",
		unsupported_type: "Unsupported chart type: {type}",
		series_format: "A series line must be in the form series <key> | <label> | <theme-token>.",
		series_color: "Only the tokens chart-1 to chart-5 can be used as colors.",
		series_duplicate: "Duplicate series key {key}.",
		unknown_header: "Unknown header: {header}",
		data_required: "A data section is required.",
		data_header_required: "A data header row is required.",
		pie_option: "A pie chart does not support {option}.",
		pie_label_required: "A pie chart needs a label field.",
		pie_value_required: "A pie chart needs a value field.",
		pie_header_fields: "The data header must include both the label and value fields.",
		number_empty: "The number field {field} can't be empty.",
		number_invalid: "The number field {field} must be a number.",
		x_required: "An x field is required.",
		series_required: "At least one series is required.",
		series_header_keys: "The data header must include every series key.",
	},
	ko: {
		y_range_format: "y-range 줄의 모양이 다름: y-range <최소> <최대>",
		y_range_number: "y-range의 값이 숫자가 아님",
		y_range_order: "y-range의 최소가 최대보다 작지 않음",
		first_line: "첫 줄이 chart <종류>가 아님",
		unsupported_type: "모르는 차트 종류: {type}",
		series_format: "series 줄의 모양이 다름: series <키> | <이름> | <색>",
		series_color: "chart-1~chart-5가 아닌 색",
		series_duplicate: "겹치는 series 키: {key}",
		unknown_header: "모르는 줄: {header}",
		data_required: "data 줄이 없음",
		data_header_required: "data의 머리 행이 없음",
		pie_option: "원 차트에 없는 설정: {option}",
		pie_label_required: "원 차트의 label이 없음",
		pie_value_required: "원 차트의 value가 없음",
		pie_header_fields: "data의 머리 행에 label이나 value가 없음",
		number_empty: "비어 있는 숫자 칸: {field}",
		number_invalid: "숫자가 아닌 칸: {field}",
		x_required: "x 줄이 없음",
		series_required: "series 줄이 없음",
		series_header_keys: "data의 머리 행에 없는 series 키",
	},
};

/** One syntax error as a line of words, in an admin language: "3줄: …" (the old block's). */
export function errorLine(error: ChartDslParseError, language: "ko" | "en"): string {
	const message = ERRORS[language][error.code].replace(/\{(\w+)\}/g, (whole, name: string) =>
		String(error.values?.[name] ?? whole),
	);
	return language === "ko" ? `${error.line}줄: ${message}` : `Line ${error.line}: ${message}`;
}

/** The text a chart from the "/" menu arrives with: the old block's sample bar chart. */
export const sample = (language: "ko" | "en") =>
	[
		"chart bar",
		"x month",
		`series views | ${words.sampleSeries[language]} | chart-1`,
		"",
		"data",
		"month | views",
		"Jan | 1200",
		"Feb | 1850",
		"Mar | 2400",
	].join("\n");
