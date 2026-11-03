// The HTML board adapter, run inside the page of a rendered board (an HTML page in the state to convert). It reads the drawing into the tool-neutral
// tree of `packages/ui/src/spec/convert/drawn.ts`: which inline styles are spacing, which are the screen's layout and which are looks, and how far apart
// things are. Which classes name which parts is the design system's, so it comes from the pack (`window.boardPack`, the pack's `html-board.js`, loaded
// first): `parts`, the rules that read an element as a part, and `known`, the classes the design system has. Another tool (Figma, a PDF) gets its own
// adapter and shares everything after it.
//
// It is a plain script: `window.readBoard(rootSelector, page)` returns the tree. `page` is the layout the board's root gets as the page (the pack's
// `board.page`, `{ minHeight: "screen" }` for a page as tall as the window).
//
// The layout it reads is the tool's own vocabulary, the props a pack's layout entry takes: `direction`, `align`, `justify`, `grow`, `width`, `maxWidth`,
// `minWidth`, `minHeight`.

const { parts: PARTS, known: KNOWN } = window.boardPack ?? { parts: [], known: /^$/ };

/** Inline style properties that are spacing (measured as distances), and the screen's own layout of a group (open: the screen decides it, and the
 * spec writes it on its Stack). On a part, layout is a look: a part is placed by the group around it. Every other property is a look. */
const SPACING = /^(margin|padding|gap|row-gap|column-gap)(-|$)/;
const LAYOUT = /^(display|flex-direction|box-sizing)$/;
const SCREEN_LAYOUT =
	/^(width|max-width|min-width|min-height|align-items|justify-content|flex|flex-grow|position|top|right|bottom|left)$/;

const shown = (el) => {
	const style = getComputedStyle(el);
	const box = el.getBoundingClientRect();
	return style.display !== "none" && style.visibility !== "hidden" && (box.width > 0 || box.height > 0);
};
const label = (el) => {
	const classes = [...el.classList].slice(0, 2);
	return `${el.tagName.toLowerCase()}${classes.map((name) => `.${name}`).join("")}`;
};

/** Whether an inline declaration changes how the element is drawn: one a part's class already gives (a button's `justify-content: center`) does not. */
function changes(el, property) {
	const style = el.getAttribute("style");
	const written = getComputedStyle(el).getPropertyValue(property);
	el.style.removeProperty(property);
	const without = getComputedStyle(el).getPropertyValue(property);
	el.setAttribute("style", style);
	return written !== without;
}

/**
 * The looks an element shapes by hand: inline style that is not spacing or the screen's layout, and classes the design system does not have. Inside a
 * part, a distance is a look too: the part spaces its own inside, so a margin the board adds there is not the design system's.
 */
function looksOf(el, part, root = false, inPart = false) {
	const looks = [];
	for (const declaration of (el.getAttribute("style") ?? "").split(";")) {
		const [name, ...value] = declaration.split(":");
		const property = name?.trim();
		if (!property || LAYOUT.test(property)) continue;
		if (SPACING.test(property)) {
			if (inPart && !part?.asProps?.includes(property) && changes(el, property))
				looks.push(`${property}: ${value.join(":").trim()} (a distance inside a part)`);
			continue;
		}
		if (!part && SCREEN_LAYOUT.test(property)) continue;
		// Pinning a line to the group's end is the screen's layout, on a part too: it becomes the place of the part in the spec.
		if (/^(position|top|right|bottom|left)$/.test(property)) continue;
		// The board's frame is the page itself: its height and ground are the window's.
		if (root && /^(min-height|height|background)$/.test(property)) continue;
		if (part && (part.asProps?.includes(property) || !changes(el, property))) continue;
		looks.push(`${property}: ${value.join(":").trim()}${part ? " (on a part)" : ""}`);
	}
	for (const name of el.classList) if (!KNOWN.test(name)) looks.push(`class ${name}`);
	if (el.tagName.toLowerCase() === "svg" && !part) looks.push("an icon drawn in the board, not from the icon table");
	return looks;
}

/** The screen's own layout of a group: how it aligns its children, whether it grows, its width and height. */
function layoutOf(el, page) {
	const style = getComputedStyle(el);
	const flex = style.display.includes("flex");
	const align = { center: "center", "flex-end": "end", end: "end", "flex-start": "start", baseline: "baseline" }[
		style.alignItems
	];
	const justify = { center: "center", "flex-end": "end", end: "end", "space-between": "between" }[style.justifyContent];
	const layout = {};
	if (flex && align) layout.align = align;
	if (flex && justify) layout.justify = justify;
	if (Number.parseFloat(style.flexGrow) > 0) layout.grow = true;
	// A size the board writes in px is the region's; a width the box only takes from its parent is not.
	for (const [property, name] of [
		["width", "width"],
		["max-width", "maxWidth"],
		["min-width", "minWidth"],
	]) {
		const written = el.style.getPropertyValue(property);
		const value = property === "max-width" ? style.maxWidth : written;
		if (value && value !== "none" && (property === "max-width" || written.endsWith("px"))) {
			layout[name] = Math.round(Number.parseFloat(value));
		}
	}
	return { ...layout, ...page };
}

/** The axis a group's children run along, as laid out. */
function directionOf(el) {
	const style = getComputedStyle(el);
	return style.display.includes("flex") && style.flexDirection.startsWith("row") ? "row" : "column";
}

/** The children that are drawn: elements shown, and text runs; the board runtime's own wrappers (`sc-if`) are seen through. */
function drawnChildren(el) {
	const out = [];
	for (const child of el.childNodes) {
		if (child.nodeType === Node.TEXT_NODE) {
			if (child.textContent.trim()) out.push(child);
		} else if (child.nodeType === Node.ELEMENT_NODE) {
			if (child.tagName.includes("-") && !child.shadowRoot) out.push(...drawnChildren(child));
			else if (shown(child)) out.push(child);
		}
	}
	return out;
}

/** An empty element that only holds a height or a width: a spacer, measured as a distance and not drawn. */
function isSpacer(el) {
	if (el.children.length > 0 || el.textContent.trim() || el.className || el.tagName === "INPUT") return false;
	const style = getComputedStyle(el);
	const drawsLine = ["Top", "Right", "Bottom", "Left"].some(
		(side) => Number.parseFloat(style[`border${side}Width`]) > 0,
	);
	return !drawsLine && style.backgroundColor === "rgba(0, 0, 0, 0)";
}

function read(el, where, page = undefined, inPart = false) {
	const rule = PARTS.find((each) => each.match(el));
	// A board drawn inside a board (its own page root) is read as a page too: its height and ground are the page's.
	const root = page !== undefined || rule?.frame === true;
	const here = `${where} › ${label(el)}`;
	const looks = looksOf(el, rule?.frame ? undefined : rule, root, inPart);
	// A state the board draws for a behavior (an open tooltip): the spec draws looks, the behavior comes later.
	if (rule?.ignore) return { where: here };
	if (rule?.frame) {
		return framed(el, { where: here, direction: directionOf(el), layout: {}, looks, ...measured(el, here) });
	}
	if (rule) {
		const props = Object.fromEntries(
			Object.entries(rule.props?.(el) ?? {}).filter(([, value]) => value != null && value !== ""),
		);
		// The drawing's own id goes with the node, for a label that names it; it never reaches the spec.
		const named = el.id ? { id: el.id } : {};
		if (rule.leaf) return { where: here, part: rule.part, props, looks, ...named };
		const node = { where: here, part: rule.part, props, looks, ...named };
		// A part's named places, each an element of it whose inside fills the place; its children, from the element the rule names or its own.
		const inside = (holder, at) =>
			drawnChildren(holder).map((child, index) => readChild(child, `${at}[${index}]`, true));
		const slots = Object.entries(rule.slots?.(el) ?? {}).filter(([, holder]) => holder);
		if (slots.length > 0)
			node.slots = Object.fromEntries(slots.map(([name, holder]) => [name, inside(holder, `${here} › ${name}`)]));
		const holder = rule.slots ? rule.children?.(el) : el;
		node.children = holder ? inside(holder, here) : [];
		return node;
	}
	if (el.tagName.toLowerCase() === "svg") return { where: here, looks };
	if (el.children.length === 0 && el.textContent.trim()) return { where: here, text: el.textContent.trim(), looks };
	if (el.children.length === 0) return { where: here, looks: [...looks, "an element that only draws by its style"] };
	return framed(el, {
		where: here,
		direction: directionOf(el),
		layout: layoutOf(el, page),
		looks,
		...measured(el, here),
	});
}

/**
 * A group with a line pinned to its end (`position: absolute; bottom: …`) and padding at its sides, written as the spec writes them: a column whose
 * first region grows and holds the rest, the pinned line last, the padding as Spacing at the ends of a row around it.
 */
function framed(el, node) {
	const style = getComputedStyle(el);
	const pinned = node.children.filter((child) => child.pinned);
	let out = node;
	if (pinned.length > 0) {
		const { minHeight, ...regionLayout } = node.layout;
		const region = {
			...node,
			where: `${node.where} (region)`,
			layout: { ...regionLayout, grow: true },
			looks: [],
			children: node.children.filter((child) => !child.pinned),
			before: undefined,
		};
		out = {
			where: node.where,
			direction: "column",
			layout: minHeight ? { minHeight } : {},
			looks: node.looks,
			children: [
				{ ...region, before: Math.round(Number.parseFloat(style.paddingTop)) },
				...pinned.map(({ pinned: _, ...child }) => child),
			],
			after: Math.round(
				Number.parseFloat(getComputedStyle(document.querySelector(`[data-pinned="${pinned[0].pinnedId}"]`)).bottom),
			),
		};
	}
	const side = Math.round(Number.parseFloat(style.paddingLeft));
	if (side > 0 && side === Math.round(Number.parseFloat(style.paddingRight))) {
		return { where: `${node.where} (sides)`, direction: "row", children: [{ ...out, before: side }], after: side };
	}
	return out;
}

function readChild(node, where, inPart = false) {
	if (node.nodeType === Node.TEXT_NODE) return { where, text: node.textContent.trim() };
	return read(node, where, undefined, inPart);
}

/** A group's children with the distance before each and after the last, along the group's axis, spacers folded into the distances. */
function measured(el, where) {
	const row = directionOf(el) === "row";
	const box = el.getBoundingClientRect();
	const start = (rect) => (row ? rect.left : rect.top);
	const end = (rect) => (row ? rect.right : rect.bottom);
	const border = getComputedStyle(el);
	let edge = start(box) + Number.parseFloat(row ? border.borderLeftWidth : border.borderTopWidth);
	const justify = border.display.includes("flex") ? border.justifyContent : "normal";
	const aligned = !/^(normal|flex-start|start|stretch)$/.test(justify);
	const children = [];
	for (const [index, child] of drawnChildren(el).entries()) {
		if (child.nodeType === Node.TEXT_NODE) {
			children.push({ where: `${where}[${index}]`, text: child.textContent.trim() });
			continue;
		}
		if (getComputedStyle(child).position === "absolute") {
			const id = `${where}[${index}]`;
			const node = read(child, id);
			// Something the pack leaves out (the frame's corner button) takes no place.
			if (node.part === undefined && node.text === undefined && node.children === undefined && !node.looks?.length)
				continue;
			// A line pinned to the group's end: the screen's layout, placed after a growing region (see `framed`).
			if (child.style.bottom !== "" && child.style.top === "") {
				child.dataset.pinned = id;
				children.push({ ...node, pinned: true, pinnedId: id });
			} else children.push({ ...node, looks: [...(node.looks ?? []), "placed by position, not by the layout"] });
			continue;
		}
		const rect = child.getBoundingClientRect();
		if (isSpacer(child)) continue;
		const before = aligned && children.length === 0 ? undefined : Math.round(start(rect) - edge);
		children.push({ ...read(child, `${where}[${index}]`), before });
		edge = end(rect);
	}
	const last = end(box) - Number.parseFloat(row ? border.borderRightWidth : border.borderBottomWidth);
	// A box larger than its content (a page as tall as the window, a column that grows) keeps the rest as its size: only its padding is a distance.
	const padding = Number.parseFloat(row ? border.paddingRight : border.paddingBottom);
	const rest = Math.round(last - edge);
	return { children, after: aligned ? undefined : rest > padding + 1 ? Math.round(padding) : rest };
}

window.readBoard = (selector, page = {}) => {
	const root = document.querySelector(selector);
	if (!root) throw new Error(`no element "${selector}" in the board`);
	return read(root, "board", page);
};
