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
 *   them on purpose (`leading-none` in a marker, `font-semibold` in a button). An element whose role changes under a variant is left out too;
 * - mono: mono and sans trade places: an element that asks for fixed-width letters (`font-mono`, or the `text-monti-meta` and `text-monti-micro` roles) computes
 *   another face, or an element with a sans role and no `font-mono` computes mono (see {@link findWrongMono});
 * - icon: a button, link or tab that holds an icon and visible text puts them on different lines (see {@link findSplitIcons});
 * - center: the text of a fixed-height single-line control (a button, chip, tab, menu row, status bar cell) sits off the vertical center of its box
 *   (see {@link findOffCenterText}).
 * Each runs in the page, so it holds no outside reference.
 */
export const runPageChecks = async (page: Page): Promise<Finding[]> => [
	...(await page.evaluate(runBoxChecks)),
	...(await page.evaluate(findWrongMono)),
	...(await page.evaluate(findSplitIcons)),
	...(await page.evaluate(findOffCenterText)),
];

/**
 * Mono and sans must not trade places. An element that asks for fixed-width letters (the class `font-mono`, or the `text-monti-meta` and `text-monti-micro`
 * roles) must compute to the mono face of the admin (the first family of `--monti-font-mono`); and an element with a sans role (`text-monti-body` and the rest) and
 * no `font-mono` must not: a type role of another family once beat `font-mono` at wide screens, and a mono parent once handed its face to the sans text in it.
 * A class behind a variant (`md:font-mono`, `data-[x]:text-monti-meta`) is the design's own exception and is left out, and so is an element that is not shown. The
 * function runs in the page (and in the unit test), so it holds no outside reference.
 */
export const findWrongMono = (): Finding[] => {
	const findings: Finding[] = [];
	const family = (value: string) => (value.split(",")[0] ?? "").replace(/["']/g, "").trim();
	const mono = family(getComputedStyle(document.documentElement).getPropertyValue("--monti-font-mono"));
	if (!mono) return findings;
	const MONO_ROLES = ["text-monti-meta", "text-monti-micro"];
	const SANS_ROLES = ["display", "page", "heading", "reading", "title", "body", "label", "note", "caption"].map(
		(role) => `text-monti-${role}`,
	);
	const selector = [...MONO_ROLES, ...SANS_ROLES, "font-mono"].map((name) => `[class*="${name}"]`).join(", ");
	for (const el of document.body.querySelectorAll(selector)) {
		const names = (el.getAttribute("class") ?? "").split(/\s+/);
		const asksMono = names.includes("font-mono") || names.some((name) => MONO_ROLES.includes(name));
		const sansRole = names.some((name) => SANS_ROLES.includes(name));
		if (!asksMono && !sansRole) continue;
		const style = getComputedStyle(el);
		const box = el.getBoundingClientRect();
		if (style.display === "none" || style.visibility === "hidden" || box.width <= 1 || box.height <= 1) continue;
		const computed = family(style.fontFamily);
		const cls = names.filter(Boolean).slice(0, 4).join(".");
		const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
		const where = `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}> "${text}"`;
		if (asksMono && computed !== mono)
			findings.push({ check: "mono", detail: `${where} asks for ${mono} but computes ${computed}` });
		else if (!asksMono && sansRole && computed === mono)
			findings.push({ check: "mono", detail: `${where} has a sans role but computes ${mono}` });
	}
	return findings;
};

/**
 * A button, link or tab that holds an svg icon and visible text must draw them on one line: the icon's box and the text's box overlap vertically. A
 * `display: block` svg inside an inline parent drops onto a line of its own, which this catches. Text that is visually hidden (a screen-reader label:
 * a box of 1px or less, or not shown) does not count, an icon without text, or text without an icon, is left to the other checks, and so is a picture:
 * an icon inside a plate more than twice its size (a tile's thumbnail with the file's name under it) is not meant to sit on the line of the text.
 * The function runs in the page (and in the unit test), so it holds no outside reference.
 */
export const findSplitIcons = (): Finding[] => {
	const findings: Finding[] = [];
	const shown = (el: Element) => {
		const style = getComputedStyle(el);
		const box = el.getBoundingClientRect();
		return style.display !== "none" && style.visibility !== "hidden" && box.width > 1 && box.height > 1;
	};
	for (const control of document.body.querySelectorAll('button, a, [role="tab"]')) {
		if (!shown(control)) continue;
		const icons = [...control.querySelectorAll("svg")].filter(shown);
		if (icons.length === 0) continue;

		// The lines of the visible text: one box per line of every text node that no hidden element encloses.
		const lines: DOMRect[] = [];
		const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			if (!(node.textContent ?? "").trim()) continue;
			let hidden = false;
			for (let el = node.parentElement; el && el !== control.parentElement; el = el.parentElement) {
				if (!shown(el)) hidden = true;
				if (el === control) break;
			}
			if (hidden) continue;
			const range = document.createRange();
			range.selectNodeContents(node);
			lines.push(...[...range.getClientRects()].filter((box) => box.width > 0 && box.height > 0));
		}
		if (lines.length === 0) continue;

		for (const icon of icons) {
			const box = icon.getBoundingClientRect();
			// The icon's own plate: the outermost element around it that does not also hold text.
			let plate: Element = icon;
			while (plate.parentElement && plate.parentElement !== control && !plate.parentElement.textContent?.trim())
				plate = plate.parentElement;
			const plateBox = plate.getBoundingClientRect();
			if (plateBox.width > box.width * 2 || plateBox.height > box.height * 2) continue;
			const shares = lines.some((line) => Math.min(box.bottom, line.bottom) - Math.max(box.top, line.top) >= 1);
			if (shares) continue;
			const cls = (control.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
			const text = (control.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
			findings.push({
				check: "icon",
				detail: `<${control.tagName.toLowerCase()}${cls ? `.${cls}` : ""}> "${text}" has its icon (y ${Math.round(box.top)}-${Math.round(box.bottom)}) off the line of its text (y ${Math.round(Math.min(...lines.map((line) => line.top)))}-${Math.round(Math.max(...lines.map((line) => line.bottom)))})`,
			});
		}
	}
	return findings;
};

/** The checks that need no more than the page: overflow, clipped text and type sizes. */
const runBoxChecks = (): Finding[] => {
	const findings: { check: "overflow" | "clipped" | "type"; detail: string }[] = [];
	const describe = (el: Element) => {
		const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
		const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 32);
		return `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}> "${text}"`;
	};

	const root = document.documentElement;
	if (root.scrollWidth > root.clientWidth)
		findings.push({
			check: "overflow",
			detail: `page is ${root.scrollWidth}px wide in a ${root.clientWidth}px window`,
		});

	const hides = (value: string) => value === "hidden" || value === "clip";
	for (const el of document.body.querySelectorAll("*")) {
		const style = getComputedStyle(el);
		if (!hides(style.overflowX) && !hides(style.overflowY)) continue;
		const box = el.getBoundingClientRect();
		// A visually hidden element (a screen-reader label) is cut on purpose, and so is one that is not shown.
		if (box.width <= 1 || box.height <= 1 || style.visibility === "hidden" || style.display === "none") continue;
		if (!(el.textContent ?? "").trim()) continue;
		// The cut is meant: an ellipsis at the end of the line, or a line clamp.
		if (style.textOverflow === "ellipsis" || style.getPropertyValue("-webkit-line-clamp") !== "none") continue;
		const sideways = hides(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
		const down = hides(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
		if (sideways || down)
			findings.push({
				check: "clipped",
				detail: `${describe(el)} content ${el.scrollWidth}x${el.scrollHeight} in a ${el.clientWidth}x${el.clientHeight} box`,
			});
	}

	// A type role is a class whose size is a design token (`--monti-text-<role>-size`); a color class like `text-monti-muted` is not.
	const probe = document.createElement("div");
	probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
	document.body.append(probe);
	const roles = new Map<string, { size: string } | null>();
	const roleOf = (role: string) => {
		if (!roles.has(role)) {
			probe.style.fontSize = `var(--monti-text-${role}-size)`;
			roles.set(
				role,
				getComputedStyle(root).getPropertyValue(`--monti-text-${role}-size`)
					? { size: getComputedStyle(probe).fontSize }
					: null,
			);
		}
		return roles.get(role) ?? null;
	};
	for (const el of document.body.querySelectorAll('[class*="text-monti-"]')) {
		const style = getComputedStyle(el);
		const names = (el.getAttribute("class") ?? "").split(/\s+/);
		// A role that changes at a width or a state (`md:text-monti-body`, `data-[size=sm]:text-monti-note`) is the design's own exception, and so is
		// one a parent sets for its children (`[&_[data-slot=option]]:text-monti-note`, `*:text-monti-note`).
		const changes = (name: string) => name.includes(":") && /(?:^|:)text-monti-/.test(name);
		const changedByParent = (name: string) => changes(name) && /^(?:\[&|\*:)/.test(name);
		if (names.some(changes)) continue;
		let ancestor = el.parentElement;
		while (ancestor && !(ancestor.getAttribute("class") ?? "").split(/\s+/).some(changedByParent))
			ancestor = ancestor.parentElement;
		if (ancestor) continue;
		for (const name of names) {
			const role = name.startsWith("text-monti-") ? roleOf(name.slice("text-monti-".length)) : null;
			if (!role) continue;
			if (style.fontSize !== role.size)
				findings.push({
					check: "type",
					detail: `${describe(el)} is ${name} but computes font size ${style.fontSize} (token ${role.size})`,
				});
		}
	}
	probe.remove();
	return findings;
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
 * Left out: a control that is not shown, a control displayed inline (a link in running text has no box of its own), an underlined tab (a border at the bottom only: the underline is not an edge of the text's box), one taller than
 * 48px (a tile, a card), one with less than 6px of room around its line (a text button is as tall as its line), and one whose text is
 * on more than one line or on lines that do not overlap (a title over a caption).
 * The function runs in the page (and in the unit test), so it holds no outside reference.
 */
export const findOffCenterText = (): Finding[] => {
	// The controls: anything a pointer or a key picks, and the chips and status bar cells that are sized like one.
	const tolerance = 0.5;
	// Text in the mono face (IBM Plex Mono) has its own metrics, which the admin's font-face does not balance: it is measured to 0.75px.
	const monoTolerance = 0.75;
	// Hangul set in the mono face is drawn by the system's own Hangul face, whose metrics the page does not know (the design system keeps Korean in its
	// mono roles as it is), so such a text is measured to a pixel.
	const fallbackTolerance = 1;
	const family = (value: string) => (value.split(",")[0] ?? "").replace(/["']/g, "").trim();
	const monoFace = family(getComputedStyle(document.documentElement).getPropertyValue("--monti-font-mono"));
	const maxHeight = 48;
	const hangul = "가나다라마바사아자차카타파하";
	const latin = "H";
	const controls =
		'button, a[href], [role="tab"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [data-slot="chip"], [data-slot="status-bar-cell"]';
	const findings: Finding[] = [];
	const shown = (el: Element) => {
		const style = getComputedStyle(el);
		const box = el.getBoundingClientRect();
		return style.display !== "none" && style.visibility !== "hidden" && box.width > 1 && box.height > 1;
	};
	const context = document.createElement("canvas").getContext("2d");
	if (!context) return findings;
	const px = (value: string) => Number.parseFloat(value) || 0;

	for (const control of document.body.querySelectorAll(controls)) {
		if (!shown(control)) continue;
		const style = getComputedStyle(control);
		const outer = control.getBoundingClientRect();
		if (style.display === "inline" || outer.height > maxHeight) continue;
		// An underlined tab has a line at the bottom and none at the top: its box ends at the underline, a set distance under the text, so its text is
		// not meant to sit on the middle of the box.
		if (px(style.borderBottomWidth) > 0 && px(style.borderTopWidth) === 0) continue;
		const top = outer.top + px(style.borderTopWidth);
		const bottom = outer.bottom - px(style.borderBottomWidth);

		const nodes: { text: string; font: string; lines: DOMRect[]; fallback: boolean; mono: boolean }[] = [];
		const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
		for (let node = walker.nextNode(); node; node = walker.nextNode()) {
			const text = (node.textContent ?? "").trim();
			if (!text) continue;
			let hidden = false;
			for (let el = node.parentElement; el; el = el.parentElement) {
				if (el.closest("svg") || !shown(el)) hidden = true;
				if (el === control) break;
			}
			if (hidden || !node.parentElement) continue;
			const range = document.createRange();
			range.selectNodeContents(node);
			const lines = [...range.getClientRects()].filter((line) => line.width > 0 && line.height > 0);
			const own = getComputedStyle(node.parentElement);
			const fallback =
				/[\u3131-\u318e\uac00-\ud7a3]/.test(text) && monoFace !== "" && family(own.fontFamily) === monoFace;
			nodes.push({
				text,
				font: `${own.fontStyle} ${own.fontWeight} ${own.fontSize} ${own.fontFamily}`,
				lines,
				fallback,
				mono: monoFace !== "" && family(own.fontFamily) === monoFace,
			});
		}
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
			const sample = /[\u3131-\u318e\uac00-\ud7a3]/.test(node.text)
				? hangul
				: /[A-Za-z]/.test(node.text)
					? latin
					: null;
			if (!sample) continue;
			context.font = node.font;
			const baseline = line.top + context.measureText(sample).fontBoundingBoxAscent;
			const ink = context.measureText(sample);
			const above = baseline - ink.actualBoundingBoxAscent - top;
			const below = bottom - (baseline + ink.actualBoundingBoxDescent);
			const off = (above - below) / 2;
			if (Math.abs(off) <= (node.fallback ? fallbackTolerance : node.mono ? monoTolerance : tolerance)) continue;
			const cls = (control.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
			findings.push({
				check: "center",
				detail: `<${control.tagName.toLowerCase()}${cls ? `.${cls}` : ""}> "${node.text.slice(0, 32)}" ink is ${Math.abs(off).toFixed(1)}px ${off < 0 ? "above" : "below"} the center of its ${Math.round(bottom - top)}px box (${above.toFixed(1)}px above, ${below.toFixed(1)}px below)`,
			});
		}
	}
	return findings;
};
