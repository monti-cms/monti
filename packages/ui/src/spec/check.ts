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

/** One part of `screen-catalog.generated.json`. */
export interface CatalogPart {
	readonly container: boolean;
	readonly children: boolean;
	readonly slots: readonly string[];
	readonly props: Readonly<
		Record<
			string,
			{ readonly enum?: readonly (string | number)[]; readonly type?: string; readonly fields?: readonly string[] }
		>
	>;
}
export type Catalog = Readonly<Record<string, CatalogPart>>;

const ELEMENT_KEYS = new Set(["type", "props", "children", "slots", "visible", "repeat"]);
const show = (value: unknown) => JSON.stringify(value);

/** Whether a value written in the spec fits a prop: a value read from the data, a text or an action is checked when it is drawn. */
function fits(value: SpecValue, rule: CatalogPart["props"][string]): boolean {
	const read = isData(value) || isItem(value);
	// A list or an object (a list head's columns) comes only from the data.
	if (rule.type === "data") return read;
	if (read || isText(value) || isAction(value)) return rule.enum === undefined || read;
	if (rule.enum) return rule.enum.includes(value as string | number);
	return typeof value === rule.type;
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
			if (!rule) problems.push(`${id}.props.${name}: ${element.type} has no prop "${name}"`);
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
				if (!part.container) problems.push(`${where}: Spacing is only for a container's children (Stack)`);
				if (!(SPACING_STEPS as readonly number[]).includes(child.spacing)) {
					problems.push(`${where}: ${child.spacing} is not a spacing step (${SPACING_STEPS.join(" ")})`);
				}
				const next = children[index + 1];
				if (next !== undefined && isSpacing(next)) problems.push(`${where}: two Spacings in a row; write one`);
			} else if (part.container) problems.push(`${where}: a container's children are elements and Spacing, not text`);
		});
	}
	for (const id of Object.keys(spec.elements)) {
		if (!used.has(id)) problems.push(`${id}: placed nowhere`);
	}
	return problems;
}
