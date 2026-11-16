/**
 * The look Mermaid draws with (doc 18): its own `base` theme, every colour and the font read from the page's own look (the text colour, the ground
 * under the diagram, the blocks' accent and series colours of `style.ts`), so a diagram is the site's, in light and dark, and never Mermaid's
 * lilac. Read again whenever the diagram is drawn, so a theme change repaints it.
 */

/** A colour as `[red, green, blue]`, 0 to 255. */
export type Rgb = readonly [number, number, number];

const hex = (value: number) =>
	Math.max(0, Math.min(255, Math.round(value)))
		.toString(16)
		.padStart(2, "0");

/** `#rrggbb`: the one form Mermaid's colour maths always reads. */
export const toHex = ([r, g, b]: Rgb) => `#${hex(r)}${hex(g)}${hex(b)}`;

/** `amount` of `top` over `ground` (0 is the ground, 1 is the top). */
export const mixColors = (top: Rgb, ground: Rgb, amount: number): Rgb => [
	ground[0] + (top[0] - ground[0]) * amount,
	ground[1] + (top[1] - ground[1]) * amount,
	ground[2] + (top[2] - ground[2]) * amount,
];

let canvas: CanvasRenderingContext2D | null | undefined;

/** Any CSS colour (`oklch(…)`, `color-mix(…)`, a name) as its red, green, blue and opacity, read back from a pixel; `null` when it is not a colour. */
function pixelOf(value: string): { rgb: Rgb; alpha: number } | null {
	if (canvas === undefined) {
		const element = document.createElement("canvas");
		element.width = 1;
		element.height = 1;
		canvas = element.getContext("2d", { willReadFrequently: true });
	}
	if (!canvas || !value.trim()) return null;
	canvas.clearRect(0, 0, 1, 1);
	canvas.fillStyle = "#000000";
	canvas.fillStyle = value;
	canvas.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data;
	return { rgb: [r, g, b], alpha: a / 255 };
}

/** The colour under a diagram: the nearest ancestor with a solid ground, else white (light) or near black (dark). */
function groundOf(element: HTMLElement, dark: boolean): Rgb {
	for (let at: HTMLElement | null = element; at; at = at.parentElement) {
		const found = pixelOf(getComputedStyle(at).backgroundColor);
		if (found && found.alpha > 0.99) return found.rgb;
	}
	return dark ? [20, 20, 20] : [255, 255, 255];
}

/** What Mermaid is initialised with for a diagram drawn in `element`. */
export function mermaidLook(element: HTMLElement, dark: boolean) {
	const style = getComputedStyle(element);
	const ink: Rgb = pixelOf(style.color)?.rgb ?? (dark ? [236, 235, 230] : [28, 27, 24]);
	const ground = groundOf(element, dark);
	const text = toHex(ink);
	const tone = (amount: number) => toHex(mixColors(ink, ground, amount));
	const property = (name: string, fallback: Rgb) => toHex(pixelOf(style.getPropertyValue(name))?.rgb ?? fallback);
	const accent = property("--monti-block-accent", mixColors(ink, ground, 0.7));
	const series = [1, 2, 3, 4, 5].map((at) => property(`--chart-${at}`, mixColors(ink, ground, 0.3 + at / 10)));
	return {
		theme: "base" as const,
		themeVariables: {
			darkMode: dark,
			fontFamily: style.fontFamily,
			fontSize: "14px",
			background: toHex(ground),
			textColor: text,
			primaryColor: tone(0.06),
			primaryTextColor: text,
			primaryBorderColor: tone(0.45),
			secondaryColor: tone(0.1),
			secondaryTextColor: text,
			secondaryBorderColor: tone(0.45),
			tertiaryColor: tone(0.03),
			tertiaryTextColor: text,
			tertiaryBorderColor: tone(0.3),
			lineColor: tone(0.6),
			// The label on a line sits on the page's own ground, so it reads as the line's words and hides nothing under them.
			edgeLabelBackground: toHex(ground),
			clusterBkg: tone(0.03),
			clusterBorder: tone(0.3),
			noteBkgColor: tone(0.1),
			noteTextColor: text,
			noteBorderColor: tone(0.3),
			titleColor: text,
			gridColor: tone(0.15),
			todayLineColor: accent,
			taskBkgColor: tone(0.1),
			taskBorderColor: tone(0.45),
			taskTextColor: text,
			taskTextDarkColor: text,
			taskTextOutsideColor: text,
			activeTaskBkgColor: accent,
			activeTaskBorderColor: accent,
			doneTaskBkgColor: tone(0.2),
			doneTaskBorderColor: tone(0.45),
			critBorderColor: tone(0.9),
			critBkgColor: tone(0.3),
			sectionBkgColor: tone(0.06),
			altSectionBkgColor: tone(0.03),
			sectionBkgColor2: tone(0.1),
			pie1: series[0],
			pie2: series[1],
			pie3: series[2],
			pie4: series[3],
			pie5: series[4],
			pieStrokeColor: toHex(ground),
			pieOuterStrokeColor: tone(0.3),
			pieTitleTextColor: text,
			pieSectionTextColor: toHex(ground),
			pieLegendTextColor: text,
		},
		// A schedule's letters are the diagram's smallest: never under 12px.
		gantt: { fontSize: 12, barHeight: 24 },
	};
}
