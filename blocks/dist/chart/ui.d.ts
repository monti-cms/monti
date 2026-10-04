import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { type ChartDimensions } from "./layout.js";
export type ChartConfig = Record<string, {
    label?: React.ReactNode;
    color?: string;
}>;
export declare const useChartDimensions: () => ChartDimensions;
type ChartPayloadItem = {
    type?: string;
    name?: string | number;
    dataKey?: string | number;
    value?: string | number;
    color?: string;
    payload?: Record<string, unknown> & {
        fill?: string;
    };
};
export declare const ChartContainer: ({ id, className, children, config, }: React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) => React.JSX.Element;
export declare const ChartTooltip: typeof RechartsPrimitive.Tooltip;
export declare const ChartLegend: React.MemoExoticComponent<(outsideProps: RechartsPrimitive.LegendProps) => React.ReactPortal | null>;
export declare const ChartTooltipContent: ({ active, payload, label, className, hideLabel, nameKey, }: React.ComponentProps<"div"> & {
    active?: boolean;
    payload?: ChartPayloadItem[];
    label?: string | number;
    hideLabel?: boolean;
    nameKey?: string;
}) => React.JSX.Element | null;
export declare const ChartLegendContent: ({ payload, className, nameKey, onHeightChange, }: RechartsPrimitive.DefaultLegendContentProps & React.ComponentProps<"div"> & {
    nameKey?: string;
    onHeightChange?: (height: number) => void;
}) => React.JSX.Element | null;
export {};
