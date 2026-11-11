/**
 * What a still picture and a reading of the classes cannot show, measured on the page (T51; docs/design/admin/tokens.md, 높이 기준; button.md, 모양 기준):
 * - a box control's height is 24, 28, 32 or 36; a height made of padding lands between them (the 34px suggestion row);
 * - a control lower than 24px is pressable over at least 24px (`HIT_AREA`);
 * - a pressable thing's corners are a pill, 6px, or none;
 * - a focus ring is whole: no box that clips or scrolls cuts it.
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
	...["crop-handle-nw", "crop-handle-ne", "crop-handle-sw", "crop-handle-se"].map((slot) => ({
		slot,
		rules: ["ring"] as Rule[],
		why: "T134: with the crop at the picture's edge the stage cuts the handle and its ring; the stage's room is to be decided",
	})),
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
		rules: ["hit", "corner"] as Rule[],
		why: "a handle drawn on the edge of a picture or a table: a layer larger than it would take presses meant for what it sits on",
	})),
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

/** How high the place is that takes a press: the element, or a pseudo-element that spreads it (`HIT_AREA`). */
function hitHeight(element: Element) {
	let height = element instanceof HTMLElement ? element.offsetHeight : element.getBoundingClientRect().height;
	for (const pseudo of ["::before", "::after"]) {
		const style = getComputedStyle(element, pseudo);
		if (style.content === "none" || style.position !== "absolute") continue;
		height = Math.max(height, px(style.height));
	}
	return height;
}

/** How far the focus ring reaches outside the element's box: its outline and its ring shadows; 0 when it is drawn inside. */
function ringReach(style: CSSStyleDeclaration) {
	let reach = 0;
	if (style.outlineStyle !== "none" && px(style.outlineWidth) > 0)
		reach = Math.max(reach, px(style.outlineWidth) + px(style.outlineOffset));
	// A ring is a shadow with no offset and no blur: "rgb(…) 0px 0px 0px 2px". Split on the commas between shadows, not those inside a colour.
	for (const shadow of style.boxShadow.split(/,(?![^(]*\))/)) {
		if (shadow.includes("inset")) continue;
		const lengths = shadow.replace(/(rgba?|oklch|oklab|color|hsl)\([^)]*\)/g, "").match(/-?[\d.]+px/g);
		if (lengths?.length === 4 && px(lengths[0] ?? "") === 0 && px(lengths[1] ?? "") === 0 && px(lengths[2] ?? "") === 0)
			reach = Math.max(reach, px(lengths[3] ?? ""));
	}
	return reach;
}

/** The box that cuts the element's ring, if one does: a box that clips or scrolls, with the ring past its edge on a side where the element shows. */
function cutBy(element: Element, reach: number): string | null {
	const box = element.getBoundingClientRect();
	for (let up = element.parentElement; up; up = up.parentElement) {
		const style = getComputedStyle(up);
		const clipsX = style.overflowX !== "visible";
		const clipsY = style.overflowY !== "visible";
		if (!clipsX && !clipsY) continue;
		const edge = up.getBoundingClientRect();
		const inner = {
			left: edge.left + px(style.borderLeftWidth),
			right: edge.right - px(style.borderRightWidth),
			top: edge.top + px(style.borderTopWidth),
			bottom: edge.bottom - px(style.borderBottomWidth),
		};
		const sides: string[] = [];
		if (clipsX && box.left - reach < inner.left - 0.5 && box.left >= inner.left - 0.5) sides.push("left");
		if (clipsX && box.right + reach > inner.right + 0.5 && box.right <= inner.right + 0.5) sides.push("right");
		if (clipsY && box.top - reach < inner.top - 0.5 && box.top >= inner.top - 0.5) sides.push("top");
		if (clipsY && box.bottom + reach > inner.bottom + 0.5 && box.bottom <= inner.bottom + 0.5) sides.push("bottom");
		if (sides.length > 0) return `${sides.join(" and ")} by ${nameOf(up).split(' "')[0]}`;
	}
	return null;
}

/** Whether the element draws a box of its own while nothing points at it: a ground or a line. Without one its corners are only its focus ring's. */
function boxed(style: CSSStyleDeclaration) {
	const clear = (colour: string) => colour === "transparent" || /,\s*0\)$|\/\s*0\)$/.test(colour);
	const line = ["Top", "Right", "Bottom", "Left"].some(
		(side) =>
			px(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
			style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" &&
			!clear(style.getPropertyValue(`border-${side.toLowerCase()}-color`)),
	);
	return line || !clear(style.backgroundColor);
}

/**
 * The control an element is part of, when it is not one alone: the box up to three levels above it that stands at a control height. An input fills its
 * field but for the field's line (35px in 36), and a segment sits inside its bar by the bar's padding (26px in 28).
 */
function fieldOf(element: Element): Element | null {
	let up = element.parentElement;
	for (let level = 0; up && level < 3; level++, up = up.parentElement)
		if (up instanceof HTMLElement && HEIGHTS.includes(up.offsetHeight)) return up;
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
		const height = element instanceof HTMLElement ? element.offsetHeight : Math.round(box.height);
		const one = element.tagName !== "TEXTAREA" && element.getAttribute("contenteditable") === null;
		const field = fieldOf(element);
		// What is typed in takes the caret wherever it is pressed and is as high as its line: only its field's height is a control's.
		const typed = element.matches(
			"input:not([type=checkbox], [type=radio], [type=button], [type=submit]), select, [role=combobox]",
		);
		// Part of a control that is at a height: the field around what is typed in, or a bar its segment fills but for the bar's padding.
		// The bar's line and padding at most: 1px and 2px on each side.
		const within = field instanceof HTMLElement && (typed || field.offsetHeight - height <= 6);
		// A radio, a check or a switch in a row that is its label: the row takes the press.
		const row = element.closest("label");
		const labelled = row instanceof HTMLElement && row.offsetHeight >= 24;
		// A link in running text is as high as its line.
		const inText = element.tagName === "A" && style.display === "inline";

		if (one && !within && height > 24 && height < 36 && !HEIGHTS.includes(height) && !allowed(element, "height"))
			found.add(`height: ${nameOf(element)} is ${height}px high; a control is 24, 28, 32 or 36`);
		if (
			one &&
			!within &&
			!inText &&
			!labelled &&
			!typed &&
			height < 24 &&
			hitHeight(element) < 24 &&
			!allowed(element, "hit")
		)
			found.add(
				`hit: ${nameOf(element)} is pressable over ${Math.round(hitHeight(element))}px; at least 24 (HIT_AREA)`,
			);

		const radius = px(style.borderTopLeftRadius);
		const pill = radius >= Math.min(box.height, box.width) / 2 - 0.5;
		if (boxed(style) && radius !== 0 && radius !== 6 && !pill && !allowed(element, "corner"))
			found.add(`corner: ${nameOf(element)} has ${radius}px corners; a pill, 6px or none`);
	}

	// Rings: each thing that takes the focus, focused in turn. The test presses a key first, so the browser draws the keyboard's ring.
	const before = document.activeElement;
	for (const element of new Set([...pressables, ...[...root.querySelectorAll(FOCUSABLE)].filter(live)])) {
		if (!(element instanceof HTMLElement) || element.tabIndex < 0 || allowed(element, "ring")) continue;
		// The text of an editor draws a caret, not a ring, and an editor focused from outside outlives its story.
		if (element.isContentEditable) continue;
		element.focus();
		if (document.activeElement !== element) continue;
		const reach = ringReach(getComputedStyle(element));
		const cut = reach > 0 ? cutBy(element, reach) : null;
		if (cut) found.add(`ring: the focus ring of ${nameOf(element)} is cut at its ${cut}`);
	}
	if (before instanceof HTMLElement) before.focus({ preventScroll: true });
	else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
	return [...found];
}

/** Waits until nothing on the page is moving (a menu opening, a sheet sliding in), so what is measured is where things come to rest. */
export async function settled() {
	await new Promise((done) => requestAnimationFrame(() => done(null)));
	await Promise.all(
		document
			.getAnimations()
			.filter((animation) => animation.effect?.getTiming().iterations !== Number.POSITIVE_INFINITY)
			.map((animation) => animation.finished.catch(() => {})),
	);
}
