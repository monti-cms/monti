/**
 * What a still picture and a reading of the classes cannot show, measured on the page (T51; docs/design/admin/tokens.md, 높이 기준; button.md, 모양 기준):
 * - a box control's height is 24, 28, 32 or 36: one line with a ground or a line of its own, under 48px (a height made of padding lands between
 *   them: the 34px suggestion row). A taller thing is a row or a block, not a control;
 * - a control lower than 24px is pressable over at least 24px (`HIT_AREA`), and the press really lands there;
 * - a pressable thing's four corners are a pill, 6px, or none, whether its ground shows now or only when pointed at;
 * - a focus ring is whole, drawn on the thing or on a layer of it: no box that clips or scrolls cuts it. What the arrow keys reach inside a menu,
 *   a tab row or a radio group is focused too;
 * - the keyboard's focus draws something: a line around the thing, a ring, or the ink line of an underlined field, on the thing, a layer of it,
 *   something in it, or the box around it (tokens.md, 상태). Only what is painted counts (a colour that shows, a width, a box that is drawn), on
 *   what was on the page before the focus. A ring that is set and unset in one class list (`outline-none` beside `outline-2`) draws nothing.
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

export type Rule = "height" | "hit" | "corner" | "ring" | "focus";

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

/**
 * A handle on an edge: its focus is its ink line, the one the pointer brings out (editor-tools.md, 표; the edge of a panel), so its ground is looked
 * at too.
 */
const LINE_IS_FOCUS = "[data-slot=resize-handle], [data-slot=table-column-border]";

/**
 * A row of a menu or of a list of choices lies on `bg-selected` under the pointer and the keyboard alike (menu.md), and the menu lights it as its
 * own keys move: a focus set from here does not, so it cannot be asked of them.
 */
const LIT_BY_ITS_MENU = "[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=option]";

/**
 * What is typed in: the caret stands in it wherever the keyboard is, whatever its line says (an error's red and a proposal's blue stay under the
 * focus).
 */
const TYPED =
	"textarea, input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=reset], [type=file], [type=range], [type=color], [type=image])";

/**
 * A trigger whose popup is open: the focus is in the popup (a menu, a list, a dialog), and the trigger keeps its open look. Only what says it
 * opens a popup (`aria-haspopup`) is let off: a thing that unfolds in place (`CollapsibleTrigger`, `ReviewMore`) is `aria-expanded` too, stays
 * on the screen with the focus on it, and is asked. What this cannot check: that the popup really took the focus. A trigger that says
 * `aria-haspopup` and keeps the focus while its list is open is let off with the rest.
 */
const POPUP_OPEN = '[aria-expanded="true"][aria-haspopup]:not([aria-haspopup="false"])';

const SIDES = ["top", "right", "bottom", "left"];

/** The shadows of a computed `box-shadow`: split on the commas between shadows, not those inside a colour. */
const shadowsOf = (value: string) => (value === "none" ? [] : value.split(/,(?![^(]*\))/).map((each) => each.trim()));

/** Whether a shadow paints anything: a colour that shows, and some reach (an offset, a blur or a spread). */
function paints(shadow: string) {
	const colour = shadow.match(/[a-z-]+\([^)]*\)|transparent/)?.[0] ?? "";
	const lengths = shadow.replace(/[a-z-]+\([^)]*\)/g, "").match(/-?[\d.]+px/g) ?? [];
	return !clear(colour) && lengths.some((length) => px(length) !== 0);
}

/**
 * What a box paints that a focus may be drawn with: a line around (with how far off it stands), ring and other shadows, and the box's own lines;
 * its ground too where that is the mark (`LINE_IS_FOCUS`). Only what shows: a colour that is not clear, a width that is not 0.
 */
function painted(style: CSSStyleDeclaration, ground: boolean) {
	const marks: string[] = [];
	if (style.outlineStyle !== "none" && px(style.outlineWidth) > 0 && !clear(style.outlineColor))
		marks.push(`around ${style.outlineWidth} ${style.outlineOffset} ${style.outlineColor}`);
	for (const shadow of shadowsOf(style.boxShadow)) if (paints(shadow)) marks.push(`shadow ${shadow}`);
	for (const side of SIDES) {
		const width = style.getPropertyValue(`border-${side}-width`);
		const line = style.getPropertyValue(`border-${side}-style`);
		const colour = style.getPropertyValue(`border-${side}-color`);
		if (px(width) > 0 && line !== "none" && line !== "hidden" && !clear(colour))
			marks.push(`line ${side} ${width} ${colour}`);
	}
	if (ground && !clear(style.backgroundColor)) marks.push(`ground ${style.backgroundColor}`);
	return marks;
}

/** Whether an element is drawn with a box: laid out, not hidden, and nothing above it at opacity 0. */
function hasBox(element: Element) {
	const box = element.getBoundingClientRect();
	if (box.width <= 0 || box.height <= 0) return false;
	if (getComputedStyle(element).visibility !== "visible") return false;
	for (let up: Element | null = element; up; up = up.parentElement)
		if (getComputedStyle(up).opacity === "0") return false;
	return true;
}

/** What an element and its two layers paint now; nothing when it has no box (`display: none`, an empty span). */
function paintedBy(element: Element, ground: boolean) {
	if (!hasBox(element)) return [];
	const marks = painted(getComputedStyle(element), ground);
	for (const pseudo of ["::before", "::after"]) {
		const style = getComputedStyle(element, pseudo);
		const boxed = style.content !== "none" && style.display !== "none" && px(style.width) > 0 && px(style.height) > 0;
		if (boxed && style.visibility === "visible" && style.opacity !== "0")
			for (const mark of painted(style, ground)) marks.push(`${pseudo} ${mark}`);
	}
	return marks;
}

/** How many boxes above a thing may draw its focus for it: an input's field, a search box around its input. */
const AROUND = 4;

/**
 * Where a thing's focus may be drawn: the thing and its layers, what is inside it (a tile's picture takes the ring), and the boxes close around
 * it (a field's line, the ring of a box around an input). The places are named before the focus, so what a focus adds to the page (a span put
 * in on focus) is not one of them.
 */
function places(element: Element) {
	const around: Element[] = [];
	for (let up = element.parentElement, level = 0; up && level < AROUND; up = up.parentElement, level++) around.push(up);
	return [element, ...element.querySelectorAll("*"), ...around];
}

/** What each place paints now. */
const paintedAt = (where: Element[], ground: boolean) => where.map((each) => paintedBy(each, ground));

/** Whether the focus drew something: a place paints now what it did not paint before (a line that turned ink, a ring, a line around moved off). */
const drew = (before: string[][], after: string[][]) =>
	after.some((marks, at) => marks.some((mark) => !(before[at] ?? []).includes(mark)));

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
	// The test presses a key first, so the browser draws the keyboard's ring. Nothing fades while this looks: a line that is still turning ink
	// reads as the line it was.
	const still = document.createElement("style");
	still.textContent = "*, *::before, *::after { transition: none !important; }";
	document.head.append(still);
	const before = document.activeElement;
	for (const element of new Set([...pressables, ...[...root.querySelectorAll(FOCUSABLE)].filter(live)])) {
		if (!(element instanceof HTMLElement)) continue;
		// The text of an editor draws a caret, not a ring, and an editor focused from outside outlives its story.
		if (element.isContentEditable) continue;
		// Without the focus first: what the last thing's focus drew around itself (a field's line) is not this one's.
		if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body)
			document.activeElement.blur();
		if (!element.isConnected) continue;
		const ground = element.matches(LINE_IS_FOCUS);
		const where = places(element);
		const unfocused = paintedAt(where, ground);
		element.focus();
		if (document.activeElement !== element) continue;
		// Not asked of what is typed in (its caret), of a menu's row (lit by its menu), of a trigger whose popup is open (`POPUP_OPEN`), of a
		// handle that is pointed at or held (its line is out already), of a day the calendar holds as the one its keys are on (`data-focused`:
		// ringed before and after), or of a story that holds the focused look on a thing to show it (`storybook-addon-pseudo-states`).
		const asked =
			!allowed(element, "focus") &&
			!element.matches(TYPED) &&
			!element.matches(LIT_BY_ITS_MENU) &&
			!element.matches(POPUP_OPEN) &&
			!(element.matches(LINE_IS_FOCUS) && element.matches(":hover, [data-active], [data-resizing], [data-hovered]")) &&
			element.closest("[data-focused=true], [class*=pseudo-focus]") === null;
		if (asked && element.matches(":focus-visible") && !drew(unfocused, paintedAt(where, ground)))
			found.add(
				`focus: ${nameOf(element)} draws nothing when the keyboard's focus is on it; a ring, or a field's ink line`,
			);
		if (allowed(element, "ring")) continue;
		for (const ring of rings(element)) {
			const cut = cutBy(ring.first, ring.box, ring.reach);
			if (cut) found.add(`ring: the focus ring of ${nameOf(element)} is cut at its ${cut}`);
		}
	}
	if (before instanceof HTMLElement && before !== document.body && before.isConnected)
		before.focus({ preventScroll: true });
	else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	still.remove();
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
