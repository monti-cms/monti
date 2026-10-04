import { describe, expect, it } from "vitest";
import { CHART_LEGEND_HEIGHT, DEFAULT_CHART_DIMENSIONS, resolvePieGeometry } from "../layout";

describe("resolvePieGeometry", () => {
	it("작은 컨테이너에서는 파이 반지름을 함께 줄인다", () => {
		const large = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT);
		const small = resolvePieGeometry({ width: 240, height: 160 }, CHART_LEGEND_HEIGHT);

		expect(small.outerRadius).toBeLessThan(large.outerRadius);
		expect(small.innerRadius).toBeLessThan(large.innerRadius);
		expect(small.outerRadius * 2).toBeLessThan(160 - CHART_LEGEND_HEIGHT);
	});

	it("범례가 있으면 파이 중심을 위로 올린다", () => {
		const withLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT);
		const withoutLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, 0);

		expect(withLegend.cy).toBeLessThan(withoutLegend.cy);
	});

	it("유효하지 않은 크기 값이면 기본 크기를 사용한다", () => {
		const fallback = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, 0);
		const invalid = resolvePieGeometry({ width: 0, height: Number.NaN }, 0);

		expect(invalid).toEqual(fallback);
	});

	it("아주 낮은 높이에서도 파이 차트가 위아래 경계를 넘지 않는다", () => {
		const compact = resolvePieGeometry({ width: 180, height: 88 }, CHART_LEGEND_HEIGHT);
		const chartBottom = 88 - CHART_LEGEND_HEIGHT;

		expect(compact.outerRadius).toBeLessThanOrEqual(compact.cy - 8);
		expect(compact.outerRadius).toBeLessThanOrEqual(chartBottom - compact.cy - 8);
		expect(compact.innerRadius).toBeLessThan(compact.outerRadius);
	});

	it("범례 높이가 커지면 파이 차트 중심도 그만큼 더 위로 올라간다", () => {
		const oneRowLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT);
		const wrappedLegend = resolvePieGeometry(DEFAULT_CHART_DIMENSIONS, CHART_LEGEND_HEIGHT * 2);

		expect(wrappedLegend.cy).toBeLessThan(oneRowLegend.cy);
		expect(wrappedLegend.outerRadius).toBeLessThanOrEqual(oneRowLegend.outerRadius);
	});
});
