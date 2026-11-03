import {
	isAction,
	isItem,
	isSpacing,
	isState,
	isTemplate,
	isWords,
	refOf,
	type ScreenSpecDocument,
	type SpecChild,
	type SpecValue,
	templateRead,
	type Visible,
} from "./format";

/** Who decides a prop (parts.tsx, `CATALOG`): the design system (`variant`, `flag`), the screen (`layout`, `layout-number`), or what it reads, says or refers to. */
export type PropKind = "variant" | "flag" | "layout" | "layout-number" | "data" | "text" | "ref" | "state" | "action";

/** One prop of an entry: its kind and the values it takes. */
export interface CatalogProp {
	readonly kind: PropKind;
	readonly enum?: readonly (string | number)[];
	readonly type?: string;
	readonly fields?: readonly string[];
}

/** One entry of `screen-catalog.generated.json`: a part, or a layout container the screen arranges with. */
export interface CatalogPart {
	readonly kind: "part" | "layout";
	/** What the renderer does for it beyond drawing: a `form` makes a `button` in it its submit. */
	readonly role?: "form" | "button";
	/** It may take an element `bind` (the data a field holds and sends). */
	readonly bind: boolean;
	readonly children: boolean;
	readonly slots: readonly string[];
	readonly props: Readonly<Record<string, CatalogProp>>;
	readonly events: readonly string[];
}
/**
 * A design system's catalog (`catalog.generated.json` of its pack): the steps of its spacing scale, the layout container groups are drawn with, and its
 * entries by the name a spec uses.
 */
export interface Catalog {
	readonly spacing: readonly number[];
	/** The layout entry a plain group becomes (a board's group, a form's inside). */
	readonly group: string;
	readonly entries: Readonly<Record<string, CatalogPart>>;
}

const ELEMENT_KEYS = new Set(["type", "props", "children", "slots", "visible", "repeat", "bind"]);
const show = (value: unknown) => JSON.stringify(value);

/** Whether a value written in the spec fits a prop of its kind. A value read from the data is checked again when it is drawn. */
function fits(value: SpecValue, rule: CatalogProp, elements: ScreenSpecDocument["elements"]): boolean {
	const read = isState(value) || isItem(value);
	const plain = rule.enum ? rule.enum.includes(value as string | number) : typeof value === rule.type;
	switch (rule.kind) {
		// A list, an object or a picture's address comes only from the state.
		case "data":
		case "state":
			return read;
		// A size is the screen's own number, written in its spec.
		case "layout-number":
			return typeof value === "number";
		// Words are a dictionary text, a template or a value of the state: never written out in the spec.
		case "text":
			return isWords(value);
		case "ref": {
			const target = refOf(value);
			return target !== undefined && target in elements;
		}
		case "action":
			return isAction(value);
		default:
			return read || plain;
	}
}

/** What a template, a visibility or a repeat reads, checked to be one of the shapes a spec has. */
function wordsProblem(value: unknown): string | undefined {
	if (!isWords(value)) return `${show(value)} is not words: { "text" }, { "template", "values" } or { "state" }`;
	if (isTemplate(value)) {
		for (const [name, read] of Object.entries(value.values ?? {})) {
			if (templateRead(read) === undefined)
				return `the value "${name}" of a template reads "$state.path" or "$item.path", not ${show(read)}`;
		}
	}
	return undefined;
}

function visibleProblem(visible: Visible | undefined): string | undefined {
	if (visible === undefined || isState(visible) || isItem(visible)) return undefined;
	if ("not" in visible) return visibleProblem(visible.not);
	return `${show(visible)} is not { "state" }, { "item" } or { "not" }`;
}

/**
 * What in a screen spec leaves the design system or does not hold together, one line each with the element and the place (`emailInput.props.variant:
 * "big" is not a choice (default | sm …)`). Empty when the spec is good. `pnpm check:screens` runs it on every `*.screen.json`; `ScreenSpec` will not draw a
 * spec it finds a problem in.
 */
export function checkSpec(spec: ScreenSpecDocument, catalog: Catalog): string[] {
	const problems: string[] = [];
	const used = new Map<string, string>();
	const use = (id: string, where: string) => {
		if (!spec.elements[id]) problems.push(`${where}: there is no element "${id}"`);
		else if (used.has(id)) problems.push(`${where}: "${id}" is already placed in ${used.get(id)}`);
		else used.set(id, where);
	};
	if (!spec.elements[spec.root]) problems.push(`root: there is no element "${spec.root}"`);
	used.set(spec.root, "root");

	for (const [id, element] of Object.entries(spec.elements)) {
		for (const key of Object.keys(element)) {
			if (!ELEMENT_KEYS.has(key)) problems.push(`${id}.${key}: an element has no "${key}"`);
		}
		const part = catalog.entries[element.type];
		if (!part) {
			problems.push(`${id}.type: there is no part "${element.type}"`);
			continue;
		}
		for (const [name, value] of Object.entries(element.props ?? {})) {
			const rule = part.props[name];
			if (!rule) problems.push(`${id}.props.${name}: ${element.type} has no prop "${name}" a spec may write`);
			else if (!fits(value, rule, spec.elements)) {
				const wanted = {
					text: 'words: { "text" }, { "template", "values" } or { "state" }',
					ref: "a reference to an element of the spec (@id)",
					action: 'an action by name ({ "action" })',
					data: 'a value of the state ({ "state" })',
					state: 'a value of the state ({ "state" })',
				}[rule.kind as string];
				problems.push(
					`${id}.props.${name}: ${show(value)} is not ${wanted ?? (rule.enum ? `a choice (${rule.enum.join(" | ")})` : `a ${rule.type}`)}`,
				);
			} else if (rule.kind === "text") {
				const problem = wordsProblem(value);
				if (problem) problems.push(`${id}.props.${name}: ${problem}`);
			}
		}
		if (element.bind !== undefined) {
			if (!part.bind) problems.push(`${id}.bind: ${element.type} holds no data to bind`);
			else if (typeof element.bind !== "string" || !element.bind.startsWith("/")) {
				problems.push(`${id}.bind: ${show(element.bind)} is not a pointer into the state (/form/email)`);
			}
		}
		const visible = visibleProblem(element.visible);
		if (visible) problems.push(`${id}.visible: ${visible}`);
		if (element.repeat !== undefined && !isState(element.repeat)) {
			problems.push(`${id}.repeat: ${show(element.repeat)} is not a list of the state ({ "state" })`);
		}
		for (const [slot, ids] of Object.entries(element.slots ?? {})) {
			if (!part.slots.includes(slot)) problems.push(`${id}.slots.${slot}: ${element.type} has no slot "${slot}"`);
			ids.forEach((child, index) => {
				if (typeof child === "string") use(child, `${id}.slots.${slot}`);
				else {
					const problem = wordsProblem(child);
					if (problem) problems.push(`${id}.slots.${slot}[${index}]: ${problem}`);
				}
			});
		}
		const children = element.children ?? [];
		if (children.length > 0 && !part.children) problems.push(`${id}.children: ${element.type} takes no children`);
		children.forEach((child: SpecChild, index) => {
			const where = `${id}.children[${index}]`;
			if (typeof child === "string") use(child, where);
			else if (isSpacing(child)) {
				if (part.kind !== "layout")
					problems.push(`${where}: Spacing is only for a layout container's children (Stack)`);
				if (!catalog.spacing.includes(child.spacing)) {
					problems.push(`${where}: ${child.spacing} is not a spacing step (${catalog.spacing.join(" ")})`);
				}
				const next = children[index + 1];
				if (next !== undefined && isSpacing(next)) problems.push(`${where}: two Spacings in a row; write one`);
			} else if (part.kind === "layout")
				problems.push(`${where}: a container's children are elements and Spacing, not text`);
			else {
				const problem = wordsProblem(child);
				if (problem) problems.push(`${where}: ${problem}`);
			}
		});
	}
	for (const id of Object.keys(spec.elements)) {
		if (!used.has(id)) problems.push(`${id}: placed nowhere`);
	}
	return problems;
}
