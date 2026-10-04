"use client";

import { Alert, AlertDescription, AlertTitle, cn } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { AlertOctagon } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	Line,
	LineChart,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { chartErrorLine } from "./errors";
import { estimateYAxisWidth, formatChartValue, toChartConfig } from "./helpers";
import { CHART_LEGEND_HEIGHT, resolvePieGeometry } from "./layout";
import { chartMessages } from "./messages";
import type { CartesianChartSpec, ChartRenderError, PieChartSpec } from "./types";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	useChartDimensions,
} from "./ui";

/**
 * 차트 블록의 기본 편집기 미리보기. 차트 문법(`./dsl`)을 recharts로 그린다(선택 의존성 `recharts`). 차트 블록 확장의 관리자
 * 공급자가 `fencePreviews.chart`로 미리보기를 열 때만 불러온다. 사이트는 같은 이름으로 자기 렌더러를 넣어 바꿀 수 있다.
 * 색은 계열의 테마 변수(`--chart-1`~`--chart-5`)다.
 */

const t = createTranslator(chartMessages);

function ChartErrorCard({ errors }: { errors: ChartRenderError[] }) {
	return (
		<div className="not-prose my-6">
			<Alert variant="danger">
				<AlertOctagon />
				<AlertTitle>{t("error.title")}</AlertTitle>
				<AlertDescription>
					<ul className="ml-4 list-disc space-y-1">
						{errors.map((error) => (
							<li key={`${error.line}-${error.code}-${JSON.stringify(error.values ?? {})}`}>
								{chartErrorLine(error, t)}
							</li>
						))}
					</ul>
				</AlertDescription>
			</Alert>
		</div>
	);
}

const CARTESIAN = { bar: BarChart, line: LineChart, area: AreaChart } as const;

const VALUE_LABEL_CLASS = "fill-cms-foreground font-medium text-[11px]";

/** 값 글자(`show values`). */
const valueLabel = (spec: CartesianChartSpec) =>
	spec.options.showValues ? (
		<LabelList
			position="top"
			offset={spec.type === "bar" ? 8 : 10}
			formatter={formatChartValue}
			className={VALUE_LABEL_CLASS}
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

function ResponsivePie({ spec, legendHeight }: { spec: PieChartSpec; legendHeight: number }) {
	const geometry = resolvePieGeometry(useChartDimensions(), spec.options.showLegend ? legendHeight : 0);
	return (
		<Pie data={spec.data} dataKey={spec.valueKey} nameKey={spec.labelKey} isAnimationActive={false} {...geometry} />
	);
}

function CartesianPreview({ spec, className }: { spec: CartesianChartSpec; className?: string }) {
	const Chart = CARTESIAN[spec.type];
	const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
	return (
		<ChartContainer config={toChartConfig(spec)} className={cn("not-prose my-6 w-full min-w-0", className)}>
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
				<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
				{spec.options.showLegend ? (
					<ChartLegend
						verticalAlign="bottom"
						height={legendHeight}
						content={<ChartLegendContent onHeightChange={setLegendHeight} />}
					/>
				) : null}
				{renderSeries(spec)}
			</Chart>
		</ChartContainer>
	);
}

function PiePreview({ spec, className }: { spec: PieChartSpec; className?: string }) {
	const [legendHeight, setLegendHeight] = useState(CHART_LEGEND_HEIGHT);
	return (
		<ChartContainer config={toChartConfig(spec)} className={cn("not-prose my-6 w-full min-w-0", className)}>
			<PieChart>
				<ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey={spec.labelKey} />} />
				{spec.options.showLegend ? (
					<ChartLegend
						verticalAlign="bottom"
						height={legendHeight}
						content={<ChartLegendContent nameKey={spec.labelKey} onHeightChange={setLegendHeight} />}
					/>
				) : null}
				<ResponsivePie spec={spec} legendHeight={legendHeight} />
			</PieChart>
		</ChartContainer>
	);
}

/** 차트 원문(`source`)을 그린다. 문법 오류면 줄마다 알린다. */
export function ChartPreview({ source, className }: { readonly source: string; readonly className?: string }) {
	const normalized = useMemo(() => normalizeChartDsl(parseChartDsl(source)), [source]);
	if (!normalized.spec) return <ChartErrorCard errors={normalized.errors} />;
	return normalized.spec.type === "pie" ? (
		<PiePreview spec={normalized.spec} className={className} />
	) : (
		<CartesianPreview spec={normalized.spec} className={className} />
	);
}
