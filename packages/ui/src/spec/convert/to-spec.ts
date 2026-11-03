import type { Catalog } from "../check";
import {
	type DataValue,
	type ScreenSpecDocument,
	SPACING_STEPS,
	type SpacingStep,
	type SpecChild,
	type SpecElement,
	type SpecValue,
	type TextValue,
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
	const idFor = (base: string) => {
		const name = base.charAt(0).toLowerCase() + base.slice(1);
		const count = (used.get(name) ?? 0) + 1;
		used.set(name, count);
		return count === 1 ? name : `${name}${count}`;
	};

	const textOf = (text: string): TextValue | DataValue => {
		const key = dictionary[text];
		if (key !== undefined) return { text: key };
		const id = idFor("text");
		drawnTexts[id] = text;
		return { data: `/drawn/${id}` };
	};

	const spacing = (px: number | undefined, where: string): SpecChild[] => {
		if (px === undefined || Math.round(px) === 0) return [];
		const step = Math.round(px);
		if ((SPACING_STEPS as readonly number[]).includes(step)) return [{ spacing: step as SpacingStep }];
		outside.push(`${where}: a space of ${step}px is not a spacing step (${SPACING_STEPS.join(" ")})`);
		return [];
	};

	/** The children of a group, with the distances between them as Spacing. */
	const spaced = (node: DrawnNode, children: readonly DrawnNode[]): SpecChild[] => {
		const out: SpecChild[] = [];
		children.forEach((child) => {
			out.push(...spacing(child.before, child.where));
			out.push(convert(child));
		});
		out.push(...spacing(node.after, `${node.where} (end)`));
		return out;
	};

	const convert = (node: DrawnNode): string => {
		for (const look of node.looks ?? []) outside.push(`${node.where}: shaped by hand: ${look}`);
		if (node.part === undefined && node.text !== undefined) {
			outside.push(`${node.where}: text outside any part: "${node.text}"`);
			const id = idFor("text");
			elements[id] = { type: "Text", children: [textOf(node.text)] };
			return id;
		}
		const children = node.children ?? [];
		if (node.part === undefined) {
			const id = idFor("stack");
			const props = { ...(node.direction === "row" ? { direction: "row" } : {}), ...node.layout };
			elements[id] = {
				type: "Stack",
				...(Object.keys(props).length > 0 ? { props } : {}),
				children: spaced(node, children),
			};
			return id;
		}
		const part = catalog[node.part];
		const id = idFor(node.part);
		if (!part) {
			outside.push(`${node.where}: "${node.part}" is not a design system part`);
			elements[id] = { type: node.part };
			return id;
		}
		const props: Record<string, SpecValue> = {};
		for (const [name, value] of Object.entries(node.props ?? {})) {
			if (!part.props[name]) continue;
			props[name] = typeof value === "string" && name === "label" ? textOf(value) : value;
		}
		let specChildren: SpecChild[];
		if (children.some((child) => (child.before ?? 0) > 0) || (node.after ?? 0) > 0) {
			// A part whose children the drawing spaces itself (a form): they go in a Stack inside it.
			const stack = idFor("stack");
			elements[stack] = { type: "Stack", children: spaced(node, children) };
			specChildren = [stack];
		} else {
			specChildren = children.map((child) =>
				child.part === undefined && child.text !== undefined && child.children === undefined
					? textOf(child.text)
					: convert(child),
			);
		}
		elements[id] = {
			type: node.part,
			...(Object.keys(props).length > 0 ? { props } : {}),
			...(specChildren.length > 0 ? { children: specChildren } : {}),
		};
		return id;
	};

	const rootId = convert(root);
	return { spec: { root: rootId, elements }, outside, data: { drawn: drawnTexts } };
}
