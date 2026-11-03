import type { Catalog } from "../check";
import { isSpacing, refOf, type ScreenSpecDocument, type SpecChild } from "../format";

/** One place in a spec's tree, as the comparison reads it: the part, the props that choose its look, and what is inside in order. */
interface Shape {
	readonly label: string;
	readonly children: readonly Shape[];
	readonly slots: Readonly<Record<string, readonly Shape[]>>;
}

/**
 * A prop that chooses a look or a place (a variant, a flag, a size, a direction): a plain value. Words, values of the state, references to other elements
 * and the element's tag (`as`) say what it is or holds, not where it is.
 */
const chooses = (name: string, value: unknown) =>
	name !== "as" &&
	refOf(value) === undefined &&
	(typeof value === "string" || typeof value === "number" || typeof value === "boolean");

function shapeOf(spec: ScreenSpecDocument, catalog: Catalog, child: SpecChild): Shape | undefined {
	if (isSpacing(child)) return { label: `Spacing ${child.spacing}`, children: [], slots: {} };
	if (typeof child !== "string") return undefined;
	const element = spec.elements[child];
	if (!element) return { label: `missing "${child}"`, children: [], slots: {} };
	const props = Object.entries(element.props ?? {})
		.filter(([name, value]) => chooses(name, value))
		.map(([name, value]) => `${name}=${String(value)}`)
		.sort();
	const shapes = (list: readonly SpecChild[]): Shape[] =>
		list.flatMap((item) => {
			const inner = typeof item === "string" ? spec.elements[item] : undefined;
			// A form groups for behavior, which a board does not draw: what is inside it (and the plain column that spaces it) is compared in its place.
			if (inner && catalog.entries[inner.type]?.role === "form") {
				const only = inner.children?.length === 1 ? spec.elements[inner.children[0] as string] : undefined;
				return shapes(
					only?.type === catalog.group && only.props === undefined ? (only.children ?? []) : (inner.children ?? []),
				);
			}
			const shape = shapeOf(spec, catalog, item);
			return shape ? [shape] : [];
		});
	return {
		label: props.length > 0 ? `${element.type}(${props.join(" ")})` : element.type,
		children: shapes(element.children ?? []),
		slots: Object.fromEntries(Object.entries(element.slots ?? {}).map(([slot, ids]) => [slot, shapes(ids)])),
	};
}

/**
 * Compares the arrangement of two screen specs: the same parts, in the same order and groups, in the same slots, with the same spacing tokens. Sizes are
 * not compared, nor content. Each difference names its place: `Stack › Form › Stack[4]: the board has Separator, the spec has nothing`.
 */
export function compareStructure(
	board: ScreenSpecDocument,
	spec: ScreenSpecDocument,
	catalog: Catalog,
	names: { readonly left: string; readonly right: string } = { left: "the board", right: "the spec" },
): string[] {
	const differences: string[] = [];
	const walk = (left: readonly Shape[], right: readonly Shape[], path: string) => {
		const length = Math.max(left.length, right.length);
		for (let index = 0; index < length; index++) {
			const a = left[index];
			const b = right[index];
			const where = `${path}[${index}]`;
			if (!a || !b || a.label !== b.label) {
				differences.push(
					`${where}: ${names.left} has ${a?.label ?? "nothing"}, ${names.right} has ${b?.label ?? "nothing"}`,
				);
				continue;
			}
			const here = `${path} › ${a.label}`;
			walk(a.children, b.children, here);
			for (const slot of new Set([...Object.keys(a.slots), ...Object.keys(b.slots)])) {
				walk(a.slots[slot] ?? [], b.slots[slot] ?? [], `${here} › ${slot}`);
			}
		}
	};
	const root = (doc: ScreenSpecDocument) =>
		[shapeOf(doc, catalog, doc.root)].filter((shape): shape is Shape => shape !== undefined);
	walk(root(board), root(spec), "");
	return differences;
}
