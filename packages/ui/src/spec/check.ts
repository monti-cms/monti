import {
	isAction,
	isData,
	isItem,
	isSpacing,
	isText,
	type ScreenSpecDocument,
	SPACING_STEPS,
	type SpecChild,
	type SpecValue,
} from "./format";

/** Who decides a prop (parts.tsx, `CATALOG`): the design system (`variant`, `flag`), the screen (`layout`, `layout-number`), or what it says or wires. */
export type PropKind = "variant" | "flag" | "layout" | "layout-number" | "data" | "text" | "attribute";

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
	readonly children: boolean;
	readonly slots: readonly string[];
	readonly props: Readonly<Record<string, CatalogProp>>;
	readonly events: readonly string[];
}
export type Catalog = Readonly<Record<string, CatalogPart>>;

const ELEMENT_KEYS = new Set(["type", "props", "children", "slots", "visible", "repeat"]);
const show = (value: unknown) => JSON.stringify(value);

/** Whether a value written in the spec fits a prop of its kind. A value read from the data is checked again when it is drawn. */
function fits(value: SpecValue, rule: CatalogProp): boolean {
	const read = isData(value) || isItem(value);
	const plain = rule.enum ? rule.enum.includes(value as string | number) : typeof value === rule.type;
	switch (rule.kind) {
		// A list or an object (a list head's columns) comes only from the data.
		case "data":
			return read;
		// A size is the screen's own number, written in its spec.
		case "layout-number":
			return typeof value === "number";
		case "text":
			return read || isText(value) || typeof value === "string";
		case "attribute":
			return read || isAction(value) || plain;
		default:
			return read || plain;
	}
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
		const part = catalog[element.type];
		if (!part) {
			problems.push(`${id}.type: there is no part "${element.type}"`);
			continue;
		}
		for (const [name, value] of Object.entries(element.props ?? {})) {
			const rule = part.props[name];
			if (!rule) problems.push(`${id}.props.${name}: ${element.type} has no prop "${name}" a spec may write`);
			else if (!fits(value, rule)) {
				problems.push(
					`${id}.props.${name}: ${show(value)} is not ${rule.enum ? `a choice (${rule.enum.join(" | ")})` : `a ${rule.type}`}`,
				);
			}
		}
		for (const [slot, ids] of Object.entries(element.slots ?? {})) {
			if (!part.slots.includes(slot)) problems.push(`${id}.slots.${slot}: ${element.type} has no slot "${slot}"`);
			for (const child of ids) if (typeof child === "string") use(child, `${id}.slots.${slot}`);
		}
		const children = element.children ?? [];
		if (children.length > 0 && !part.children) problems.push(`${id}.children: ${element.type} takes no children`);
		children.forEach((child: SpecChild, index) => {
			const where = `${id}.children[${index}]`;
			if (typeof child === "string") use(child, where);
			else if (isSpacing(child)) {
				if (part.kind !== "layout")
					problems.push(`${where}: Spacing is only for a layout container's children (Stack)`);
				if (!(SPACING_STEPS as readonly number[]).includes(child.spacing)) {
					problems.push(`${where}: ${child.spacing} is not a spacing step (${SPACING_STEPS.join(" ")})`);
				}
				const next = children[index + 1];
				if (next !== undefined && isSpacing(next)) problems.push(`${where}: two Spacings in a row; write one`);
			} else if (part.kind === "layout")
				problems.push(`${where}: a container's children are elements and Spacing, not text`);
		});
	}
	for (const id of Object.keys(spec.elements)) {
		if (!used.has(id)) problems.push(`${id}: placed nowhere`);
	}
	return problems;
}
