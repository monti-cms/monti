// The HTML board adapter, run inside the page of a rendered board (a `.dc.html` board of the canvas, in the state to convert). It reads the drawing into
// the tool-neutral tree of `packages/ui/src/spec/convert/drawn.ts`. Everything that knows HTML boards is here: the design system's CSS classes and the
// part each names, which inline styles are spacing and which are looks, and how to measure distances. Another tool (Figma, a PDF) gets its own adapter
// and shares everything after it.
//
// It is a plain script: `window.readBoard(rootSelector)` returns the tree.

/** The design system's classes and the part each one draws, first match wins. `props` reads the element's own values. */
const PARTS = [
	{ match: (el) => el.matches(".mt-field"), part: "FormField", walk: "parts" },
	{
		match: (el) => el.matches(".mt-label"),
		part: "FormFieldLabel",
		props: (el) => ({ htmlFor: el.getAttribute("for") }),
	},
	{
		match: (el) => el.matches(".mt-input"),
		part: "Input",
		props: (el) => ({ id: el.id, type: el.getAttribute("type"), autoComplete: el.getAttribute("autocomplete") }),
	},
	{ match: (el) => el.matches(".mt-error"), part: "FormFieldError", props: (el) => ({ id: el.id || undefined }) },
	{
		match: (el) => el.matches(".mt-rule-label"),
		part: "Separator",
		props: (el) => ({ label: el.textContent.trim() }),
		leaf: true,
	},
	{ match: (el) => el.matches(".mt-text-btn"), part: "TextButton", props: (el) => ({ type: el.getAttribute("type") }) },
	{
		match: (el) => el.matches(".mt-btn"),
		part: "Button",
		props: (el) => ({
			type: el.getAttribute("type"),
			variant: ["primary", "secondary", "danger", "outline-danger"].find((name) =>
				el.classList.contains(`mt-btn--${name}`),
			),
			size: el.classList.contains("mt-btn--sm") ? "sm" : undefined,
		}),
	},
	{
		match: (el) => /^H[1-4]$/.test(el.tagName) && [...el.classList].some((name) => name.startsWith("text-")),
		part: "Heading",
		props: (el) => ({ as: el.tagName.toLowerCase(), variant: role(el) }),
	},
	{
		match: (el) => [...el.classList].some((name) => name.startsWith("text-")),
		part: "Text",
		props: (el) => ({ as: el.tagName.toLowerCase(), variant: role(el) }),
	},
	{ match: (el) => el.tagName === "FORM", part: "Form", walk: "group" },
];

/** The classes this adapter reads: any other class on an element is a look of its own. */
const KNOWN = /^(mt|mt-(field|label|input|error|rule-label|text-btn|btn|btn--[a-z-]+)|text-[a-z]+|dark)$/;

/** Inline style properties that are spacing (measured as distances) or plain layout (the group's axis); every other one is a look. */
const SPACING = /^(margin|padding|gap|row-gap|column-gap)(-|$)/;
const LAYOUT = /^(display|flex-direction|box-sizing)$/;

const role = (el) => [...el.classList].find((name) => name.startsWith("text-"))?.slice(5);
const shown = (el) => {
	const style = getComputedStyle(el);
	const box = el.getBoundingClientRect();
	return style.display !== "none" && style.visibility !== "hidden" && (box.width > 0 || box.height > 0);
};
const label = (el) => {
	const classes = [...el.classList].filter((name) => name !== "mt").slice(0, 2);
	return `${el.tagName.toLowerCase()}${classes.map((name) => `.${name}`).join("")}`;
};

/** The looks an element shapes by hand: inline style that is not spacing or layout, and classes the design system does not have. */
function looksOf(el, part) {
	const looks = [];
	for (const declaration of (el.getAttribute("style") ?? "").split(";")) {
		const [name, ...value] = declaration.split(":");
		const property = name?.trim();
		if (!property || SPACING.test(property) || LAYOUT.test(property)) continue;
		looks.push(`${property}: ${value.join(":").trim()}${part ? " (on a part)" : ""}`);
	}
	for (const name of el.classList) if (!KNOWN.test(name)) looks.push(`class ${name}`);
	if (el.tagName.toLowerCase() === "svg") looks.push("an icon drawn in the board, not from the icon table");
	return looks;
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

function read(el, where) {
	const rule = PARTS.find((each) => each.match(el));
	const here = `${where} › ${label(el)}`;
	const looks = looksOf(el, rule);
	if (rule) {
		const props = Object.fromEntries(
			Object.entries(rule.props?.(el) ?? {}).filter(([, value]) => value != null && value !== ""),
		);
		if (rule.leaf) return { where: here, part: rule.part, props, looks };
		const node = { where: here, part: rule.part, props, looks };
		if (rule.walk === "group") Object.assign(node, measured(el, here));
		else node.children = drawnChildren(el).map((child, index) => readChild(child, `${here}[${index}]`));
		return node;
	}
	if (el.tagName.toLowerCase() === "svg") return { where: here, looks };
	if (el.children.length === 0 && el.textContent.trim()) return { where: here, text: el.textContent.trim(), looks };
	if (el.children.length === 0) return { where: here, looks: [...looks, "an element that only draws by its style"] };
	return { where: here, direction: directionOf(el), looks, ...measured(el, here) };
}

function readChild(node, where) {
	if (node.nodeType === Node.TEXT_NODE) return { where, text: node.textContent.trim() };
	return read(node, where);
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
			children.push({
				...read(child, `${where}[${index}]`),
				looks: [...looksOf(child), "placed by position, outside the flow"],
			});
			continue;
		}
		const rect = child.getBoundingClientRect();
		if (isSpacer(child)) continue;
		const before = aligned && children.length === 0 ? undefined : Math.round(start(rect) - edge);
		children.push({ ...read(child, `${where}[${index}]`), before });
		edge = end(rect);
	}
	const last = end(box) - Number.parseFloat(row ? border.borderRightWidth : border.borderBottomWidth);
	return { children, after: aligned ? undefined : Math.round(last - edge) };
}

window.readBoard = (selector) => {
	const root = document.querySelector(selector);
	if (!root) throw new Error(`no element "${selector}" in the board`);
	return read(root, "board");
};
