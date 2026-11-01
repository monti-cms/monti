import type { Page } from "@playwright/test";

/** One thing a check found: which check, and where on the page. */
export interface Finding {
	readonly check: "overflow" | "clipped" | "type" | "mono" | "icon" | "center";
	readonly detail: string;
}

/**
 * The automated checks, run on the page of every story, in both themes (`audit.spec.ts`):
 * - overflow: the page scrolls sideways;
 * - clipped: an element hides part of its own text (`overflow: hidden` or `clip`, more content than room) without a `text-overflow: ellipsis` or a
 *   line clamp that says the cut is meant;
 * - type: an element that carries a `text-monti-<role>` type class does not compute to that role's font size. Line height and weight are left out: a part sets
 *   them on purpose (`leading-none` in a marker, `font-semibold` in a button). An element whose role changes under a variant is left out too
 *   (these three: {@link findBoxProblems});
 * - mono: mono and sans trade places: an element that asks for fixed-width letters (`font-mono`, or the `text-monti-meta` and `text-monti-micro` roles) computes
 *   another face, or an element with a sans role and no `font-mono` computes mono (see {@link findWrongMono});
 * - icon: a button, link or tab that holds an icon and visible text puts them on different lines (see {@link findSplitIcons});
 * - center: the text of a fixed-height single-line control (a button, chip, tab, menu row, status bar cell) sits off the vertical center of its box
 *   (see {@link findOffCenterText}).
 *
 * Each check is two halves. A `measure*` function runs in the page and returns what the browser laid out, as plain values: it holds no outside
 * reference, since Playwright sends its source to the page. A `find*` function decides from those values alone, so its cases are tested without a
 * browser (`src/__test__/visual-checks.test.ts`), and one browser test per check sees that the measuring reads a real page.
 */
export const runPageChecks = async (page: Page): Promise<Finding[]> => [
	...findBoxProblems(await page.evaluate(measureBoxes)),
	...findWrongMono(await page.evaluate(measureMono)),
	...findSplitIcons(await page.evaluate(measureIcons)),
	...findOffCenterText(await page.evaluate(measureCenter)),
];

/** An element as a finding names it: its tag, its class names and the start of its text. */
export interface Named {
	readonly tag: string;
	readonly classes: readonly string[];
	/** The text, trimmed, with runs of white space as one space, cut to 32 characters. */
	readonly text: string;
}

/** Whether an element is drawn, as the page computed it. */
export interface Drawn {
	readonly display: string;
	readonly visibility: string;
	readonly width: number;
	readonly height: number;
}

/** A box on the page, in px from the top of the window. */
export interface Box {
	readonly top: number;
	readonly bottom: number;
	readonly width: number;
	readonly height: number;
}

/** `<button.a.b.c.d> "Save"`: the first four class names and the start of the text. */
const nameOf = ({ tag, classes, text }: Named) => {
	const cls = classes.filter(Boolean).slice(0, 4).join(".");
	return `<${tag}${cls ? `.${cls}` : ""}> "${text}"`;
};

/** Shown: displayed, visible, and bigger than the 1px box of a screen-reader label. */
const isShown = (drawn: Drawn) =>
	drawn.display !== "none" && drawn.visibility !== "hidden" && drawn.width > 1 && drawn.height > 1;

/** The first family of a `font-family` value, without quotes. */
const firstFamily = (value: string) => (value.split(",")[0] ?? "").replace(/["']/g, "").trim();

// ---------------------------------------------------------------------------------------------------------------------------------------------
// overflow, clipped, type

/** What the box checks read from the page. */
export interface BoxMeasures {
	/** The document's `scrollWidth` and `clientWidth`. */
	readonly page: { readonly scrollWidth: number; readonly clientWidth: number };
	/** Every element whose `overflow-x` or `overflow-y` is not `visible`. */
	readonly cutting: readonly (Named &
		Drawn & {
			readonly overflowX: string;
			readonly overflowY: string;
			readonly textOverflow: string;
			/** The computed `-webkit-line-clamp` (`none` when there is none). */
			readonly lineClamp: string;
			readonly scrollWidth: number;
			readonly scrollHeight: number;
			readonly clientWidth: number;
			readonly clientHeight: number;
		})[];
	/** Every element with a `text-monti-` class. */
	readonly typed: readonly (Named & {
		readonly fontSize: string;
		/** The class names of its ancestors that hold `text-monti-`. */
		readonly inherited: readonly string[];
	})[];
	/** The computed size of each type role a `text-monti-<name>` class names, by name, or `null` when no `--monti-text-<name>-size` token exists. */
	readonly roleSizes: Readonly<Record<string, string | null>>;
}

/** Runs in the page: the measures of {@link findBoxProblems}. */
export const measureBoxes = (): BoxMeasures => {
	const named = (el: Element) => ({
		tag: el.tagName.toLowerCase(),
		classes: (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
		text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32),
	});
	const root = document.documentElement;
	const cutting: BoxMeasures["cutting"][number][] = [];
	const typed: BoxMeasures["typed"][number][] = [];
	for (const el of document.body.querySelectorAll("*")) {
		const style = getComputedStyle(el);
		if (style.overflowX === "visible" && style.overflowY === "visible") continue;
		const box = el.getBoundingClientRect();
		cutting.push({
			...named(el),
			display: style.display,
			visibility: style.visibility,
			width: box.width,
			height: box.height,
			overflowX: style.overflowX,
			overflowY: style.overflowY,
			textOverflow: style.textOverflow,
			lineClamp: style.getPropertyValue("-webkit-line-clamp"),
			scrollWidth: el.scrollWidth,
			scrollHeight: el.scrollHeight,
			clientWidth: el.clientWidth,
			clientHeight: el.clientHeight,
		});
	}
	const roleNames = new Set<string>();
	for (const el of document.body.querySelectorAll('[class*="text-monti-"]')) {
		const inherited: string[] = [];
		for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement)
			for (const name of (ancestor.getAttribute("class") ?? "").split(/\s+/))
				if (name.includes("text-monti-")) inherited.push(name);
		const entry = { ...named(el), fontSize: getComputedStyle(el).fontSize, inherited };
		for (const name of entry.classes)
			if (name.startsWith("text-monti-")) roleNames.add(name.slice("text-monti-".length));
		typed.push(entry);
	}
	// A type role is a class whose size is a design token (`--monti-text-<role>-size`); a color class like `text-monti-muted` is not.
	const probe = document.createElement("div");
	probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
	document.body.append(probe);
	const roleSizes: Record<string, string | null> = {};
	for (const role of roleNames) {
		probe.style.fontSize = `var(--monti-text-${role}-size)`;
		roleSizes[role] = getComputedStyle(root).getPropertyValue(`--monti-text-${role}-size`)
			? getComputedStyle(probe).fontSize
			: null;
	}
	probe.remove();
	return { page: { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }, cutting, typed, roleSizes };
};

/** The checks that need no more than the boxes: overflow, clipped text and type sizes. */
export const findBoxProblems = ({ page, cutting, typed, roleSizes }: BoxMeasures): Finding[] => {
	const findings: Finding[] = [];
	if (page.scrollWidth > page.clientWidth)
		findings.push({
			check: "overflow",
			detail: `page is ${page.scrollWidth}px wide in a ${page.clientWidth}px window`,
		});

	const hides = (value: string) => value === "hidden" || value === "clip";
	for (const el of cutting) {
		if (!hides(el.overflowX) && !hides(el.overflowY)) continue;
		// A visually hidden element (a screen-reader label) is cut on purpose, and so is one that is not shown.
		if (!isShown(el) || !el.text) continue;
		// The cut is meant: an ellipsis at the end of the line, or a line clamp.
		if (el.textOverflow === "ellipsis" || el.lineClamp !== "none") continue;
		const sideways = hides(el.overflowX) && el.scrollWidth > el.clientWidth + 1;
		const down = hides(el.overflowY) && el.scrollHeight > el.clientHeight + 1;
		if (sideways || down)
			findings.push({
				check: "clipped",
				detail: `${nameOf(el)} content ${el.scrollWidth}x${el.scrollHeight} in a ${el.clientWidth}x${el.clientHeight} box`,
			});
	}

	// A role that changes at a width or a state (`md:text-monti-body`, `data-[size=sm]:text-monti-note`) is the design's own exception, and so is
	// one a parent sets for its children (`[&_[data-slot=option]]:text-monti-note`, `*:text-monti-note`).
	const changes = (name: string) => name.includes(":") && /(?:^|:)text-monti-/.test(name);
	const changedByParent = (name: string) => changes(name) && /^(?:\[&|\*:)/.test(name);
	for (const el of typed) {
		if (el.classes.some(changes) || el.inherited.some(changedByParent)) continue;
		for (const name of el.classes) {
			const size = name.startsWith("text-monti-") ? roleSizes[name.slice("text-monti-".length)] : null;
			if (!size) continue;
			if (el.fontSize !== size)
				findings.push({
					check: "type",
					detail: `${nameOf(el)} is ${name} but computes font size ${el.fontSize} (token ${size})`,
				});
		}
	}
	return findings;
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// mono

/** What the mono check reads from the page. */
export interface MonoMeasures {
	/** The value of `--monti-font-mono` on the document. */
	readonly monoFont: string;
	/** Every element whose class holds a type role or `font-mono`, with its computed `font-family`. */
	readonly elements: readonly (Named & Drawn & { readonly fontFamily: string })[];
}

/** Runs in the page: the measures of {@link findWrongMono}. */
export const measureMono = (): MonoMeasures => {
	const ROLES = ["meta", "micro", "display", "page", "heading", "reading", "title", "body", "label", "note", "caption"];
	const selector = [...ROLES.map((role) => `text-monti-${role}`), "font-mono"]
		.map((name) => `[class*="${name}"]`)
		.join(", ");
	const elements: MonoMeasures["elements"][number][] = [];
	for (const el of document.body.querySelectorAll(selector)) {
		const style = getComputedStyle(el);
		const box = el.getBoundingClientRect();
		elements.push({
			tag: el.tagName.toLowerCase(),
			classes: (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
			text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32),
			display: style.display,
			visibility: style.visibility,
			width: box.width,
			height: box.height,
			fontFamily: style.fontFamily,
		});
	}
	return { monoFont: getComputedStyle(document.documentElement).getPropertyValue("--monti-font-mono"), elements };
};

/**
 * Mono and sans must not trade places. An element that asks for fixed-width letters (the class `font-mono`, or the `text-monti-meta` and `text-monti-micro`
 * roles) must compute to the mono face of the admin (the first family of `--monti-font-mono`); and an element with a sans role (`text-monti-body` and the rest) and
 * no `font-mono` must not: a type role of another family once beat `font-mono` at wide screens, and a mono parent once handed its face to the sans text in it.
 * A class behind a variant (`md:font-mono`, `data-[x]:text-monti-meta`) is the design's own exception and is left out, and so is an element that is not shown.
 */
export const findWrongMono = ({ monoFont, elements }: MonoMeasures): Finding[] => {
	const findings: Finding[] = [];
	const mono = firstFamily(monoFont);
	if (!mono) return findings;
	const MONO_ROLES = ["text-monti-meta", "text-monti-micro"];
	const SANS_ROLES = ["display", "page", "heading", "reading", "title", "body", "label", "note", "caption"].map(
		(role) => `text-monti-${role}`,
	);
	for (const el of elements) {
		const asksMono = el.classes.includes("font-mono") || el.classes.some((name) => MONO_ROLES.includes(name));
		const sansRole = el.classes.some((name) => SANS_ROLES.includes(name));
		if ((!asksMono && !sansRole) || !isShown(el)) continue;
		const computed = firstFamily(el.fontFamily);
		if (asksMono && computed !== mono)
			findings.push({ check: "mono", detail: `${nameOf(el)} asks for ${mono} but computes ${computed}` });
		else if (!asksMono && sansRole && computed === mono)
			findings.push({ check: "mono", detail: `${nameOf(el)} has a sans role but computes ${mono}` });
	}
	return findings;
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// icon

/** A text node of a control: the boxes of its lines, and whether each element from its parent up to the control is drawn. */
export interface TextMeasure {
	readonly text: string;
	readonly lines: readonly Box[];
	/** Its parent first, the control last. */
	readonly enclosing: readonly Drawn[];
}

/** What the icon check reads from the page. */
export interface IconMeasures {
	/** Every button, link and tab. */
	readonly controls: readonly (Named &
		Drawn & {
			readonly icons: readonly (Box &
				Drawn & {
					/** The icon's own plate: the outermost element around it that holds no text. */
					readonly plate: { readonly width: number; readonly height: number };
				})[];
			readonly texts: readonly TextMeasure[];
		})[];
}

/** Runs in the page: the measures of {@link findSplitIcons}. */
export const measureIcons = (): IconMeasures => {
	const drawn = (el: Element) => {
		const style = getComputedStyle(el);
		const box = el.getBoundingClientRect();
		return { display: style.display, visibility: style.visibility, width: box.width, height: box.height };
	};
	const boxOf = (rect: DOMRect) => ({ top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height });
	const controls: IconMeasures["controls"][number][] = [];
	for (const control of document.body.querySelectorAll('button, a, [role="tab"]')) {
		const icons = [...control.querySelectorAll("svg")].map((icon) => {
			let plate: Element = icon;
			while (plate.parentElement && plate.parentElement !== control && !plate.parentElement.textContent?.trim())
				plate = plate.parentElement;
			const plateBox = plate.getBoundingClientRect();
			return {
				...drawn(icon),
				...boxOf(icon.getBoundingClientRect()),
				plate: { width: plateBox.width, height: plateBox.height },
			};
		});
		const texts: TextMeasure[] = [];
		const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const enclosing = [];
			for (let el = node.parentElement; el; el = el.parentElement) {
				enclosing.push(drawn(el));
				if (el === control) break;
			}
			const range = document.createRange();
			range.selectNodeContents(node);
			texts.push({ text: node.textContent ?? "", lines: [...range.getClientRects()].map(boxOf), enclosing });
		}
		controls.push({
			tag: control.tagName.toLowerCase(),
			classes: (control.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
			text: (control.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32),
			...drawn(control),
			icons,
			texts,
		});
	}
	return { controls };
};

/**
 * A button, link or tab that holds an svg icon and visible text must draw them on one line: the icon's box and the text's box overlap vertically. A
 * `display: block` svg inside an inline parent drops onto a line of its own, which this catches. Text that is visually hidden (a screen-reader label:
 * a box of 1px or less, or not shown) does not count, an icon without text, or text without an icon, is left to the other checks, and so is a picture:
 * an icon inside a plate more than twice its size (a tile's thumbnail with the file's name under it) is not meant to sit on the line of the text.
 */
export const findSplitIcons = ({ controls }: IconMeasures): Finding[] => {
	const findings: Finding[] = [];
	for (const control of controls) {
		if (!isShown(control)) continue;
		const icons = control.icons.filter(isShown);
		if (icons.length === 0) continue;
		// The lines of the visible text: one box per line of every text node that no hidden element encloses.
		const lines = control.texts
			.filter((node) => node.text.trim() && node.enclosing.every(isShown))
			.flatMap((node) => node.lines.filter((line) => line.width > 0 && line.height > 0));
		if (lines.length === 0) continue;
		for (const icon of icons) {
			if (icon.plate.width > icon.width * 2 || icon.plate.height > icon.height * 2) continue;
			if (lines.some((line) => Math.min(icon.bottom, line.bottom) - Math.max(icon.top, line.top) >= 1)) continue;
			findings.push({
				check: "icon",
				detail: `${nameOf(control)} has its icon (y ${Math.round(icon.top)}-${Math.round(icon.bottom)}) off the line of its text (y ${Math.round(Math.min(...lines.map((line) => line.top)))}-${Math.round(Math.max(...lines.map((line) => line.bottom)))})`,
			});
		}
	}
	return findings;
};

// ---------------------------------------------------------------------------------------------------------------------------------------------
// center

/** A font's metrics for one reference text, as the canvas measures it (`TextMetrics`). */
export interface Ink {
	readonly fontBoundingBoxAscent: number;
	readonly actualBoundingBoxAscent: number;
	readonly actualBoundingBoxDescent: number;
}

/** A text node of a control, with the font of its parent and that font's metrics for both reference texts. */
export interface CenterTextMeasure extends TextMeasure {
	/** Whether an svg holds it. */
	readonly inSvg: boolean;
	readonly fontFamily: string;
	/** The metrics of the syllable table and of `H`, drawn in the node's font. */
	readonly ink: { readonly hangul: Ink; readonly latin: Ink };
}

/** What the center check reads from the page. */
export interface CenterMeasures {
	/** The value of `--monti-font-mono` on the document. */
	readonly monoFont: string;
	/** Every control (see {@link findOffCenterText}); none when the page has no canvas to measure text with. */
	readonly controls: readonly (Named &
		Drawn & {
			readonly top: number;
			readonly bottom: number;
			readonly borderTopWidth: string;
			readonly borderBottomWidth: string;
			readonly texts: readonly CenterTextMeasure[];
		})[];
}

/** Runs in the page: the measures of {@link findOffCenterText}. */
export const measureCenter = (): CenterMeasures => {
	const monoFont = getComputedStyle(document.documentElement).getPropertyValue("--monti-font-mono");
	const context = document.createElement("canvas").getContext("2d");
	if (!context) return { monoFont, controls: [] };
	const drawn = (el: Element) => {
		const style = getComputedStyle(el);
		const box = el.getBoundingClientRect();
		return { display: style.display, visibility: style.visibility, width: box.width, height: box.height };
	};
	const ink = (sample: string) => {
		const metrics = context.measureText(sample);
		return {
			fontBoundingBoxAscent: metrics.fontBoundingBoxAscent,
			actualBoundingBoxAscent: metrics.actualBoundingBoxAscent,
			actualBoundingBoxDescent: metrics.actualBoundingBoxDescent,
		};
	};
	const controls: CenterMeasures["controls"][number][] = [];
	for (const control of document.body.querySelectorAll(
		'button, a[href], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [data-slot="chip"], [data-slot="status-bar-cell"]',
	)) {
		const style = getComputedStyle(control);
		const outer = control.getBoundingClientRect();
		const texts: CenterTextMeasure[] = [];
		const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const parent = node.parentElement;
			if (!parent) continue;
			const enclosing = [];
			for (let el: Element | null = parent; el; el = el.parentElement) {
				enclosing.push(drawn(el));
				if (el === control) break;
			}
			const range = document.createRange();
			range.selectNodeContents(node);
			const own = getComputedStyle(parent);
			context.font = `${own.fontStyle} ${own.fontWeight} ${own.fontSize} ${own.fontFamily}`;
			texts.push({
				text: node.textContent ?? "",
				lines: [...range.getClientRects()].map((r) => ({
					top: r.top,
					bottom: r.bottom,
					width: r.width,
					height: r.height,
				})),
				enclosing,
				inSvg: parent.closest("svg") !== null,
				fontFamily: own.fontFamily,
				ink: { hangul: ink("가나다라마바사아자차카타파하"), latin: ink("H") },
			});
		}
		controls.push({
			tag: control.tagName.toLowerCase(),
			classes: (control.getAttribute("class") ?? "").split(/\s+/).filter(Boolean),
			text: (control.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32),
			...drawn(control),
			top: outer.top,
			bottom: outer.bottom,
			borderTopWidth: style.borderTopWidth,
			borderBottomWidth: style.borderBottomWidth,
			texts,
		});
	}
	return { monoFont, controls };
};

/**
 * The text of a fixed-height, single-line control must sit on the vertical center of its box (within 0.5px; within 0.75px for text in the mono face and 1px for Hangul in it, see below). A bottom-padding
 * "nudge" tuned on a canvas that drew another font once left every label about a pixel high. The admin's Pretendard is balanced in its `@font-face` (`ascent-override`,
 * `descent-override`, see `bundledFonts`), so no part may need a nudge to pass.
 *
 * What is measured: the box is the control's padding box (a border is not room). The
 * text is each visible text node of the control. Its font is the computed font of its parent, set on a canvas; the baseline is the top of the node's
 * Range rect (the inline box's content area) plus the font's `fontBoundingBoxAscent`. The ink is the canvas's `actualBoundingBoxAscent` and
 * `actualBoundingBoxDescent` of a reference text drawn in that font from that baseline: the syllable table (`가나다라마바사아자차카타파하`, so no single glyph decides the height) when the node has Hangul,
 * `H` (the cap height) when it has Latin letters; a node of neither (digits, symbols) is not measured. The center of that ink is compared
 * with the center of the box.
 *
 * The controls are anything a pointer or a key picks, and the chips and status bar cells that are sized like one. Left out: a control that is not
 * shown, a control displayed inline (a link in running text has no box of its own), an underlined tab (a border at the bottom only: the underline is
 * not an edge of the text's box), one taller than 48px (a tile, a card), one with less than 6px of room around its line (a text button is as tall as
 * its line), and one whose text is on more than one line or on lines that do not overlap (a title over a caption).
 */
export const findOffCenterText = ({ monoFont, controls }: CenterMeasures): Finding[] => {
	const tolerance = 0.5;
	// Text in the mono face (IBM Plex Mono) has its own metrics, which the admin's font-face does not balance: it is measured to 0.75px.
	const monoTolerance = 0.75;
	// Hangul set in the mono face is drawn by the system's own Hangul face, whose metrics the page does not know (the design system keeps Korean in its
	// mono roles as it is), so such a text is measured to a pixel.
	const fallbackTolerance = 1;
	const monoFace = firstFamily(monoFont);
	const maxHeight = 48;
	const HANGUL = /[ㄱ-ㆎ가-힣]/;
	const px = (value: string) => Number.parseFloat(value) || 0;
	const findings: Finding[] = [];

	for (const control of controls) {
		if (!isShown(control)) continue;
		if (control.display === "inline" || control.bottom - control.top > maxHeight) continue;
		// An underlined tab has a line at the bottom and none at the top: its box ends at the underline, a set distance under the text, so its text is
		// not meant to sit on the middle of the box.
		if (px(control.borderBottomWidth) > 0 && px(control.borderTopWidth) === 0) continue;
		const top = control.top + px(control.borderTopWidth);
		const bottom = control.bottom - px(control.borderBottomWidth);

		const nodes = control.texts
			.filter((node) => node.text.trim() && !node.inSvg && node.enclosing.every(isShown))
			.map((node) => {
				const text = node.text.trim();
				const mono = monoFace !== "" && firstFamily(node.fontFamily) === monoFace;
				return {
					...node,
					text,
					lines: node.lines.filter((line) => line.width > 0 && line.height > 0),
					mono,
					fallback: mono && HANGUL.test(text),
				};
			});
		const lines = nodes.flatMap((node) => node.lines);
		const first = lines[0];
		if (!first) continue;
		const stacked = lines.some((line) => {
			const middle = (line.top + line.bottom) / 2;
			return middle < first.top || middle > first.bottom;
		});
		if (stacked || nodes.some((node) => node.lines.length > 1)) continue;
		if (bottom - top < Math.max(...lines.map((line) => line.height)) + 6) continue;

		for (const node of nodes) {
			const line = node.lines[0];
			if (!line) continue;
			const ink = HANGUL.test(node.text) ? node.ink.hangul : /[A-Za-z]/.test(node.text) ? node.ink.latin : null;
			if (!ink) continue;
			const baseline = line.top + ink.fontBoundingBoxAscent;
			const above = baseline - ink.actualBoundingBoxAscent - top;
			const below = bottom - (baseline + ink.actualBoundingBoxDescent);
			const off = (above - below) / 2;
			if (Math.abs(off) <= (node.fallback ? fallbackTolerance : node.mono ? monoTolerance : tolerance)) continue;
			findings.push({
				check: "center",
				detail: `${nameOf({ ...control, text: node.text.slice(0, 32) })} ink is ${Math.abs(off).toFixed(1)}px ${off < 0 ? "above" : "below"} the center of its ${Math.round(bottom - top)}px box (${above.toFixed(1)}px above, ${below.toFixed(1)}px below)`,
			});
		}
	}
	return findings;
};
