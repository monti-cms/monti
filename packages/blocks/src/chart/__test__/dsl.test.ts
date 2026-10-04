import { describe, expect, it } from "vitest";
import { normalizeChartDsl, parseChartDsl } from "../dsl";

describe("parseChartDsl", () => {
	it("parses and normalizes bar chart DSL", () => {
		const source = [
			"chart bar",
			"x month",
			"show-values",
			"hide-grid",
			"hide-y-axis",
			"y-range 0 2000",
			"series views | 조회수 | chart-1",
			"series likes | 좋아요 | chart-2",
			"",
			"data",
			"month | views | likes",
			"Jan | 1200 | 200",
			"Feb | 1800 | 260",
		].join("\n");

		const parsed = parseChartDsl(source);
		expect(parsed.errors).toEqual([]);
		expect(parsed.type).toBe("bar");
		expect(parsed.xKey).toBe("month");
		expect(parsed.showValues).toBe(true);
		expect(parsed.hideGrid).toBe(true);
		expect(parsed.hideYAxis).toBe(true);
		expect(parsed.yRange).toEqual({ min: 0, max: 2000 });
		expect(parsed.series).toEqual([
			{ key: "views", label: "조회수", colorToken: "chart-1" },
			{ key: "likes", label: "좋아요", colorToken: "chart-2" },
		]);

		const normalized = normalizeChartDsl(parsed);
		expect(normalized.errors).toEqual([]);
		expect(normalized.spec).toMatchObject({
			type: "bar",
			xKey: "month",
			options: {
				showTooltip: true,
				showLegend: true,
				showValues: true,
				hideGrid: true,
				hideYAxis: true,
				yRange: { min: 0, max: 2000 },
			},
			series: [
				{ key: "views", label: "조회수", colorToken: "chart-1" },
				{ key: "likes", label: "좋아요", colorToken: "chart-2" },
			],
			data: [
				{ month: "Jan", views: 1200, likes: 200 },
				{ month: "Feb", views: 1800, likes: 260 },
			],
		});
	});

	it("hides the legend for a single-series line chart", () => {
		const source = [
			"chart line",
			"x month",
			"series views | 조회수 | chart-1",
			"",
			"data",
			"month | views",
			"Jan | 1200",
			"Feb | 1800",
		].join("\n");

		const normalized = normalizeChartDsl(parseChartDsl(source));
		expect(normalized.errors).toEqual([]);
		expect(normalized.spec?.options.showLegend).toBe(false);
		expect(
			normalized.spec?.type === "line" || normalized.spec?.type === "area" || normalized.spec?.type === "bar"
				? normalized.spec.options.showValues
				: undefined,
		).toBe(false);
		expect(
			normalized.spec?.type === "line" || normalized.spec?.type === "area" || normalized.spec?.type === "bar"
				? normalized.spec.options.hideGrid
				: undefined,
		).toBe(false);
		expect(
			normalized.spec?.type === "line" || normalized.spec?.type === "area" || normalized.spec?.type === "bar"
				? normalized.spec.options.hideYAxis
				: undefined,
		).toBe(false);
	});

	it("parses pie chart DSL and assigns colors automatically", () => {
		const source = [
			"chart pie",
			"label browser",
			"value visitors",
			"",
			"data",
			"browser | visitors",
			"Chrome | 275",
			"Safari | 200",
			"Firefox | 187",
		].join("\n");

		const normalized = normalizeChartDsl(parseChartDsl(source));
		expect(normalized.errors).toEqual([]);
		expect(normalized.spec).toMatchObject({
			type: "pie",
			labelKey: "browser",
			valueKey: "visitors",
			options: { showTooltip: true, showLegend: true },
		});
		expect(normalized.spec?.data).toEqual([
			{ browser: "Chrome", visitors: 275, fill: "var(--chart-1)" },
			{ browser: "Safari", visitors: 200, fill: "var(--chart-2)" },
			{ browser: "Firefox", visitors: 187, fill: "var(--chart-3)" },
		]);
	});

	it("returns an error for an unknown chart type", () => {
		const parsed = parseChartDsl(["chart radar", "data", "a", "b"].join("\n"));
		expect(parsed.errors).toEqual([{ line: 1, code: "unsupported_type", values: { type: "radar" } }]);
	});

	it("returns an error when a series color token is out of the allowed range", () => {
		const parsed = parseChartDsl(
			["chart area", "x month", "series views | 조회수 | blue", "", "data", "month | views", "Jan | 1200"].join("\n"),
		);

		expect(parsed.errors).toEqual([{ line: 3, code: "series_color" }]);
	});

	it("returns a normalization error when the data header and series keys do not match", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				["chart bar", "x month", "series views | 조회수 | chart-1", "", "data", "month | likes", "Jan | 1200"].join(
					"\n",
				),
			),
		);

		expect(normalized.errors).toEqual([{ line: 6, code: "series_header_keys" }]);
	});

	it("includes y-range in the normalized result", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				[
					"chart area",
					"x month",
					"y-range -10 10",
					"series delta | 변화량 | chart-1",
					"",
					"data",
					"month | delta",
					"Jan | -2",
					"Feb | 7",
				].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([]);
		expect(normalized.spec).toMatchObject({
			type: "area",
			options: { yRange: { min: -10, max: 10 }, showValues: false, hideGrid: false },
		});
	});

	it("includes hide-grid in the normalized result", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				[
					"chart line",
					"x month",
					"hide-grid",
					"series views | 조회수 | chart-1",
					"",
					"data",
					"month | views",
					"Jan | 1200",
					"Feb | 1800",
				].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([]);
		expect(normalized.spec).toMatchObject({
			type: "line",
			options: { hideGrid: true, hideYAxis: false, showValues: false },
		});
	});

	it("includes hide-y-axis in the normalized result", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				[
					"chart line",
					"x month",
					"hide-y-axis",
					"series views | 조회수 | chart-1",
					"",
					"data",
					"month | views",
					"Jan | 1200",
					"Feb | 1800",
				].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([]);
		expect(normalized.spec).toMatchObject({
			type: "line",
			options: { hideGrid: false, hideYAxis: true, showValues: false },
		});
	});

	it("returns an error when a numeric field has a non-numeric value", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				["chart pie", "label browser", "value visitors", "", "data", "browser | visitors", "Chrome | many"].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([{ line: 7, code: "number_invalid", values: { field: "visitors" } }]);
	});

	it("returns an error for an empty numeric cell in a cartesian chart", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				["chart bar", "x month", "series views | 조회수 | chart-1", "", "data", "month | views", "Jan | "].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([{ line: 7, code: "number_empty", values: { field: "views" } }]);
	});

	it("returns an error for an empty numeric cell in a pie chart", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				["chart pie", "label browser", "value visitors", "", "data", "browser | visitors", "Chrome | "].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([{ line: 7, code: "number_empty", values: { field: "visitors" } }]);
	});

	it("returns an error for invalid y-range syntax", () => {
		const parsed = parseChartDsl(
			["chart bar", "x month", "y-range low high", "series views | 조회수 | chart-1", "", "data", "month | views"].join(
				"\n",
			),
		);

		expect(parsed.errors).toEqual([{ line: 3, code: "y_range_number" }]);
	});

	it("returns an error when the y-range min/max order is wrong", () => {
		const parsed = parseChartDsl(
			["chart bar", "x month", "y-range 10 0", "series views | 조회수 | chart-1", "", "data", "month | views"].join(
				"\n",
			),
		);

		expect(parsed.errors).toEqual([{ line: 3, code: "y_range_order" }]);
	});

	it("returns an error when a pie chart uses cartesian-only options", () => {
		const normalized = normalizeChartDsl(
			parseChartDsl(
				[
					"chart pie",
					"show-values",
					"hide-grid",
					"hide-y-axis",
					"y-range 0 100",
					"label browser",
					"value visitors",
					"",
					"data",
					"browser | visitors",
					"Chrome | 275",
				].join("\n"),
			),
		);

		expect(normalized.errors).toEqual([
			{ line: 2, code: "pie_option", values: { option: "show-values" } },
			{ line: 3, code: "pie_option", values: { option: "hide-grid" } },
			{ line: 4, code: "pie_option", values: { option: "hide-y-axis" } },
			{ line: 5, code: "pie_option", values: { option: "y-range" } },
		]);
	});
});
