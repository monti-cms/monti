export const CHART_TYPES = ["bar", "line", "area", "pie"] as const;
export const CHART_THEME_TOKENS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const;

export type ChartType = (typeof CHART_TYPES)[number];
export type ChartThemeToken = (typeof CHART_THEME_TOKENS)[number];

/** 차트 문법 오류의 종류. 글은 문구 사전의 `error.<코드>`다(`./messages`). */
export type ChartDslErrorCode =
	| "y_range_format"
	| "y_range_number"
	| "y_range_order"
	| "first_line"
	| "unsupported_type"
	| "series_format"
	| "series_color"
	| "series_duplicate"
	| "unknown_header"
	| "data_required"
	| "data_header_required"
	| "pie_option"
	| "pie_label_required"
	| "pie_value_required"
	| "pie_header_fields"
	| "number_empty"
	| "number_invalid"
	| "x_required"
	| "series_required"
	| "series_header_keys";

/** 차트 문법 오류 하나. 줄 번호와 코드, 글에 채울 값(`values`)만 담는다(문구는 언어마다 사전에서 고른다). */
export type ChartDslParseError = {
	line: number;
	code: ChartDslErrorCode;
	values?: Readonly<Record<string, string | number>>;
};

export type ChartDslParseSeries = {
	key: string;
	label: string;
	colorToken: string;
};

export type ChartDslParseResult = {
	source: string;
	type?: ChartType;
	xKey?: string;
	labelKey?: string;
	valueKey?: string;
	showValues: boolean;
	showValuesLine?: number;
	hideGrid: boolean;
	hideGridLine?: number;
	hideYAxis: boolean;
	hideYAxisLine?: number;
	yRange?: {
		min: number;
		max: number;
	};
	yRangeLine?: number;
	series: ChartDslParseSeries[];
	tableHeaders: string[];
	rows: string[][];
	dataLine?: number;
	errors: ChartDslParseError[];
};

export type ChartRenderError = ChartDslParseError;

export type NormalizedChartSeries = {
	key: string;
	label: string;
	colorToken: ChartThemeToken;
};

export type CartesianChartSpec = {
	type: "bar" | "line" | "area";
	data: Array<Record<string, string | number>>;
	series: NormalizedChartSeries[];
	xKey: string;
	options: {
		showTooltip: boolean;
		showLegend: boolean;
		showValues: boolean;
		hideGrid: boolean;
		hideYAxis: boolean;
		yRange?: {
			min: number;
			max: number;
		};
	};
};

export type PieChartSpec = {
	type: "pie";
	data: Array<Record<string, string | number>>;
	series: [];
	labelKey: string;
	valueKey: string;
	options: {
		showTooltip: boolean;
		showLegend: boolean;
	};
};

export type NormalizedChartSpec = CartesianChartSpec | PieChartSpec;

export type NormalizeChartResult = {
	spec?: NormalizedChartSpec;
	errors: ChartRenderError[];
};
