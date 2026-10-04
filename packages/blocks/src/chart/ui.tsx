"use client";

/*
 * 차트 미리보기의 그리기 틀(recharts 위의 얇은 층, shadcn/ui 차트와 같은 모양). 색은 `config`의 `color`(테마 변수)를 쓴다.
 * 편집기 미리보기(`./preview`)만 쓴다. 공개 화면은 사이트가 그린다.
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
					"flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-cms-muted-foreground [&_.recharts-cartesian-grid_line]:stroke-cms-border/60 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-cms-border [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-cms-muted/60 [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
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
				"grid min-w-[8rem] gap-1.5 rounded-lg border border-cms-border/50 bg-cms-background px-2.5 py-1.5 text-xs shadow-xl",
				className,
			)}
		>
			{!hideLabel && label ? <div className="font-medium">{String(config[String(label)]?.label ?? label)}</div> : null}
			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== "none")
					.map((item) => {
						const key = String(nameKey ? item.payload?.[nameKey] : (item.name ?? item.dataKey ?? "value"));
						const itemConfig = config[key] ?? config[String(item.name ?? item.dataKey ?? "value")];
						const itemKey = `${key}-${String(item.value ?? item.color ?? "")}`;

						return (
							<div key={itemKey} className="flex items-center gap-2">
								<div
									className="h-2.5 w-2.5 rounded-[2px]"
									style={{ backgroundColor: item.color ?? item.payload?.fill }}
								/>
								<div className="flex flex-1 items-center justify-between gap-3">
									<span className="text-cms-muted-foreground">{itemConfig?.label ?? key}</span>
									<span className="font-medium font-mono text-cms-foreground tabular-nums">
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
		<div ref={legendRef} className={cn("flex flex-wrap items-center justify-center gap-4 pt-3", className)}>
			{legendPayload
				.filter((item) => item.type !== "none")
				.map((item) => {
					const payloadValue = item.payload;
					const lookupKey = String(nameKey ? payloadValue?.[nameKey] : (item.value ?? item.dataKey ?? "value"));
					const itemConfig = config[lookupKey] ?? config[String(item.dataKey ?? "value")];
					const itemKey = `${lookupKey}-${String(item.color ?? "")}`;

					return (
						<div key={itemKey} className="flex items-center gap-1.5">
							<div className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: item.color }} />
							<span>{itemConfig?.label ?? lookupKey}</span>
						</div>
					);
				})}
		</div>
	);
};
