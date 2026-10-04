import type { CartesianChartSpec, NormalizedChartSpec } from "./types";
import type { ChartConfig } from "./ui";

/** 계열(원형은 조각)마다 이름·색을 정한다. 색은 테마 변수(`--chart-1`~`--chart-5`)다. */
export const toChartConfig = (spec: NormalizedChartSpec): ChartConfig => {
	if (spec.type === "pie" && spec.labelKey) {
		return Object.fromEntries(
			spec.data.map((row) => [
				String(row[spec.labelKey] ?? ""),
				{ label: String(row[spec.labelKey] ?? ""), color: String(row.fill ?? "var(--chart-1)") },
			]),
		);
	}
	return Object.fromEntries(
		spec.series.map((series) => [series.key, { label: series.label, color: `var(--${series.colorToken})` }]),
	);
};

/** Y축 눈금 글자 폭(px)을 데이터에서 어림한다. 눈금은 데이터 최댓값보다 한 단계 크게 잡힐 수 있다(예: 95 → 100). */
const Y_AXIS_CHAR_WIDTH = 7;
const Y_AXIS_TICK_GAP = 14;
export const estimateYAxisWidth = (spec: CartesianChartSpec) => {
	const values = spec.data.flatMap((row) =>
		spec.series.map((series) => Number(row[series.key])).filter((value) => Number.isFinite(value)),
	);
	if (spec.options.yRange) values.push(spec.options.yRange.min, spec.options.yRange.max);
	const labels = values.flatMap((value) => [String(value), String(Math.round(value * 1.25))]);
	const longest = Math.max(1, ...labels.map((label) => label.length));
	return longest * Y_AXIS_CHAR_WIDTH + Y_AXIS_TICK_GAP;
};

/** 값 글자(`show values`)와 툴팁에 보일 값. 숫자는 천 단위로 끊는다. */
export const formatChartValue = (value: unknown) =>
	value == null || value === false ? "" : typeof value === "number" ? value.toLocaleString() : String(value);
