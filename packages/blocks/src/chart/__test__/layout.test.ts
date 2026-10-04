import { describe, expect, it } from "vitest";
import { CHART_LEGEND_HEIGHT, DEFAULT_CHART_DIMENSIONS, resolvePieGeometry } from "../layout";

describe("resolvePieGeometry", () => {
	it("shrinks the pie radius in small containers", () => {
		const large = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT);
		const small = resolvePieGeometry({ width: 240, height: 160 }, CHART_LEGEND_HEIGHT);

		expect(small.outerRadius).toBeLessThan(large.outerRadius);
		expect(small.innerRadius).toBeLessThan(large.innerRadius);
		expect(small.outerRadius * 2).toBeLessThan(160 - CHART_LEGEND_HEIGHT);
	});

	it("moves the pie center up when there is a legend", () => {
		const withLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT);
		const withoutLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, 0);

		expect(withLegend.cy).toBeLessThan(withoutLegend.cy);
	});

	it("uses the default size for invalid size values", () => {
		const fallback = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, 0);
		const invalid = resolvePieGeometry({ width: 0, height: Number.NaN }, 0);

		expect(invalid).toEqual(fallback);
	});

	it("keeps the pie chart within the top and bottom bounds even at very low heights", () => {
		const compact = resolvePieGeometry({ width: 180, height: 88 }, CHART_LEGEND_HEIGHT);
		const chartBottom = 88 - CHART_LEGEND_HEIGHT;

		expect(compact.outerRadius).toBeLessThanOrEqual(compact.cy - 8);
		expect(compact.outerRadius).toBeLessThanOrEqual(chartBottom - compact.cy - 8);
		expect(compact.innerRadius).toBeLessThan(compact.outerRadius);
	});

	it("moves the pie chart center up by the same amount as the legend height grows", () => {
		const oneRowLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT);
		const wrappedLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT * 2);

		expect(wrappedLegend.cy).toBeLessThan(oneRowLegend.cy);
		expect(wrappedLegend.outerRadius).toBeLessThanOrEqual(oneRowLegend.outerRadius);
	});
});
