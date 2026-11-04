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

const { parts: PARTS, known: KNOWN, frame: FRAME = [] } = window.boardPack ?? { parts: [], known: /^$/ };
/** The layout the board's page gets (as tall as the window), for the boards drawn inside it too. */
let PAGE = {};

/** Inline style properties that are spacing (measured as distances), and the screen's own layout of a group (open: the screen decides it, and the
 * spec writes it on its Stack). On a part, layout is a look: a part is placed by the group around it. Every other property is a look. */
const SPACING = /^(margin|padding|gap|row-gap|column-gap)(-|$)/;
const LAYOUT = /^(display|flex-direction|box-sizing)$/;
const SCREEN_LAYOUT =
	/^(width|max-width|min-width|min-height|align-items|justify-content|flex|flex-grow|flex-shrink|flex-wrap|position|top|right|bottom|left)$/;

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
		// A value the board writes that changes nothing: a state's "fully shown", or what the element would inherit anyway.
		if (/^inherit$/.test(el.style.getPropertyValue(property).trim())) continue;
		if (property === "opacity" && Number.parseFloat(el.style.getPropertyValue(property)) === 1) continue;
		if (part && property === "flex" && el.dataset.sized !== undefined) continue;
		// Pinning a line to the group's end is the screen's layout, on a part too: it becomes the place of the part in the spec.
		if (/^(position|top|right|bottom|left)$/.test(property)) continue;
		// The board's frame is the page itself: its height and ground are the window's.
		// The board's frame is the page itself: its height and ground are the window's, and what the pack names (`frame`) the app's frame does.
		if (root && (/^(min-height|height|background)$/.test(property) || FRAME.includes(property))) continue;
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
	if (style.flexWrap === "wrap") layout.wrap = true;
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

/** A group whose one child the board centres with automatic side margins (`margin: 0 auto`): the group centres it. */
function centred(el) {
	const only = drawnChildren(el).filter((child) => child.nodeType === Node.ELEMENT_NODE);
	if (only.length !== 1 || directionOf(el) === "row") return {};
	const margin = (side) => only[0].style.getPropertyValue(`margin-${side}`) || only[0].style.margin.split(" ")[1];
	return margin("left") === "auto" && (margin("right") === "auto" || only[0].style.margin.split(" ").length <= 3)
		? { align: "center" }
		: {};
}

/**
 * The size a board gives a part as its place in a flexible row (`flex: 1 1 180px`): a region's size, which the screen's layout holds, never the part.
 * The part is read standing in a region of that size.
 */
function sizedPart(el, rule) {
	if (!rule || rule.frame || rule.ignore || el.dataset.sized !== undefined) return undefined;
	const flex = el.style.getPropertyValue("flex");
	const basis = /\b(\d+)px\b/.exec(flex)?.[1];
	if (!flex || !basis) return undefined;
	return { grow: Number.parseFloat(getComputedStyle(el).flexGrow) > 0 || undefined, minWidth: Number(basis) };
}

/** The axis a group's children run along, as laid out. */
function directionOf(el) {
	const style = getComputedStyle(el);
	// A grid of several column tracks lays its children out along a row.
	if (style.display.includes("grid")) return gridColumns(el) > 1 ? "row" : "column";
	if (style.display.includes("flex")) return style.flexDirection.startsWith("row") ? "row" : "column";
	// Children that flow like words (inline ones) run along a line.
	const elements = drawnChildren(el).filter((child) => child.nodeType === Node.ELEMENT_NODE);
	return elements.length > 0 && elements.every((child) => getComputedStyle(child).display.startsWith("inline"))
		? "row"
		: "column";
}

/** What `measured` read, with the element's own looks and any the reading found (a two-way grid). */
function withLooks({ gridLooks = [], ...read }, looks) {
	return { ...read, looks: [...looks, ...gridLooks] };
}

/** How many column tracks a grid has, as laid out. */
function gridColumns(el) {
	return getComputedStyle(el)
		.gridTemplateColumns.split(" ")
		.filter((track) => track !== "none" && track !== "").length;
}

/** A grid whose children fill more than one row and more than one column: a layout of its own, which a column or a row cannot say. */
function isTwoWayGrid(el) {
	if (!getComputedStyle(el).display.includes("grid") || gridColumns(el) < 2) return false;
	return drawnChildren(el).filter((child) => child.nodeType === Node.ELEMENT_NODE).length > gridColumns(el);
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
	// A flex or grid container draws its children in their `order`, not as written: read them as drawn.
	const order = (node) => (node.nodeType === Node.ELEMENT_NODE ? Number(getComputedStyle(node).order) || 0 : 0);
	return out
		.map((node, index) => [node, index])
		.sort((a, b) => order(a[0]) - order(b[0]) || a[1] - b[1])
		.map(([node]) => node);
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

/**
 * The words in a part's element that its rule neither reads into a prop nor hands on (to a place or as its children): what converting would drop
 * without a word. Marks drawn as a single sign (×, +, →) and what the board hides from reading are the part's own.
 */
function leftOut(el, rule, props, holders) {
	if (rule.ownWords) return [];
	const read = holders.flat().filter(Boolean);
	// What the props say, read as words: a value's line breaks are spaces, as the board's words are read.
	const said = JSON.stringify(props).replace(/\\n/g, " ").replace(/\s+/g, " ");
	const out = [];
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node.textContent.replace(/\s+/g, " ").trim();
		const parent = node.parentElement;
		if (!text || !parent || !shown(parent) || parent.closest("[aria-hidden=true]")) continue;
		if (read.some((holder) => holder === parent || holder.contains(parent))) continue;
		// What the rule says another part hands on (a note its parent reads).
		if (rule.leaves && [...el.querySelectorAll(rule.leaves)].some((left) => left.contains(parent))) continue;
		if (text.length <= 2 && !/[\p{L}\p{N}]/u.test(text)) continue;
		if (said.includes(JSON.stringify(text).slice(1, -1))) continue;
		let ignored = false;
		for (let at = parent; at && at !== el; at = at.parentElement) {
			if (PARTS.some((each) => each.ignore && each.match(at))) ignored = true;
		}
		if (ignored) continue;
		out.push(`left out by the ${rule.part} rule: "${text.slice(0, 40)}"`);
	}
	return out;
}

function read(el, where, page = undefined, inPart = false) {
	// A rule that groups an element with its neighbours is read where they are measured; each member is read by its own rule.
	const rule = PARTS.find((each) => !each.group && each.match(el));
	// A board drawn inside a board (its own page root) is read as a page too: its height and ground are the page's.
	const root = page !== undefined || rule?.frame === true;
	const here = `${where} › ${label(el)}`;
	// Inside a part, a plain group's own distances are measured as Spacing; only a part or a text there has none of its own to give.
	const group = !rule && [...el.children].some((child) => shown(child));
	const looks = looksOf(el, rule?.frame ? undefined : rule, root, inPart && !group);
	const sized = sizedPart(el, rule);
	if (sized) {
		el.dataset.sized = "";
		const node = read(el, where, page, inPart);
		delete el.dataset.sized;
		return { where: `${here} (region)`, direction: "column", layout: sized, looks: [], children: [node] };
	}
	// A state the board draws for a behavior (an open tooltip): the spec draws looks, the behavior comes later.
	if (rule?.ignore) return { where: here };
	// What opens over the screen is read apart, as the root's overlay (see `readBoard`); where the board draws it, it takes no place.
	if (rule?.overlay && el.dataset.overlay === undefined) return { where: here };
	if (rule?.frame) {
		// The board's own root is the page whatever rule it matches: it takes the page's layout (as tall as the window).
		// A board drawn inside a board (its own page root) is a page too: as tall as the window.
		const layout = el.matches(".sc-host") ? {} : { ...(page ?? PAGE) };
		return framed(el, { where: here, direction: directionOf(el), layout, ...withLooks(measured(el, here), looks) });
	}
	if (rule) {
		const props = Object.fromEntries(
			Object.entries(rule.props?.(el) ?? {}).filter(([, value]) => value != null && value !== ""),
		);
		// The drawing's own id goes with the node, for a label that names it; it never reaches the spec.
		const id = rule.idOf?.(el) ?? el.id;
		const named = id ? { id } : {};
		if (rule.leaf)
			return { where: here, part: rule.part, props, looks: [...looks, ...leftOut(el, rule, props, [])], ...named };
		const node = { where: here, part: rule.part, props, looks, ...named };
		// A part's named places, each an element of it whose inside fills the place; its children, from the element the rule names or its own.
		const inside = (holder, at) =>
			drawnChildren(holder).map((child, index) => readChild(child, `${at}[${index}]`, true));
		// A place is filled with an element's inside, or (a list of elements) with those elements themselves.
		const fill = (holder, name) =>
			Array.isArray(holder)
				? holder.filter(Boolean).map((member, index) => read(member, `${here} › ${name}[${index}]`, undefined, true))
				: inside(holder, `${here} › ${name}`);
		const slots = Object.entries(rule.slots?.(el) ?? {}).filter(([, holder]) =>
			Array.isArray(holder) ? holder.length > 0 : holder,
		);
		if (slots.length > 0) node.slots = Object.fromEntries(slots.map(([name, holder]) => [name, fill(holder, name)]));
		const holder = rule.slots ? rule.children?.(el) : el;
		// What the rule hands on: its places and its children; any other words in the element are dropped, and said so.
		const handed = [...slots.map(([, place]) => place), Array.isArray(holder) ? holder : [holder]].flat();
		node.looks = [...node.looks, ...leftOut(el, rule, props, handed)];
		// Children are an element's inside, or (a list of elements) those elements themselves.
		// A part that holds a run of its own (a sheet's body): its children are a group the screen spaces, from the part's inside edge to its inside edge.
		if (rule.stacked && holder && !Array.isArray(holder)) {
			const run = measured(holder, here);
			// The part's own gap between its children is its rhythm, not the screen's: only a board that adds to it (or sets it to none and spaces
			// its children itself) gives the screen distances to keep, and then the run is a group of the screen's.
			const gap = Number.parseFloat(getComputedStyle(holder).rowGap) || 0;
			// A gap the board writes on the holder is its own choice, not the part's rhythm.
			const own = !holder.style.gap && run.children.slice(1).every((child) => Math.abs((child.before ?? 0) - gap) < 1);
			if (!own) {
				const children = run.children.map((child, index) => (index === 0 ? { ...child, before: 0 } : child));
				node.children = [{ where: `${here} (run)`, direction: "column", layout: {}, children }];
				return node;
			}
		}
		node.children = Array.isArray(holder)
			? holder.map((member, index) => read(member, `${here}[${index}]`, undefined, true))
			: holder
				? inside(holder, here)
				: [];
		// The element the children come from is the part's own inside: what the board writes on it is read as on the part.
		if (holder && !Array.isArray(holder) && holder !== el)
			node.looks = [...looks, ...looksOf(holder, rule, false, true)];
		return node;
	}
	if (el.tagName.toLowerCase() === "svg") return { where: here, looks };
	if (el.children.length === 0 && el.textContent.trim()) return { where: here, text: el.textContent.trim(), looks };
	if (el.children.length === 0) return { where: here, looks: [...looks, "an element that only draws by its style"] };
	return framed(el, {
		where: here,
		direction: directionOf(el),
		layout: { ...layoutOf(el, page), ...centred(el) },
		...withLooks(measured(el, here), looks),
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
	if (isTwoWayGrid(el)) {
		// Its children are read in order; the grid itself is reported once, not as distances that run back on every row.
		return {
			children: drawnChildren(el).map((child, index) => readChild(child, `${where}[${index}]`)),
			gridLooks: ["a grid of rows and columns, which the layout has no word for"],
		};
	}
	const row = directionOf(el) === "row";
	const box = el.getBoundingClientRect();
	const start = (rect) => (row ? rect.left : rect.top);
	const end = (rect) => (row ? rect.right : rect.bottom);
	const border = getComputedStyle(el);
	let edge = start(box) + Number.parseFloat(row ? border.borderLeftWidth : border.borderTopWidth);
	const justify = border.display.includes("flex") ? border.justifyContent : "normal";
	const aligned = !/^(normal|flex-start|start|stretch)$/.test(justify);
	const children = [];
	const taken = new Set();
	for (const [index, child] of drawnChildren(el).entries()) {
		if (taken.has(child)) continue;
		if (child.nodeType === Node.TEXT_NODE) {
			children.push({ where: `${where}[${index}]`, text: child.textContent.trim() });
			continue;
		}
		// Siblings the design system holds in one part (a list's head row and its rows in one table): read as that part, measured as one.
		const group = PARTS.find((rule) => rule.group && rule.match(child));
		if (group) {
			const members = group.group(child).filter(Boolean);
			for (const member of members) taken.add(member);
			const first = members[0].getBoundingClientRect();
			const last = members[members.length - 1].getBoundingClientRect();
			children.push({
				where: `${where}[${index}] (${group.part})`,
				part: group.part,
				props: {},
				looks: [],
				children: members.map((member, at) => read(member, `${where}[${index + at}]`, undefined, true)),
				before: Math.round(start(first) - edge),
			});
			edge = end(last);
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
		if (isSpacer(child)) {
			// A spacer that grows is the layout taking the room left (a footer pushed down), not a distance: what comes before it is a region that
			// grows, and what follows is placed after that region.
			if (Number.parseFloat(getComputedStyle(child).flexGrow) > 0 && children.length > 0) {
				const [first, ...rest] = children;
				children.splice(0, children.length, {
					where: `${where} (region)`,
					direction: row ? "row" : "column",
					layout: { grow: true },
					looks: [],
					children: [{ ...first, before: undefined }, ...rest],
					before: first.before,
					after: 0,
				});
				edge = end(rect);
			}
			continue;
		}
		// A part the board pulls back over the room before it (a header kept in place over a padded page) takes that room as its own: no distance.
		const pulled = Number.parseFloat(getComputedStyle(child)[row ? "marginLeft" : "marginTop"]) < 0;
		const before = (aligned && children.length === 0) || pulled ? undefined : Math.round(start(rect) - edge);
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
	PAGE = page;
	const node = read(root, "board", page);
	// What opens over the screen (a sheet), read as the parts they are, in the order the board draws them.
	const overlays = [...root.querySelectorAll("*")]
		.filter((el) => shown(el) && PARTS.find((rule) => !rule.group && rule.match(el))?.overlay)
		.map((el, index) => {
			el.dataset.overlay = "";
			const overlay = read(el, `board › overlay[${index}]`);
			delete el.dataset.overlay;
			return overlay;
		});
	return overlays.length > 0 ? { ...node, overlays } : node;
};
