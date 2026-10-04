import {
	CHART_THEME_TOKENS,
	CHART_TYPES,
	type ChartDslErrorCode,
	type ChartDslParseError,
	type ChartDslParseResult,
	type ChartThemeToken,
	type ChartType,
	type NormalizeChartResult,
} from "./types";

const isChartType = (value: string): value is ChartType => CHART_TYPES.includes(value as ChartType);
const isChartThemeToken = (value: string): value is ChartThemeToken =>
	CHART_THEME_TOKENS.includes(value as ChartThemeToken);

const splitTableRow = (line: string) => line.split("|").map((item) => item.trim());

const toError = (
	line: number,
	code: ChartDslErrorCode,
	values?: Readonly<Record<string, string | number>>,
): ChartDslParseError => (values ? { line, code, values } : { line, code });
const isBlankCell = (value: unknown) => typeof value === "string" && value.trim() === "";
type ParsedNumericRange = { ok: true; value: { min: number; max: number } } | { ok: false; error: ChartDslErrorCode };

const parseNumericRange = (value: string) => {
	const [rawMin = "", rawMax = "", ...rest] = value.split(/\s+/).filter(Boolean);
	if (!rawMin || !rawMax || rest.length > 0) {
		return { ok: false, error: "y_range_format" } satisfies ParsedNumericRange;
	}

	const min = Number(rawMin);
	const max = Number(rawMax);
	if (!Number.isFinite(min) || !Number.isFinite(max)) {
		return { ok: false, error: "y_range_number" } satisfies ParsedNumericRange;
	}

	if (min >= max) {
		return { ok: false, error: "y_range_order" } satisfies ParsedNumericRange;
	}

	return { ok: true, value: { min, max } } satisfies ParsedNumericRange;
};

export const parseChartDsl = (source: string): ChartDslParseResult => {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const errors: ChartDslParseError[] = [];
	const result: ChartDslParseResult = {
		source,
		showValues: false,
		hideGrid: false,
		hideYAxis: false,
		series: [],
		tableHeaders: [],
		rows: [],
		errors,
	};

	const firstLine = lines[0]?.trim() ?? "";
	const firstMatch = firstLine.match(/^chart\s+(\S+)$/);
	if (!firstMatch) {
		errors.push(toError(1, "first_line"));
		return result;
	}

	const rawType = firstMatch[1];
	if (!isChartType(rawType)) {
		errors.push(toError(1, "unsupported_type", { type: rawType }));
		return result;
	}

	result.type = rawType;

	let dataIndex = -1;
	for (let index = 1; index < lines.length; index += 1) {
		const trimmed = lines[index].trim();
		if (!trimmed) continue;

		if (trimmed === "data") {
			dataIndex = index;
			result.dataLine = index + 1;
			break;
		}

		if (trimmed.startsWith("x ")) {
			result.xKey = trimmed.slice(2).trim();
			continue;
		}

		if (trimmed.startsWith("label ")) {
			result.labelKey = trimmed.slice(6).trim();
			continue;
		}

		if (trimmed.startsWith("value ")) {
			result.valueKey = trimmed.slice(6).trim();
			continue;
		}

		if (trimmed === "show-values") {
			result.showValues = true;
			result.showValuesLine = index + 1;
			continue;
		}

		if (trimmed === "hide-grid") {
			result.hideGrid = true;
			result.hideGridLine = index + 1;
			continue;
		}

		if (trimmed === "hide-y-axis") {
			result.hideYAxis = true;
			result.hideYAxisLine = index + 1;
			continue;
		}

		if (trimmed.startsWith("y-range ")) {
			const parsedRange = parseNumericRange(trimmed.slice(8).trim());
			if (!parsedRange.ok) {
				errors.push(toError(index + 1, parsedRange.error));
				continue;
			}

			result.yRange = parsedRange.value;
			result.yRangeLine = index + 1;
			continue;
		}

		if (trimmed.startsWith("series ")) {
			const payload = trimmed.slice(7).trim();
			const [key = "", label = "", colorToken = ""] = splitTableRow(payload);

			if (!key || !label || !colorToken) {
				errors.push(toError(index + 1, "series_format"));
				continue;
			}

			if (!isChartThemeToken(colorToken)) {
				errors.push(toError(index + 1, "series_color"));
				continue;
			}

			if (result.series.some((series) => series.key === key)) {
				errors.push(toError(index + 1, "series_duplicate", { key }));
				continue;
			}

			result.series.push({ key, label, colorToken });
			continue;
		}

		errors.push(toError(index + 1, "unknown_header", { header: trimmed }));
	}

	if (dataIndex === -1) {
		errors.push(toError(lines.length, "data_required"));
		return result;
	}

	const tableHeaderLine = lines[dataIndex + 1]?.trim() ?? "";
	if (!tableHeaderLine) {
		errors.push(toError(dataIndex + 2, "data_header_required"));
		return result;
	}

	result.tableHeaders = splitTableRow(tableHeaderLine);

	for (let index = dataIndex + 2; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.trim()) continue;
		result.rows.push(splitTableRow(line));
	}

	return result;
};

export const normalizeChartDsl = (parsed: ChartDslParseResult): NormalizeChartResult => {
	if (parsed.errors.length > 0 || !parsed.type) {
		return { errors: [...parsed.errors] };
	}

	const errors = [...parsed.errors];
	const dataHeaderLine = (parsed.dataLine ?? 0) + 1;
	const rowStartLine = (parsed.dataLine ?? 0) + 2;

	if (parsed.type === "pie") {
		if (parsed.showValues) {
			errors.push(toError(parsed.showValuesLine ?? 2, "pie_option", { option: "show-values" }));
		}
		if (parsed.hideGrid) {
			errors.push(toError(parsed.hideGridLine ?? 2, "pie_option", { option: "hide-grid" }));
		}
		if (parsed.hideYAxis) {
			errors.push(toError(parsed.hideYAxisLine ?? 2, "pie_option", { option: "hide-y-axis" }));
		}
		if (parsed.yRange) {
			errors.push(toError(parsed.yRangeLine ?? 2, "pie_option", { option: "y-range" }));
		}

		const labelKey = parsed.labelKey;
		const valueKey = parsed.valueKey;

		if (!labelKey) {
			errors.push(toError(2, "pie_label_required"));
		}
		if (!valueKey) {
			errors.push(toError(3, "pie_value_required"));
		}

		if (!labelKey || !valueKey) {
			return { errors };
		}

		if (!parsed.tableHeaders.includes(labelKey) || !parsed.tableHeaders.includes(valueKey)) {
			errors.push(toError(dataHeaderLine, "pie_header_fields"));
			return { errors };
		}

		const data = parsed.rows.map((row, index) => {
			const record = Object.fromEntries(parsed.tableHeaders.map((header, cellIndex) => [header, row[cellIndex] ?? ""]));
			if (isBlankCell(record[valueKey])) {
				errors.push(toError(rowStartLine + index, "number_empty", { field: valueKey }));
				return {
					[labelKey]: String(record[labelKey] ?? ""),
					[valueKey]: Number.NaN,
					fill: `var(--${CHART_THEME_TOKENS[index % CHART_THEME_TOKENS.length]})`,
				};
			}
			const numericValue = Number(record[valueKey]);
			if (!Number.isFinite(numericValue)) {
				errors.push(toError(rowStartLine + index, "number_invalid", { field: valueKey }));
			}

			return {
				[labelKey]: String(record[labelKey] ?? ""),
				[valueKey]: numericValue,
				fill: `var(--${CHART_THEME_TOKENS[index % CHART_THEME_TOKENS.length]})`,
			};
		});

		if (errors.length > 0) {
			return { errors };
		}

		return {
			errors: [],
			spec: {
				type: "pie",
				labelKey,
				valueKey,
				data,
				series: [],
				options: {
					showTooltip: true,
					showLegend: data.length > 1,
				},
			},
		};
	}

	if (!parsed.xKey) {
		errors.push(toError(2, "x_required"));
	}
	if (parsed.series.length === 0) {
		errors.push(toError(3, "series_required"));
	}
	const xKey = parsed.xKey;
	if (!xKey || parsed.series.length === 0) {
		return { errors };
	}

	if (
		!parsed.tableHeaders.includes(xKey) ||
		!parsed.series.every((series) => parsed.tableHeaders.includes(series.key))
	) {
		errors.push(toError(dataHeaderLine, "series_header_keys"));
		return { errors };
	}

	const data = parsed.rows.map((row, index) => {
		const record = Object.fromEntries(parsed.tableHeaders.map((header, cellIndex) => [header, row[cellIndex] ?? ""]));
		const normalizedRow: Record<string, string | number> = {
			[xKey]: String(record[xKey] ?? ""),
		};

		for (const series of parsed.series) {
			if (isBlankCell(record[series.key])) {
				errors.push(toError(rowStartLine + index, "number_empty", { field: series.key }));
				continue;
			}
			const numericValue = Number(record[series.key]);
			if (!Number.isFinite(numericValue)) {
				errors.push(toError(rowStartLine + index, "number_invalid", { field: series.key }));
				continue;
			}
			normalizedRow[series.key] = numericValue;
		}

		return normalizedRow;
	});

	if (errors.length > 0) {
		return { errors };
	}

	return {
		errors: [],
		spec: {
			type: parsed.type,
			xKey,
			data,
			series: parsed.series.map((series) => ({
				key: series.key,
				label: series.label,
				colorToken: series.colorToken as ChartThemeToken,
			})),
			options: {
				showTooltip: true,
				showLegend: parsed.series.length > 1,
				showValues: parsed.showValues,
				hideGrid: parsed.hideGrid,
				hideYAxis: parsed.hideYAxis,
				yRange: parsed.yRange,
			},
		},
	};
};
