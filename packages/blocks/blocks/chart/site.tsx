import type { BlockProps } from "@monti-cms/core/render";
import type { ReactNode } from "react";
import { type ChartData, type ChartKind, chartData, KINDS } from "./data";

/** The chart's own words, in the entry's language (English when the site gives none). The site's own: change them. */
const WORDS: Record<string, { data: string }> = {
	en: { data: "See the data" },
	ko: { data: "자료 보기" },
	ja: { data: "データを見る" },
};
const wordsIn = (locale?: string) => WORDS[(locale ?? "").toLowerCase().split(/[-_]/)[0] ?? ""] ?? WORDS.en;

const W = 640;
const H = 320;
const PAD = { top: 16, right: 16, bottom: 36, left: 48 };
/** A series' colour: the site's `--chart-1` … `--chart-5`, again from the first after the fifth. */
const colour = (index: number) => `var(--chart-${(index % 5) + 1})`;

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

function Cartesian({ data, kind }: { data: ChartData; kind: Exclude<ChartKind, "pie"> }) {
	const values = data.series.flatMap((series) => series.values).filter((value): value is number => value !== null);
	const marks = ticks(Math.min(...values, 0), Math.max(...values, 0));
	const low = marks[0] ?? 0;
	const high = marks.at(-1) ?? 1;
	const plotW = W - PAD.left - PAD.right;
	const plotH = H - PAD.top - PAD.bottom;
	const y = (value: number) => PAD.top + plotH - ((value - low) / (high - low || 1)) * plotH;
	const band = plotW / Math.max(1, data.categories.length);
	const x = (index: number) => PAD.left + band * index + band / 2;
	return (
		<>
			{marks.map((mark) => (
				<g key={mark}>
					<line className="monti-block-chart-grid" x1={PAD.left} x2={W - PAD.right} y1={y(mark)} y2={y(mark)} />
					<text className="monti-block-chart-tick" x={PAD.left - 8} y={y(mark) + 4} textAnchor="end">
						{mark.toLocaleString()}
					</text>
				</g>
			))}
			{data.categories.map((name, index) => (
				<text
					// biome-ignore lint/suspicious/noArrayIndexKey: two points may share a name; they are told apart by place
					key={index}
					className="monti-block-chart-tick"
					x={x(index)}
					y={H - PAD.bottom + 18}
					textAnchor="middle"
				>
					{name}
				</text>
			))}
			{kind === "bar"
				? data.series.map((series, at) => {
						const width = (band * 0.7) / data.series.length;
						return series.values.map((value, index) =>
							value === null ? null : (
								<rect
									// biome-ignore lint/suspicious/noArrayIndexKey: one bar per series and point, in the table's order
									key={`${at}:${index}`}
									x={PAD.left + band * index + band * 0.15 + width * at}
									y={Math.min(y(value), y(0))}
									width={Math.max(1, width - 2)}
									height={Math.abs(y(value) - y(0))}
									rx={2}
									fill={colour(at)}
								>
									<title>{`${series.name} · ${data.categories[index] ?? ""}: ${value.toLocaleString()}`}</title>
								</rect>
							),
						);
					})
				: data.series.map((series, at) => {
						// A gap (an empty or not-a-number cell) breaks the line.
						const runs: [number, number][][] = [[]];
						series.values.forEach((value, index) => {
							if (value === null) runs.push([]);
							else runs.at(-1)?.push([x(index), y(value)]);
						});
						return runs
							.filter((run) => run.length > 0)
							.map((run, part) => {
								const line = run.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px},${py}`).join(" ");
								const first = run[0] as [number, number];
								const last = run.at(-1) as [number, number];
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: the parts of one line, in order
									<g key={`${at}:${part}`}>
										{kind === "area" ? (
											<path d={`${line} L${last[0]},${y(0)} L${first[0]},${y(0)} Z`} fill={colour(at)} opacity={0.18} />
										) : null}
										<path d={line} fill="none" stroke={colour(at)} strokeWidth={2} />
										{run.map(([px, py]) => (
											<circle key={`${px}`} cx={px} cy={py} r={3} fill={colour(at)} />
										))}
									</g>
								);
							});
					})}
		</>
	);
}

/** A pie of the first series: its slices in order from the top, clockwise. Values at or below 0 are no slice. */
function Pie({ data }: { data: ChartData }) {
	const values = (data.series[0]?.values ?? []).map((value) => Math.max(0, value ?? 0));
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
					// biome-ignore lint/suspicious/noArrayIndexKey: slices in the table's order
					<path key={index} d={d} fill={colour(index)}>
						<title>{`${data.categories[index] ?? ""}: ${value.toLocaleString()}`}</title>
					</path>
				);
			})}
		</>
	);
}

/**
 * A chart, drawn on the server as SVG from the table it holds (doc 18): bars, lines, areas, or a pie of the first series. The table itself stays in
 * the page under "See the data", so the numbers are there for a reader who cannot see the picture, a search engine and a feed.
 */
export function Chart({ block, attrs, locale, children }: BlockProps & { children?: ReactNode }) {
	const kind = KINDS.find((each) => each === attrs.kind) ?? "bar";
	const data = chartData(block);
	const title = typeof attrs.title === "string" ? attrs.title.trim() : "";
	const named = kind === "pie" ? data.categories : data.series.map((series) => series.name);
	const drawable = data.categories.length > 0 && data.series.length > 0;
	return (
		<figure className="monti-block-chart" data-kind={kind}>
			{title ? <figcaption className="monti-block-chart-title">{title}</figcaption> : null}
			{drawable ? (
				<>
					{named.length > 1 ? (
						<ul className="monti-block-chart-legend">
							{named.map((name, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: two series may share a name
								<li key={index}>
									<span className="monti-block-chart-swatch" style={{ background: colour(index) }} />
									{name}
								</li>
							))}
						</ul>
					) : null}
					<svg
						className="monti-block-chart-frame"
						viewBox={`0 0 ${W} ${H}`}
						role="img"
						aria-label={title || named.join(", ")}
					>
						{kind === "pie" ? <Pie data={data} /> : <Cartesian data={data} kind={kind} />}
					</svg>
				</>
			) : null}
			<details className="monti-block-chart-data">
				<summary>{wordsIn(locale).data}</summary>
				{children}
			</details>
		</figure>
	);
}
