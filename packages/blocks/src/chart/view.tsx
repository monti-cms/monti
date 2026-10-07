/*
 * Public-page chart (drawn on recharts, optional dependency `recharts`). Read only when `render.client.tsx` loads it in the browser.
 * Uses the same chart syntax and colors (`--chart-1` to `--chart-5`) as the editor preview (`./preview`), and is styled with
 * `cms-block-chart-*` classes (this package's `render.css`) without admin UI code or Tailwind.
 */

import { createContext, type ReactElement, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { estimateYAxisWidth, formatChartValue, toChartConfig } from "./helpers";
import { CHART_LEGEND_HEIGHT, type ChartDimensions, DEFAULT_CHART_DIMENSIONS, resolvePieGeometry } from "./layout";
import type { CartesianChartSpec, PieChartSpec } from "./types";
import type { ChartConfig } from "./ui";

interface FrameContext {
	readonly config: ChartConfig;
	readonly dimensions: ChartDimensions;
}

const FrameState = createContext<FrameContext>({ config: {}, dimensions: DEFAULT_CHART_DIMENSIONS });

interface PayloadItem {
	readonly type?: string;
	readonly name?: string | number;
	readonly dataKey?: string | number;
	readonly value?: string | number;
	readonly color?: string;
	readonly payload?: Record<string, unknown> & { fill?: string };
}

/** Outer chart frame. Stretches to fit its size and passes series colors down as `--color-<key>` variables. */
function ChartFrame({ config, children }: { config: ChartConfig; children: ReactElement }) {
	const [dimensions, setDimensions] = useState<ChartDimensions>(DEFAULT_CHART_DIMENSIONS);
	const style = Object.fromEntries(
		Object.entries(config)
			.filter(([, item]) => item.color)
			.map(([key, item]) => [`--color-${key}`, item.color]),
	);
	return (
		<FrameState.Provider value={{ config, dimensions }}>
			<div className="cms-block-chart-frame" style={style}>
				<ResponsiveContainer
					width="100%"
					height="100%"
					initialDimension={DEFAULT_CHART_DIMENSIONS}
					onResize={(width, height) => {
						if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
						setDimensions((current) =>
							current.width === width && current.height === height ? current : { width, height },
						);
					}}
				>
					{children}
				</ResponsiveContainer>
			</div>
		</FrameState.Provider>
	);
}

function TooltipContent({
	active,
	payload,
	label,
	hideLabel = false,
	nameKey,
}: {
	active?: boolean;
	payload?: PayloadItem[];
	label?: string | number;
	hideLabel?: boolean;
	nameKey?: string;
}) {
	const { config } = useContext(FrameState);
	if (!active || !payload?.length) return null;
	return (
		<div className="cms-block-chart-tooltip">
			{!hideLabel && label ? (
				<div className="cms-block-chart-tooltip-label">{String(config[String(label)]?.label ?? label)}</div>
			) : null}
			{payload
				.filter((item) => item.type !== "none")
				.map((item) => {
					const key = String(nameKey ? item.payload?.[nameKey] : (item.name ?? item.dataKey ?? "value"));
					const itemConfig = config[key] ?? config[String(item.name ?? item.dataKey ?? "value")];
					return (
						<div key={`${key}-${String(item.value ?? item.color ?? "")}`} className="cms-block-chart-tooltip-row">
							<span className="cms-block-chart-swatch" style={{ backgroundColor: item.color ?? item.payload?.fill }} />
							<span className="cms-block-chart-tooltip-name">{itemConfig?.label ?? key}</span>
							<span className="cms-block-chart-tooltip-value">{formatChartValue(item.value)}</span>
						</div>
					);
				})}
		</div>
	);
}

/** Legend. Reports when its height changes because lines wrap (the pie chart is drawn to fit above the legend). */
function LegendContent({
	payload,
	nameKey,
	onHeightChange,
}: {
	payload?: readonly PayloadItem[];
	nameKey?: string;
	onHeightChange: (height: number) => void;
}) {
	const { config } = useContext(FrameState);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const sync = () => onHeightChange(Math.max(Math.ceil(element.getBoundingClientRect().height), CHART_LEGEND_HEIGHT));
		sync();
		if (typeof ResizeObserver === "undefined") return;
		const observer = new ResizeObserver(sync);
		observer.observe(element);
		return () => observer.disconnect();
	}, [onHeightChange]);

	if (!payload?.length) return null;
	return (
		<div ref={ref} className="cms-block-chart-legend">
			{payload
				.filter((item) => item.type !== "none")
				.map((item) => {
					const key = String(nameKey ? item.payload?.[nameKey] : (item.value ?? item.dataKey ?? "value"));
					const itemConfig = config[key] ?? config[String(item.dataKey ?? "value")];
					return (
						<span key={`${key}-${String(item.color ?? "")}`} className="cms-block-chart-legend-item">
							<span className="cms-block-chart-swatch" style={{ backgroundColor: item.color }} />
							{itemConfig?.label ?? key}
						</span>
					);
				})}
		</div>
	);
}

const CARTESIAN = { bar: BarChart, line: LineChart, area: AreaChart } as const;

/** Value labels (`show values`). */
const valueLabel = (spec: CartesianChartSpec) =>
	spec.options.showValues ? (
		<LabelList
			position="top"
			offset={spec.type === "bar" ? 8 : 10}
			formatter={formatChartValue}
			className="cms-block-chart-value"
		/>
	) : null;

const renderSeries = (spec: CartesianChartSpec) =>
	spec.series.map((series) => {
		const color = `var(--color-${series.key})`;
		if (spec.type === "bar") {
			return (
				<Bar key={series.key} dataKey={series.key} fill={color} radius={8} isAnimationActive={false}>
					{valueLabel(spec)}
				</Bar>
			);
		}
		if (spec.type === "line") {
			return (
				<Line
					key={series.key}
					type="monotone"
					dataKey={series.key}
					stroke={color}
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
				>
					{valueLabel(spec)}
				</Line>
			);
		}
		return (
			<Area
				key={series.key}
				type="monotone"
				dataKey={series.key}
				stroke={color}
				fill={color}
				fillOpacity={0.24}
				isAnimationActive={false}
			>
				{valueLabel(spec)}
			</Area>
		);
	});

function CartesianView({ spec }: { spec: CartesianChartSpec }) {
	const Chart = CARTESIAN[spec.type];
	const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
	return (
		<ChartFrame config={toChartConfig(spec)}>
			<Chart
				accessibilityLayer
				data={spec.data}
				margin={{ top: spec.options.showValues ? 28 : 12, right: 12, left: spec.options.hideYAxis ? 12 : 0, bottom: 0 }}
			>
				{spec.options.hideGrid ? null : <CartesianGrid vertical={false} />}
				<XAxis dataKey={spec.xKey} tickLine={false} tickMargin={10} axisLine={false} />
				<YAxis
					hide={spec.options.hideYAxis}
					width={estimateYAxisWidth(spec)}
					tickLine={false}
					tickMargin={10}
					axisLine={false}
					domain={spec.options.yRange ? [spec.options.yRange.min, spec.options.yRange.max] : undefined}
					allowDataOverflow={!!spec.options.yRange}
				/>
				<Tooltip cursor={false} content={<TooltipContent />} />
				{spec.options.showLegend ? (
					<Legend
						verticalAlign="bottom"
						height={legendHeight}
						content={<LegendContent onHeightChange={setLegendHeight} />}
					/>
				) : null}
				{renderSeries(spec)}
			</Chart>
		</ChartFrame>
	);
}

function ResponsivePie({ spec, legendHeight }: { spec: PieChartSpec; legendHeight: number }) {
	const { dimensions } = useContext(FrameState);
	const geometry = resolvePieGeometry(dimensions, spec.options.showLegend ? legendHeight : 0);
	return (
		<Pie data={spec.data} dataKey={spec.valueKey} nameKey={spec.labelKey} isAnimationActive={false} {...geometry} />
	);
}

function PieView({ spec }: { spec: PieChartSpec }) {
	const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
	return (
		<ChartFrame config={toChartConfig(spec)}>
			<PieChart>
				<Tooltip cursor={false} content={<TooltipContent hideLabel nameKey={spec.labelKey} />} />
				{spec.options.showLegend ? (
					<Legend
						verticalAlign="bottom"
						height={legendHeight}
						content={<LegendContent nameKey={spec.labelKey} onHeightChange={setLegendHeight} />}
					/>
				) : null}
				<ResponsivePie spec={spec} legendHeight={legendHeight} />
			</PieChart>
		</ChartFrame>
	);
}

/** Draws the chart source (`source`). If the syntax is wrong, draws nothing (the server already renders the error box). */
export function ChartView({ source }: { readonly source: string }) {
	const normalized = useMemo(() => normalizeChartDsl(parseChartDsl(source)), [source]);
	const spec = normalized.spec;
	if (!spec) return null;
	return (
		<figure className="cms-block-chart" data-state="ready">
			{spec.type === "pie" ? <PieView spec={spec} /> : <CartesianView spec={spec} />}
		</figure>
	);
}
