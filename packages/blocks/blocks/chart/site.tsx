import type { BlockProps } from "@monti-cms/core/render";
import { normalizeChartDsl, parseChartDsl } from "./dsl";
import { style } from "./style";
import { type CartesianChartSpec, chartColor, type NormalizedChartSpec, type PieChartSpec } from "./types";

const W = 640;
const H = 320;
const PAD = { top: 20, right: 16, bottom: 36, left: 48 };

/** Round steps for the value axis: 1, 2 or 5 times a power of ten, about five of them from 0 (or the lowest value below 0) to the highest. */
function ticks(low: number, high: number): number[] {
	const from = Math.min(0, low);
	const to = Math.max(0, high) || 1;
	const raw = (to - from) / 5;
	const power = 10 ** Math.floor(Math.log10(raw));
	const step = ([1, 2, 5, 10].find((each) => each * power >= raw) ?? 10) * power;
	const out: number[] = [];
	for (let at = Math.floor(from / step) * step; at <= to + step / 2; at += step) out.push(Number(at.toPrecision(12)));
	return out;
}

const numberOf = (value: unknown) => (typeof value === "number" ? value : Number(value));

/** Bars, lines or areas of each series over the x field's points, with the options the chart's text gives (values, grid, y-axis, y-range). */
function Cartesian({ spec }: { spec: CartesianChartSpec }) {
	const values = spec.data.flatMap((row) => spec.series.map((series) => numberOf(row[series.key])));
	const marks = spec.options.yRange
		? ticks(spec.options.yRange.min, spec.options.yRange.max).filter(
				(mark) => mark >= (spec.options.yRange?.min ?? 0) && mark <= (spec.options.yRange?.max ?? 0),
			)
		: ticks(Math.min(...values, 0), Math.max(...values, 0));
	const low = spec.options.yRange?.min ?? marks[0] ?? 0;
	const high = spec.options.yRange?.max ?? marks.at(-1) ?? 1;
	const left = spec.options.hideYAxis ? 12 : PAD.left;
	const plotW = W - left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;
	const y = (value: number) =>
		PAD.top + plotH - ((Math.min(Math.max(value, low), high) - low) / (high - low || 1)) * plotH;
	const band = plotW / Math.max(1, spec.data.length);
	const x = (index: number) => left + band * index + band / 2;
	const label = (value: number, px: number, py: number) =>
		spec.options.showValues ? (
			<text className="monti-block-chart-value" x={px} y={py - 6} textAnchor="middle">
				{value.toLocaleString()}
			</text>
		) : null;
	return (
		<>
			{marks.map((mark) => (
				<g key={mark}>
					{spec.options.hideGrid ? null : (
						<line className="monti-block-chart-grid" x1={left} x2={W - PAD.right} y1={y(mark)} y2={y(mark)} />
					)}
					{spec.options.hideYAxis ? null : (
						<text className="monti-block-chart-tick" x={left - 8} y={y(mark) + 4} textAnchor="end">
							{mark.toLocaleString()}
						</text>
					)}
				</g>
			))}
			{spec.data.map((row, index) => (
				<text
					// biome-ignore lint/suspicious/noArrayIndexKey: two points may share a name; they are told apart by place
					key={index}
					className="monti-block-chart-tick"
					x={x(index)}
					y={H - PAD.bottom + 18}
					textAnchor="middle"
				>
					{String(row[spec.xKey] ?? "")}
				</text>
			))}
			{spec.type === "bar"
				? spec.series.map((series, at) => {
						const width = (band * 0.7) / spec.series.length;
						return spec.data.map((row, index) => {
							const value = numberOf(row[series.key]);
							const px = left + band * index + band * 0.15 + width * at;
							return (
								<g key={`${series.key}:${index}`}>
									<rect
										x={px}
										y={Math.min(y(value), y(0))}
										width={Math.max(1, width - 2)}
										height={Math.abs(y(value) - y(0))}
										rx={4}
										fill={chartColor(series.colorToken)}
									>
										<title>{`${series.label} · ${String(row[spec.xKey] ?? "")}: ${value.toLocaleString()}`}</title>
									</rect>
									{label(value, px + width / 2, Math.min(y(value), y(0)))}
								</g>
							);
						});
					})
				: spec.series.map((series) => {
						const points = spec.data.map((row, index) => [x(index), y(numberOf(row[series.key]))] as const);
						const line = points.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px},${py}`).join(" ");
						const first = points[0] ?? [left, y(0)];
						const last = points.at(-1) ?? first;
						return (
							<g key={series.key}>
								{spec.type === "area" ? (
									<path
										d={`${line} L${last[0]},${y(0)} L${first[0]},${y(0)} Z`}
										fill={chartColor(series.colorToken)}
										opacity={0.24}
									/>
								) : null}
								<path d={line} fill="none" stroke={chartColor(series.colorToken)} strokeWidth={2} />
								{spec.data.map((row, index) =>
									label(numberOf(row[series.key]), x(index), y(numberOf(row[series.key]))),
								)}
							</g>
						);
					})}
		</>
	);
}

/** A pie of the value field, one slice per row, in order from the top, clockwise. */
function Pie({ spec }: { spec: PieChartSpec }) {
	const values = spec.data.map((row) => Math.max(0, numberOf(row[spec.valueKey])));
	const total = values.reduce((sum, value) => sum + value, 0);
	if (total === 0) return null;
	const cx = W / 2;
	const cy = H / 2;
	const r = H / 2 - 16;
	let angle = -Math.PI / 2;
	return (
		<>
			{values.map((value, index) => {
				if (value === 0) return null;
				const start = angle;
				angle += (value / total) * Math.PI * 2;
				const point = (at: number) => `${cx + r * Math.cos(at)},${cy + r * Math.sin(at)}`;
				const d =
					value === total
						? `M${cx - r},${cy} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`
						: `M${cx},${cy} L${point(start)} A${r},${r} 0 ${angle - start > Math.PI ? 1 : 0},1 ${point(angle)} Z`;
				return (
					// biome-ignore lint/suspicious/noArrayIndexKey: slices in the data's order
					<path key={index} d={d} fill={`var(--monti-chart-${(index % 5) + 1}, var(--chart-${(index % 5) + 1}))`}>
						<title>{`${String(spec.data[index]?.[spec.labelKey] ?? "")}: ${value.toLocaleString()}`}</title>
					</path>
				);
			})}
		</>
	);
}

/** The legend: each series (each slice of a pie) by its name and colour. */
function Legend({ spec }: { spec: NormalizedChartSpec }) {
	const items =
		spec.type === "pie"
			? spec.data.map((row, index) => ({
					name: String(row[spec.labelKey] ?? ""),
					color: `var(--monti-chart-${(index % 5) + 1}, var(--chart-${(index % 5) + 1}))`,
				}))
			: spec.series.map((series) => ({ name: series.label, color: chartColor(series.colorToken) }));
	if (items.length < 2) return null;
	return (
		<ul className="monti-block-chart-legend">
			{items.map((item, index) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: two series may share a name
				<li key={index}>
					<span className="monti-block-chart-swatch" style={{ background: item.color }} />
					{item.name}
				</li>
			))}
		</ul>
	);
}

/**
 * A chart (` ```chart `): the old block's text read by its own parser (`dsl.ts`) and drawn on the server as SVG, with no script. Text that does not
 * read stays its source on the page; the editor says why under its field, and the publish to-do list too.
 */
export function Chart({ attrs }: BlockProps) {
	const source = typeof attrs.source === "string" ? attrs.source : "";
	if (source.trim() === "") return null;
	const { spec } = normalizeChartDsl(parseChartDsl(source));
	return (
		<figure className="monti-block-chart" data-kind={spec?.type}>
			<style href="monti-block-chart" precedence="monti-blocks">
				{style}
			</style>
			{spec ? (
				<>
					<Legend spec={spec} />
					<svg className="monti-block-chart-frame" viewBox={`0 0 ${W} ${H}`} role="img">
						<title>
							{spec.type === "pie"
								? spec.data.map((row) => String(row[spec.labelKey] ?? "")).join(", ")
								: spec.series.map((series) => series.label).join(", ")}
						</title>
						{spec.type === "pie" ? <Pie spec={spec} /> : <Cartesian spec={spec} />}
					</svg>
				</>
			) : (
				<pre className="monti-block-chart-source">
					<code>{source}</code>
				</pre>
			)}
		</figure>
	);
}
