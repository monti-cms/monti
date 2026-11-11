/**
 * What a still picture and a reading of the classes cannot show, measured on the page (T51; docs/design/admin/tokens.md, 높이 기준; button.md, 모양 기준):
 * - a box control's height is 24, 28, 32 or 36: one line with a ground or a line of its own, under 48px (a height made of padding lands between
 *   them: the 34px suggestion row). A taller thing is a row or a block, not a control;
 * - a control lower than 24px is pressable over at least 24px (`HIT_AREA`), and the press really lands there;
 * - a pressable thing's four corners are a pill, 6px, or none, whether its ground shows now or only when pointed at;
 * - a focus ring is whole, drawn on the thing or on a layer of it: no box that clips or scrolls cuts it. What the arrow keys reach inside a menu,
 *   a tab row or a radio group is focused too.
 *
 * `measure` looks at everything on the page that can be pressed or focused, focuses each in turn, and says what is off, one line each. What is off on
 * purpose is in `ALLOWED`, by the part's `data-slot`, with its reason.
 */

/** What a person presses. */
const PRESSABLE =
	"button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=option], [role=tab], [role=switch], [role=checkbox], [role=radio], [role=combobox]";
/** What takes the focus without being pressed (a tab's panel, a scrolling box): only its ring is looked at. */
const FOCUSABLE = '[tabindex]:not([tabindex="-1"])';

const HEIGHTS = [24, 28, 32, 36];

export type Rule = "height" | "hit" | "corner" | "ring";

/** What is off on purpose: a part's `data-slot` (or `tag` for a bare element), the rules it is let off, and why. */
export const ALLOWED: { slot: string; rules: Rule[]; why: string }[] = [
	{
		slot: "status-bar-cell",
		rules: ["height"],
		why: "a cell of the status bar fills the bar (26px, a vessel in tokens.md) but for its line",
	},
	{
		slot: "checkbox",
		rules: ["corner"],
		why: "a check is a small square; its 3px corner is the box's own, not a pressable shape",
	},
	{
		slot: "folder-tab",
		rules: ["corner"],
		why: "a folder tab is the top of the card under it and has the card's corner",
	},
	...[
		"resize-corner",
		"crop-handle-nw",
		"crop-handle-ne",
		"crop-handle-sw",
		"crop-handle-se",
		"table-grip",
		"table-add-strip",
	].map((slot) => ({
		slot,
		rules: ["height", "hit", "corner"] as Rule[],
		why: "a handle drawn on the edge of a picture or a table is a mark on that edge, not a control: a larger one, or a layer over it, would cover what it sits on",
	})),
	{
		slot: "marker",
		rules: ["height"],
		why: "a tag in a block's margin is as high as its one small line (18px); its press layer is 24px",
	},
	{
		slot: "tabs-trigger",
		rules: ["height"],
		why: "a tab is words with a line under the picked one, as high as the bar it stands in, not a box control",
	},
];

const px = (value: string) => Number.parseFloat(value) || 0;

function shown(element: Element) {
	const box = element.getBoundingClientRect();
	if (box.width < 1 || box.height < 1) return false;
	const style = getComputedStyle(element);
	if (style.visibility === "hidden" || style.display === "none") return false;
	for (let up: Element | null = element; up; up = up.parentElement) {
		const each = getComputedStyle(up);
		if (each.opacity === "0" || up.hasAttribute("inert") || up.getAttribute("aria-hidden") === "true") return false;
	}
	return true;
}

const off = (element: Element) =>
	(element as HTMLButtonElement).disabled === true ||
	element.getAttribute("aria-disabled") === "true" ||
	element.closest("[data-disabled], fieldset[disabled]") !== null;

/** A name a person can find the element by: its slot or tag, and its words. */
export function nameOf(element: Element) {
	const slot = element.getAttribute("data-slot") ?? element.tagName.toLowerCase();
	const words = (element.getAttribute("aria-label") ?? element.textContent ?? "")
		.trim()
		.replace(/\s+/g, " ")
		.slice(0, 24);
	return words ? `${slot} "${words}"` : slot;
}
const slotOf = (element: Element) => element.getAttribute("data-slot") ?? element.tagName.toLowerCase();
const allowed = (element: Element, rule: Rule) =>
	ALLOWED.some((each) => each.slot === slotOf(element) && each.rules.includes(rule));

const NOT_A_COLOUR = /^(transparent|rgba\([^)]*,\s*0\)|[a-z-]+\([^)]*\/\s*0%?\))$/;
/** Whether a computed colour draws nothing. */
const clear = (colour: string) => NOT_A_COLOUR.test(colour.trim());

const heightOf = (element: Element) =>
	element instanceof HTMLElement ? element.offsetHeight : Math.round(element.getBoundingClientRect().height);

/** A layer of the element (`::before`, `::after`) that is placed over it, if it has one. */
function layers(element: Element) {
	return ["::before", "::after"]
		.map((pseudo) => getComputedStyle(element, pseudo))
		.filter((style) => style.content !== "none" && style.position === "absolute");
}

/**
 * How high the place is that takes a press: the element, or a layer that spreads it (`HIT_AREA`), as far as the press lands on it. A layer under a
 * box that clips it, or under a neighbour, takes no press there. When something else covers the element's own middle (a sheet over the page), where
 * the press lands cannot be told and the layer's height is taken as it is.
 */
function hitHeight(element: Element) {
	const height = heightOf(element);
	const layer = Math.max(height, ...layers(element).map((style) => px(style.height)));
	if (layer <= height) return height;
	const box = element.getBoundingClientRect();
	const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
	const lands = (at: number) => {
		const found = document.elementFromPoint(x, at);
		if (found === null) return false;
		if (found === element || element.contains(found)) return true;
		// A sheet over the whole window that leaves only the element itself open (an open menu's ground behind its trigger): a press there closes
		// what is open, and the layer is where it will be once it has.
		const over = found.getBoundingClientRect();
		return !found.contains(element) && over.width >= window.innerWidth && over.height >= window.innerHeight;
	};
	if (!lands(y)) return layer;
	const reach = Math.min(layer, 24) / 2 - 1;
	return lands(y - reach) && lands(y + reach) ? layer : height;
}

/** How far a focus ring reaches outside its box: an outline and ring shadows that draw something; 0 when it is drawn inside. */
function ringReach(style: CSSStyleDeclaration) {
	let reach = 0;
	if (style.outlineStyle !== "none" && px(style.outlineWidth) > 0 && !clear(style.outlineColor))
		reach = Math.max(reach, px(style.outlineWidth) + px(style.outlineOffset));
	// A ring is a shadow with no offset and no blur: "rgb(…) 0px 0px 0px 2px". Split on the commas between shadows, not those inside a colour.
	for (const shadow of style.boxShadow.split(/,(?![^(]*\))/)) {
		if (shadow.includes("inset")) continue;
		const colour = shadow.match(/[a-z-]+\([^)]*\)|transparent/)?.[0] ?? "";
		const lengths = shadow.replace(/[a-z-]+\([^)]*\)/g, "").match(/-?[\d.]+px/g);
		if (clear(colour) || lengths?.length !== 4) continue;
		if (px(lengths[0] ?? "") === 0 && px(lengths[1] ?? "") === 0 && px(lengths[2] ?? "") === 0)
			reach = Math.max(reach, px(lengths[3] ?? ""));
	}
	return reach;
}

type Edges = { left: number; right: number; top: number; bottom: number };

/** The box a placed layer stands in: the element when it is placed itself, or the nearest placed box above it. */
function placedBox(element: Element): Element {
	for (let up: Element | null = element; up; up = up.parentElement)
		if (getComputedStyle(up).position !== "static") return up;
	return document.documentElement;
}

/** The focus rings a focused element draws: its own, and those of its layers, each with the box it is drawn around. */
function rings(element: Element): { box: Edges; reach: number; first: Element | null }[] {
	const found: { box: Edges; reach: number; first: Element | null }[] = [];
	const fixed = getComputedStyle(element).position === "fixed";
	const own = ringReach(getComputedStyle(element));
	if (own > 0)
		found.push({ box: element.getBoundingClientRect(), reach: own, first: fixed ? null : element.parentElement });
	for (const style of layers(element)) {
		const reach = ringReach(style);
		if (reach <= 0) continue;
		const holder = placedBox(element);
		const edge = holder.getBoundingClientRect();
		const held = getComputedStyle(holder);
		const left = edge.left + px(held.borderLeftWidth) + px(style.left);
		const top = edge.top + px(held.borderTopWidth) + px(style.top);
		found.push({
			box: { left, top, right: left + px(style.width), bottom: top + px(style.height) },
			reach,
			// The box the layer stands in clips it too.
			first: holder,
		});
	}
	return found;
}

/**
 * The box that cuts a ring, if one does: `first` or a box above it that clips or scrolls, with the ring past the edge of what it shows (its scroll
 * bar is not part of that), while the ring's box shows in it at all. Above a thing fixed to the window nothing cuts.
 */
function cutBy(first: Element | null, box: Edges, reach: number): string | null {
	for (let up = first; up; up = up.parentElement) {
		const style = getComputedStyle(up);
		const clipsX = style.overflowX !== "visible";
		const clipsY = style.overflowY !== "visible";
		if (clipsX || clipsY) {
			const edge = up.getBoundingClientRect();
			const left = edge.left + up.clientLeft;
			const top = edge.top + up.clientTop;
			const inner = { left, top, right: left + up.clientWidth, bottom: top + up.clientHeight };
			const shows =
				box.right > inner.left && box.left < inner.right && box.bottom > inner.top && box.top < inner.bottom;
			const sides: string[] = [];
			if (clipsX && box.left - reach < inner.left - 0.5) sides.push("left");
			if (clipsX && box.right + reach > inner.right + 0.5) sides.push("right");
			if (clipsY && box.top - reach < inner.top - 0.5) sides.push("top");
			if (clipsY && box.bottom + reach > inner.bottom + 0.5) sides.push("bottom");
			if (shows && sides.length > 0) return `${sides.join(" and ")} by ${nameOf(up).split(' "')[0]}`;
		}
		if (style.position === "fixed") return null;
	}
	return null;
}

/** Whether the element draws a box of its own while nothing points at it: a ground or a line. */
function boxed(style: CSSStyleDeclaration) {
	const line = ["top", "right", "bottom", "left"].some(
		(side) =>
			px(style.getPropertyValue(`border-${side}-width`)) > 0 &&
			style.getPropertyValue(`border-${side}-style`) !== "none" &&
			!clear(style.getPropertyValue(`border-${side}-color`)),
	);
	return line || !clear(style.backgroundColor);
}

/**
 * The control an element is part of, when it is not one alone: its parent, standing at a control height and no more than its line and padding
 * higher (1px and 2px on each side). An input fills its field but for the field's line (35px in 36), and a segment sits inside its bar (26px in 32).
 * What is typed in may sit a level or two deeper in its field.
 */
function fieldOf(element: Element, typed: boolean): Element | null {
	const height = heightOf(element);
	let up = element.parentElement;
	for (let level = 0; up && level < (typed ? 3 : 1); level++, up = up.parentElement) {
		const over = heightOf(up) - height;
		if (HEIGHTS.includes(heightOf(up)) && over >= 0 && (typed || over <= 6)) return up;
	}
	return null;
}

/** What is off on the page now, one line for each thing. */
export function measure(root: ParentNode = document): string[] {
	const found = new Set<string>();
	const live = (each: Element) => shown(each) && !off(each);
	const pressables = [...root.querySelectorAll(PRESSABLE)].filter(live);
	for (const element of pressables) {
		const box = element.getBoundingClientRect();
		// A stand-in a library keeps for screen readers (a 1px "dismiss") is not something a person presses.
		if (box.height <= 2 || box.width <= 2) continue;
		const style = getComputedStyle(element);
		// The laid-out height: an opening menu is drawn smaller for a moment, and is not lower for it.
		const height = heightOf(element);
		const one = element.tagName !== "TEXTAREA" && !(element as HTMLElement).isContentEditable;
		// A check, a radio and a switch are marks, lower than a control; what takes their press is looked at below.
		const mark = element.matches(
			"[role=radio], [role=checkbox], [role=switch], input[type=checkbox], input[type=radio]",
		);
		// What is typed in takes the caret wherever it is pressed and is as high as its line: only its field's height is a control's.
		const typed = element.matches(
			"input:not([type=checkbox], [type=radio], [type=button], [type=submit]), select, input[role=combobox]",
		);
		const within = fieldOf(element, typed) !== null;
		// A radio, a check or a switch in a row that is its label: the row takes the press.
		const row = mark ? element.closest("label") : null;
		const labelled = row instanceof HTMLElement && row.offsetHeight >= 24;
		// A link in running text is as high as its line.
		const inText = element.tagName === "A" && style.display === "inline";
		const box_ = boxed(style);

		// A box control: one line, a box of its own, lower than two lines of a list. Lower than 24 it is not a control's height either.
		if (one && !within && !mark && !allowed(element, "height") && !HEIGHTS.includes(height)) {
			const off = box_ ? height < 48 : height > 24 && height < 36;
			if (off) found.add(`height: ${nameOf(element)} is ${height}px high; a control is 24, 28, 32 or 36`);
		}
		if (!within && !inText && !labelled && !typed && height < 24 && !allowed(element, "hit")) {
			const hit = hitHeight(element);
			if (hit < 24) found.add(`hit: ${nameOf(element)} is pressable over ${Math.round(hit)}px; at least 24 (HIT_AREA)`);
		}

		// What holds the focus now may be rounded for its ring alone (a text control); it is looked at wherever it stands unfocused.
		if (!allowed(element, "corner") && element !== document.activeElement) {
			const least = Math.min(box.height, box.width) / 2 - 0.5;
			const corners = [
				style.borderTopLeftRadius,
				style.borderTopRightRadius,
				style.borderBottomRightRadius,
				style.borderBottomLeftRadius,
			].map(px);
			const odd = corners.filter((radius) => radius !== 0 && radius !== 6 && radius < least);
			if (odd.length > 0)
				found.add(`corner: ${nameOf(element)} has ${[...new Set(odd)].join(" and ")}px corners; a pill, 6px or none`);
		}
	}

	// Rings: each thing that takes the focus, focused in turn: by Tab, or by the arrow keys of the menu, tab row or group it is in (`tabindex="-1"`).
	// The test presses a key first, so the browser draws the keyboard's ring.
	const before = document.activeElement;
	for (const element of new Set([...pressables, ...[...root.querySelectorAll(FOCUSABLE)].filter(live)])) {
		if (!(element instanceof HTMLElement) || allowed(element, "ring")) continue;
		// The text of an editor draws a caret, not a ring, and an editor focused from outside outlives its story.
		if (element.isContentEditable) continue;
		element.focus();
		if (document.activeElement !== element) continue;
		for (const ring of rings(element)) {
			const cut = cutBy(ring.first, ring.box, ring.reach);
			if (cut) found.add(`ring: the focus ring of ${nameOf(element)} is cut at its ${cut}`);
		}
	}
	if (before instanceof HTMLElement && before !== document.body) before.focus({ preventScroll: true });
	else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	return [...found];
}

/** Waits until nothing on the page is moving (a menu opening, a sheet sliding in) and its fonts are in, so what is measured is where things come to rest. */
export async function settled() {
	await new Promise((done) => requestAnimationFrame(() => done(null)));
	await document.fonts.ready;
	await Promise.all(
		document
			.getAnimations()
			.filter((animation) => animation.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
			.map((animation) => animation.finished.catch(() => {})),
	);
}
