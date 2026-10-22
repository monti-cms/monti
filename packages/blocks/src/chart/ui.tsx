"use client";

/*
 * Drawing frame for the chart preview (a thin layer over recharts, shaped like the shadcn/ui chart). Colors use `color` (a theme variable) from `config`.
 * Used only by the editor preview (`./preview`). The public page is rendered by the site.
 *
 * design-system: drawing — chart geometry (recharts selectors, aspect ratio, tooltip and legend boxes, color swatches); its classes and `style` stay raw.
 */

import { cn } from "@monti-cms/admin/kit";
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { CHART_LEGEND_HEIGHT, type ChartDimensions, DEFAULT_CHART_DIMENSIONS } from "./layout";

export type ChartConfig = Record<
	string,
	{
		label?: React.ReactNode;
		color?: string;
	}
>;

const ChartContext = React.createContext<{
	config: ChartConfig;
	dimensions: ChartDimensions;
} | null>(null);

const useChart = () => {
	const context = React.useContext(ChartContext);
	if (!context) {
		throw new Error("useChart must be used within a <ChartContainer />");
	}
	return context;
};

export const useChartDimensions = () => useChart().dimensions;

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

export const ChartContainer = ({
	id,
	className,
	children,
	config,
}: React.ComponentProps<"div"> & {
	config: ChartConfig;
	children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) => {
	const uniqueId = React.useId();
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
	const [dimensions, setDimensions] = React.useState<ChartDimensions>(DEFAULT_CHART_DIMENSIONS);
	const chartVars = Object.fromEntries(
		Object.entries(config)
			.filter(([, itemConfig]) => itemConfig.color)
			.map(([key, itemConfig]) => [`--color-${key}`, itemConfig.color]),
	) as React.CSSProperties;

	return (
		<ChartContext.Provider value={{ config, dimensions }}>
			<div
				data-slot="chart"
				data-chart={chartId}
				style={chartVars}
				className={cn(
					"flex aspect-video justify-center text-monti-caption [&_.recharts-cartesian-axis-tick_text]:fill-monti-muted [&_.recharts-cartesian-grid_line]:stroke-monti-grid [&_.recharts-curve.recharts-tooltip-cursor]:stroke-monti-grid [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-monti-muted [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
					className,
				)}
			>
				<RechartsPrimitive.ResponsiveContainer
					width="100%"
					height="100%"
					initialDimension={DEFAULT_CHART_DIMENSIONS}
					onResize={(width, height) => {
						if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
							return;
						}

						setDimensions((current) => {
							if (current.width === width && current.height === height) {
								return current;
							}

							return { width, height };
						});
					}}
				>
					{children}
				</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
};

export const ChartTooltip = RechartsPrimitive.Tooltip;
export const ChartLegend = RechartsPrimitive.Legend;

export const ChartTooltipContent = ({
	active,
	payload,
	label,
	className,
	hideLabel = false,
	nameKey,
}: React.ComponentProps<"div"> & {
	active?: boolean;
	payload?: ChartPayloadItem[];
	label?: string | number;
	hideLabel?: boolean;
	nameKey?: string;
}) => {
	const { config } = useChart();

	if (!active || !payload?.length) {
		return null;
	}

	return (
		<div
			className={cn(
				"grid min-w-[8rem] gap-condensed rounded-lg border border-monti-muted bg-monti-page px-normal py-condensed text-monti-caption shadow-monti-floating",
				className,
			)}
		>
			{!hideLabel && label ? <div className="font-medium">{String(config[String(label)]?.label ?? label)}</div> : null}
			<div className="grid gap-condensed">
				{payload
					.filter((item) => item.type !== "none")
					.map((item) => {
						const key = String(nameKey ? item.payload?.[nameKey] : (item.name ?? item.dataKey ?? "value"));
						const itemConfig = config[key] ?? config[String(item.name ?? item.dataKey ?? "value")];
						const itemKey = `${key}-${String(item.value ?? item.color ?? "")}`;

						return (
							<div key={itemKey} className="flex items-center gap-condensed">
								<div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color ?? item.payload?.fill }} />
								<div className="flex flex-1 items-center justify-between gap-normal">
									<span className="text-monti-muted">{itemConfig?.label ?? key}</span>
									<span className="font-medium font-mono text-monti-default tabular-nums">
										{typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}
									</span>
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
};

export const ChartLegendContent = ({
	payload,
	className,
	nameKey,
	onHeightChange,
}: RechartsPrimitive.DefaultLegendContentProps &
	React.ComponentProps<"div"> & {
		nameKey?: string;
		onHeightChange?: (height: number) => void;
	}) => {
	const { config } = useChart();
	const legendPayload = payload as ChartPayloadItem[] | undefined;
	const legendRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		const element = legendRef.current;
		if (!element) {
			return;
		}

		const syncHeight = () => {
			const nextHeight = Math.max(Math.ceil(element.getBoundingClientRect().height), CHART_LEGEND_HEIGHT);

			onHeightChange?.(nextHeight);
		};

		syncHeight();

		if (typeof ResizeObserver === "undefined") {
			return;
		}

		const observer = new ResizeObserver(() => {
			syncHeight();
		});

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, [onHeightChange]);

	if (!legendPayload?.length) {
		return null;
	}

	return (
		<div
			ref={legendRef}
			className={cn("flex flex-wrap items-center justify-center gap-comfortable pt-normal", className)}
		>
			{legendPayload
				.filter((item) => item.type !== "none")
				.map((item) => {
					const payloadValue = item.payload;
					const lookupKey = String(nameKey ? payloadValue?.[nameKey] : (item.value ?? item.dataKey ?? "value"));
					const itemConfig = config[lookupKey] ?? config[String(item.dataKey ?? "value")];
					const itemKey = `${lookupKey}-${String(item.color ?? "")}`;

					return (
						<div key={itemKey} className="flex items-center gap-condensed">
							<div className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
							<span>{itemConfig?.label ?? lookupKey}</span>
						</div>
					);
				})}
		</div>
	);
};
