export type ChartDimensions = {
    width: number;
    height: number;
};
export declare const DEFAULT_CHART_DIMENSIONS: ChartDimensions;
export declare const CHART_LEGEND_HEIGHT = 36;
export declare const resolvePieGeometry: (dimensions: ChartDimensions, legendHeight?: number) => {
    cx: number;
    cy: number;
    innerRadius: number;
    outerRadius: number;
};
