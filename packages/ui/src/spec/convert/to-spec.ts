import type { Catalog } from "../check";
import type {
	ScreenSpecDocument,
	SpacingStep,
	SpecChild,
	SpecElement,
	SpecValue,
	StateValue,
	TextValue,
} from "../format";
import type { DrawnNode } from "./drawn";

/** What a drawing became. The conversion holds only when `outside` is empty: then every part, space and look of the drawing is the design system's. */
export interface Conversion {
	readonly spec: ScreenSpecDocument;
	/** What the drawing has outside the design system, one line each with where it is: a part the design system lacks, a space off the spacing steps, a look shaped by hand. Never fixed here. */
	readonly outside: readonly string[];
	/** The drawn texts no dictionary text matches, each read from `data` until someone names it (`/drawn/<id>`). */
	readonly data: Readonly<Record<string, Record<string, string>>>;
}

/**
 * Turns what a drawing says into a screen spec, the same for every tool. A plain group becomes a `Stack` with its distances as `Spacing` items and the
 * screen's own layout of it (alignment, growing, a region's width) as its props; a part
 * keeps its props; a text becomes a dictionary text when one reads exactly the same (`dictionary`: text → key), otherwise a value read from the data.
 * Nothing outside the design system is fixed or dropped silently: a space off the steps is left out and listed, and so is every look shaped by hand.
 */
export function toSpec(root: DrawnNode, catalog: Catalog, dictionary: Readonly<Record<string, string>>): Conversion {
	const elements: Record<string, SpecElement> = {};
	const outside: string[] = [];
	const drawnTexts: Record<string, string> = {};
	const used = new Map<string, number>();
	/** The drawing's ids of elements (an input's), each with the spec element it became; and the references that wait for them. */
	const drawnIds = new Map<string, string>();
	const pendingRefs: { element: string; prop: string; drawnId: string }[] = [];
	const idFor = (base: string) => {
		const name = base.charAt(0).toLowerCase() + base.slice(1);
		const count = (used.get(name) ?? 0) + 1;
		used.set(name, count);
		return count === 1 ? name : `${name}${count}`;
	};

	const textOf = (text: string): TextValue | StateValue => {
		const key = dictionary[text];
		if (key !== undefined) return { text: key };
		const id = idFor("text");
		drawnTexts[id] = text;
		return { state: `/drawn/${id}` };
	};

	const spacing = (px: number | undefined, where: string): SpecChild[] => {
		if (px === undefined || Math.round(px) === 0) return [];
		const step = Math.round(px);
		if (catalog.spacing.includes(step)) return [{ spacing: step as SpacingStep }];
		outside.push(
			`${where}: a distance of ${step}px is not a spacing step (${catalog.spacing.join(" ")}): express it as layout (a region's size or alignment), or fix the board to a token`,
		);
		return [];
	};

	/** The children of a group, with the distances between them as Spacing. */
	const spaced = (node: DrawnNode, children: readonly DrawnNode[]): SpecChild[] => {
		const out: SpecChild[] = [];
		children.forEach((child) => {
			const id = convert(child);
			// What the drawing has that no part draws is listed, not placed: its distance goes with it.
			if (id === undefined) return;
			out.push(...spacing(child.before, child.where));
			out.push(id);
		});
		out.push(...spacing(node.after, `${node.where} (end)`));
		return out;
	};

	/** The id of the element a node became, or undefined for one no part draws (a text outside any part, a shape drawn by its style): it is listed. */
	const convert = (node: DrawnNode): string | undefined => {
		for (const look of node.looks ?? []) outside.push(`${node.where}: shaped by hand: ${look}`);
		if (node.part === undefined && node.text !== undefined) {
			outside.push(`${node.where}: text outside any part: "${node.text}"`);
			return undefined;
		}
		const children = node.children ?? [];
		if (node.part === undefined && children.length === 0) return undefined;
		if (node.part === undefined) {
			const id = idFor("stack");
			const props = { ...(node.direction === "row" ? { direction: "row" } : {}), ...node.layout };
			elements[id] = {
				type: catalog.group,
				...(Object.keys(props).length > 0 ? { props } : {}),
				children: spaced(node, children),
			};
			return id;
		}
		const part = catalog.entries[node.part];
		const id = idFor(node.part);
		if (!part) {
			outside.push(`${node.where}: "${node.part}" is not a design system part`);
			elements[id] = { type: node.part };
			return id;
		}
		const props: Record<string, SpecValue> = {};
		for (const [name, value] of Object.entries(node.props ?? {})) {
			const rule = part.props[name];
			if (!rule) continue;
			if (rule.kind === "ref") pendingRefs.push({ element: id, prop: name, drawnId: String(value) });
			else props[name] = rule.kind === "text" && typeof value === "string" ? textOf(value) : value;
		}
		// The drawing's own id of this element, for a label that names it.
		if (typeof node.id === "string") drawnIds.set(node.id, id);
		let specChildren: SpecChild[];
		if (children.some((child) => (child.before ?? 0) > 0) || (node.after ?? 0) > 0) {
			// A part whose children the drawing spaces itself (a form): they go in a Stack inside it.
			const stack = idFor("stack");
			elements[stack] = { type: catalog.group, children: spaced(node, children) };
			specChildren = [stack];
		} else {
			specChildren = children.flatMap((child): SpecChild[] => {
				if (child.part === undefined && child.text !== undefined && child.children === undefined) {
					return [textOf(child.text)];
				}
				const id = convert(child);
				return id === undefined ? [] : [id];
			});
		}
		elements[id] = {
			type: node.part,
			...(Object.keys(props).length > 0 ? { props } : {}),
			...(specChildren.length > 0 ? { children: specChildren } : {}),
		};
		return id;
	};

	const rootId = convert(root) ?? idFor("empty");
	// A label names its field by the drawing's id; in the spec it is a reference to that field's element.
	for (const { element, prop, drawnId } of pendingRefs) {
		const target = drawnIds.get(drawnId);
		const props = { ...elements[element]?.props };
		if (target) props[prop] = `@${target}`;
		else outside.push(`${element}: it names "${drawnId}", which is not an element of the drawing`);
		elements[element] = { ...(elements[element] as SpecElement), props };
	}
	return { spec: { root: rootId, elements }, outside, data: { drawn: drawnTexts } };
}
