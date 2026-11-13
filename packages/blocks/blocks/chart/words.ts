import type { ChartDslErrorCode, ChartDslParseError } from "./types";

/**
 * The chart's words (doc 18): the old block's, in each admin language for the editor and the publish to-do list. The site's own words for readers
 * are in `site.tsx`. Change them here.
 */
export const words = {
	label: { ko: "차트", en: "Chart" },
	source: { ko: "원문 코드", en: "Source" },
	empty: { ko: "차트 입력", en: "Enter a chart" },
	placeholder: { ko: "차트 데이터를 입력하세요", en: "Enter the chart's data" },
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
		y_range_format: "y-range 줄은 y-range <min> <max> 형식이어야 해요.",
		y_range_number: "y-range 값은 숫자여야 해요.",
		y_range_order: "y-range 는 min < max 이어야 해요.",
		first_line: "첫 줄은 chart <type> 형식이어야 해요.",
		unsupported_type: "지원하지 않는 차트 타입이에요: {type}",
		series_format: "series 줄은 series <key> | <label> | <theme-token> 형식이어야 해요.",
		series_color: "색상은 chart-1 ~ chart-5 토큰만 사용할 수 있어요.",
		series_duplicate: "series key {key} 가 중복되었어요.",
		unknown_header: "알 수 없는 헤더예요: {header}",
		data_required: "data 섹션이 필요해요.",
		data_header_required: "data 헤더 행이 필요해요.",
		pie_option: "pie 차트는 {option} 를 지원하지 않아요.",
		pie_label_required: "pie 차트는 label 필드가 필요해요.",
		pie_value_required: "pie 차트는 value 필드가 필요해요.",
		pie_header_fields: "data 헤더에 label/value 필드가 모두 포함되어야 해요.",
		number_empty: "숫자 필드 {field} 는 비어 있을 수 없어요.",
		number_invalid: "숫자 필드 {field} 는 숫자여야 해요.",
		x_required: "x 필드가 필요해요.",
		series_required: "series 는 1개 이상 필요해요.",
		series_header_keys: "data 헤더에 series key가 모두 포함되어야 해요.",
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
