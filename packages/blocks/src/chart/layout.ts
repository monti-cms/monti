export type ChartDimensions = {
	width: number;
	height: number;
};

export const DEFAULT_CHART_DIMENSIONS: ChartDimensions = {
	width: 520,
	height: 280,
};

export const CHART_LEGEND_HEIGHT = 36;

const resolveDimension = (value: number, fallback: number) => {
	if (!Number.isFinite(value) || value <= 0) {
		return fallback;
	}

	return value;
};

export const resolvePieGeometry = (dimensions: ChartDimensions, legendHeight = 0) => {
	const width = resolveDimension(dimensions.width, DEFAULT_CHART_DIMENSIONS.width);
	const height = resolveDimension(dimensions.height, DEFAULT_CHART_DIMENSIONS.height);
	const legendSpace = Math.max(legendHeight, 0);
	const chartBottom = Math.max(height - legendSpace, 24);
	const pieAreaHeight = Math.max(chartBottom - 12, 96);
	const desiredOuterRadius = Math.max(Math.round((Math.min(width, pieAreaHeight) / 2) * 0.76), 36);
	const cy = legendSpace > 0 ? Math.round(chartBottom / 2 - 4) : Math.round(height / 2);
	const cx = Math.round(width / 2);
	const maxOuterRadius = Math.max(Math.min(cx - 8, width - cx - 8, cy - 8, chartBottom - cy - 8), 12);
	const outerRadius = Math.min(desiredOuterRadius, maxOuterRadius);
	const desiredInnerRadius = outerRadius <= 24 ? outerRadius - 8 : Math.max(Math.round(outerRadius * 0.56), 12);
	const innerRadius = Math.max(Math.min(desiredInnerRadius, outerRadius - 6), 0);

	return {
		cx,
		cy,
		innerRadius,
		outerRadius,
	};
};
