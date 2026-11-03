import { isSpacing, type ScreenSpecDocument, type SpecChild } from "../format";

/** One place in a spec's tree, as the comparison reads it: the part, the props that choose its look, and what is inside in order. */
interface Shape {
	readonly label: string;
	readonly children: readonly Shape[];
	readonly slots: Readonly<Record<string, readonly Shape[]>>;
}

/** A prop that chooses a look (a variant, a size, a direction): a plain value. A value read from the data or the dictionary is content, not arrangement. */
const chooses = (value: unknown) =>
	typeof value === "string" || typeof value === "number" || typeof value === "boolean";

function shapeOf(spec: ScreenSpecDocument, child: SpecChild): Shape | undefined {
	if (isSpacing(child)) return { label: `Spacing ${child.spacing}`, children: [], slots: {} };
	if (typeof child !== "string") return undefined;
	const element = spec.elements[child];
	if (!element) return { label: `missing "${child}"`, children: [], slots: {} };
	const props = Object.entries(element.props ?? {})
		.filter(([, value]) => chooses(value))
		.map(([name, value]) => `${name}=${String(value)}`)
		.sort();
	const shapes = (list: readonly SpecChild[]) =>
		list.map((item) => shapeOf(spec, item)).filter((shape): shape is Shape => shape !== undefined);
	return {
		label: props.length > 0 ? `${element.type}(${props.join(" ")})` : element.type,
		children: shapes(element.children ?? []),
		slots: Object.fromEntries(Object.entries(element.slots ?? {}).map(([slot, ids]) => [slot, shapes(ids)])),
	};
}

/**
 * Compares the arrangement of two screen specs: the same parts, in the same order and groups, in the same slots, with the same spacing tokens. Sizes are
 * not compared, nor content. Each difference names its place: `AuthPage › body › Stack[2]: the board has Separator(label…), the spec has nothing`.
 */
export function compareStructure(
	board: ScreenSpecDocument,
	spec: ScreenSpecDocument,
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
		[shapeOf(doc, doc.root)].filter((shape): shape is Shape => shape !== undefined);
	walk(root(board), root(spec), "");
	return differences;
}
