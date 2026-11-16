/**
 * The look Mermaid draws with (doc 18): its own `base` theme, every colour and the font read from the page's own look (the text colour, the ground
 * under the diagram, the blocks' accent and series colours of `style.ts`), so a diagram is the site's, in light and dark, and never Mermaid's
 * lilac. Read again whenever the diagram is drawn, so a theme change repaints it. A text and the fill it stands on are made together: no pair is under
 * 4.5:1, and a fill that stands alone against the page (a slice, a bar's edge) is 3:1 or more.
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

const luminance = ([r, g, b]: Rgb) => {
	const [lr, lg, lb] = [r, g, b].map((value) => {
		const channel = value / 255;
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

/** The WCAG contrast ratio of two colours. */
export const contrastOf = (a: Rgb, b: Rgb) => {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high + 0.05) / (low + 0.05);
};

/** `fill` moved toward `away` in small steps until `text` reads on it at `least`:1 (the fill is made for its text, never chosen blind of it). */
export function fitFill(fill: Rgb, text: Rgb, away: Rgb, least = 4.5): Rgb {
	for (let step = 0; step <= 20; step++) {
		const moved = mixColors(away, fill, step / 20);
		if (contrastOf(text, moved) >= least) return moved;
	}
	return away;
}

/** Hue (0 to 360), saturation and lightness (0 to 1) of a colour, and back. */
export function toHsl([r, g, b]: Rgb): [number, number, number] {
	const [x, y, z] = [r / 255, g / 255, b / 255];
	const high = Math.max(x, y, z);
	const low = Math.min(x, y, z);
	const light = (high + low) / 2;
	if (high === low) return [0, 0, light];
	const span = high - low;
	const sat = light > 0.5 ? span / (2 - high - low) : span / (high + low);
	const hue = high === x ? (y - z) / span + (y < z ? 6 : 0) : high === y ? (z - x) / span + 2 : (x - y) / span + 4;
	return [hue * 60, sat, light];
}
export function fromHsl([hue, sat, light]: readonly [number, number, number]): Rgb {
	const chroma = (1 - Math.abs(2 * light - 1)) * sat;
	const part = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
	const [r, g, b] =
		hue < 60
			? [chroma, part, 0]
			: hue < 120
				? [part, chroma, 0]
				: hue < 180
					? [0, chroma, part]
					: hue < 240
						? [0, part, chroma]
						: hue < 300
							? [part, 0, chroma]
							: [chroma, 0, part];
	const match = light - chroma / 2;
	return [(r + match) * 255, (g + match) * 255, (b + match) * 255];
}

/**
 * `fill` made to carry `text` at `least`:1 by moving its lightness only, so it keeps its hue and its saturation (a green slice stays green, not olive): toward
 * lighter when the text is dark, darker when the text is light. Returns the fill and how far it moved.
 */
export function fitLightness(fill: Rgb, text: Rgb, least = 4.5): { fill: Rgb; moved: number } {
	const [hue, sat, light] = toHsl(fill);
	const direction = luminance(text) < luminance(fill) ? 1 : -1;
	for (let step = 0; step <= 100; step++) {
		const next = Math.min(1, Math.max(0, light + (direction * step) / 100));
		const moved = fromHsl([hue, sat, next]);
		if (contrastOf(text, moved) >= least) return { fill: moved, moved: step / 100 };
	}
	return { fill: fromHsl([hue, sat, direction > 0 ? 1 : 0]), moved: 1 };
}

let canvas: CanvasRenderingContext2D | null | undefined;
/** The colour the canvas is set to before a value is tried: a value it does not take leaves it, which tells a refused value from a real colour. */
const UNSET = "#010203";

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
	canvas.fillStyle = UNSET;
	canvas.fillStyle = value;
	if (canvas.fillStyle === UNSET && value.trim().toLowerCase() !== UNSET) return null;
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

/** What the look reads from the page, as one word: a diagram is drawn again when it changes (a theme switch of the site's own, the system's setting). */
export function lookKey(element: HTMLElement, dark: boolean): string {
	const style = getComputedStyle(element);
	return [
		dark,
		style.color,
		style.fontFamily,
		toHex(groundOf(element, dark)),
		style.getPropertyValue("--monti-block-accent"),
	].join("|");
}

/** What Mermaid is initialised with for a diagram drawn in `element`. */
export function mermaidLook(element: HTMLElement, dark: boolean) {
	const style = getComputedStyle(element);
	const ground = groundOf(element, dark);
	const ink: Rgb = pixelOf(style.color)?.rgb ?? (dark ? [236, 235, 230] : [28, 27, 24]);
	const text = toHex(ink);
	/** A fill of `amount` of the text colour over the ground, with the text made to read on it. */
	const tone = (amount: number) => toHex(fitFill(mixColors(ink, ground, amount), ink, ground));
	/** The colour of a line or an edge that stands alone against the page: 3:1 or more. */
	const edge = (amount: number) => toHex(fitFill(mixColors(ink, ground, amount), ground, ink, 3));
	const property = (name: string, fallback: Rgb): Rgb => pixelOf(style.getPropertyValue(name))?.rgb ?? fallback;
	const accent = fitFill(property("--monti-block-accent", mixColors(ink, ground, 0.7)), ground, ink, 3);
	// The slices keep their hue: each series colour has its lightness moved until the label reads on it, and the label is the page's text colour or its ground,
	// whichever moves the five slices less. The slices are told apart from the page by their outline (`pieStrokeColor`), not by a darker fill.
	const slices = [1, 2, 3, 4, 5].map((at) => property(`--chart-${at}`, mixColors(ink, ground, 0.3 + at / 10)));
	const fitted = [ink, ground].map((label) => {
		const each = slices.map((slice) => fitLightness(slice, label));
		return { label, fills: each.map((one) => one.fill), moved: each.reduce((sum, one) => sum + one.moved, 0) };
	});
	const pie = fitted[0].moved <= fitted[1].moved ? fitted[0] : fitted[1];
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
			primaryBorderColor: edge(0.45),
			secondaryColor: tone(0.1),
			secondaryTextColor: text,
			secondaryBorderColor: edge(0.45),
			tertiaryColor: tone(0.03),
			tertiaryTextColor: text,
			tertiaryBorderColor: edge(0.3),
			lineColor: edge(0.6),
			// The label on a line sits on the page's own ground, so it reads as the line's words and hides nothing under them.
			edgeLabelBackground: toHex(ground),
			clusterBkg: tone(0.03),
			clusterBorder: edge(0.3),
			noteBkgColor: tone(0.1),
			noteTextColor: text,
			noteBorderColor: edge(0.3),
			titleColor: text,
			gridColor: tone(0.15),
			todayLineColor: toHex(accent),
			// Every bar is a light tone of the text colour with the text colour on it: the open task is told by its accent edge, the critical one by a strong edge.
			taskBkgColor: tone(0.1),
			taskBorderColor: edge(0.45),
			taskTextColor: text,
			taskTextLightColor: text,
			taskTextDarkColor: text,
			taskTextOutsideColor: text,
			taskTextClickableColor: text,
			activeTaskBkgColor: tone(0.2),
			activeTaskBorderColor: toHex(accent),
			doneTaskBkgColor: tone(0.15),
			doneTaskBorderColor: edge(0.45),
			critBorderColor: edge(0.9),
			critBkgColor: tone(0.3),
			sectionBkgColor: tone(0.06),
			altSectionBkgColor: tone(0.03),
			sectionBkgColor2: tone(0.1),
			pie1: toHex(pie.fills[0]),
			pie2: toHex(pie.fills[1]),
			pie3: toHex(pie.fills[2]),
			pie4: toHex(pie.fills[3]),
			pie5: toHex(pie.fills[4]),
			pieStrokeColor: edge(0.6),
			pieOuterStrokeColor: edge(0.3),
			pieTitleTextColor: text,
			pieSectionTextColor: toHex(pie.label),
			pieLegendTextColor: text,
		},
		// A schedule's letters are the diagram's smallest: never under 12px.
		gantt: { fontSize: 12, sectionFontSize: 12, barHeight: 24 },
	};
}
