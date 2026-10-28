import { type CmsNode, UNPARSED_NODE } from "@monti-cms/core/document";
import { diffSources, flattenUnits, type Site, type TranslationUnit } from "@monti-cms/core/site";
import { documentKey } from "../../editor/document-key";
import { type EntryForm, type FormValue, formText, TRANSLATION_FORM_KEY, titleKeyOf } from "./entry-form";

/**
 * Two versions of one entry set side by side (the compare screen): the properties that differ, the title, and the body block by block. Everything here is
 * a value; the screen only draws it.
 */

/** A run of text, and whether it is one of the words that differ from the other side. */
export interface Segment {
	readonly text: string;
	readonly changed: boolean;
}

/** One block of a body as the compare screen draws it. */
export interface CompareBlock {
	readonly kind: "heading" | "paragraph" | "code" | "image" | "other";
	/** The heading level, for a heading. */
	readonly level?: number;
	/** The block's type name, for a block the screen has no look for. */
	readonly type: string;
	readonly segments: readonly Segment[];
}

/** A property that differs, with its value on each side. */
export interface CompareProperty {
	readonly name: string;
	readonly label: string;
	readonly left: readonly Segment[];
	readonly right: readonly Segment[];
}

export interface EntryComparison {
	readonly title: { readonly left: readonly Segment[]; readonly right: readonly Segment[] };
	/** Only the properties whose values differ, the same list on both sides. */
	readonly properties: readonly CompareProperty[];
	readonly left: readonly CompareBlock[];
	readonly right: readonly CompareBlock[];
	/** How many places differ: properties, the title and blocks. */
	readonly count: number;
}

const TOKEN = /\s+|[^\s]+/g;
/** Above this many token pairs the exact comparison is skipped for a cheaper one: the words in front and behind that both sides share. */
const EXACT_LIMIT = 250_000;

const wholeSegments = (text: string): Segment[] => (text ? [{ text, changed: true }] : []);

/** Joins neighbouring tokens of the same kind into runs. */
function runs(tokens: readonly { text: string; changed: boolean }[]): Segment[] {
	const out: Segment[] = [];
	for (const token of tokens) {
		const last = out.at(-1);
		if (last && last.changed === token.changed)
			out[out.length - 1] = { text: last.text + token.text, changed: last.changed };
		else out.push({ ...token });
	}
	return out;
}

/** Marks the words that are not in the other text, on each side. Equal texts have no mark. */
export function diffText(before: string, after: string): { before: Segment[]; after: Segment[] } {
	if (before === after)
		return {
			before: before ? [{ text: before, changed: false }] : [],
			after: after ? [{ text: after, changed: false }] : [],
		};
	const a = before.match(TOKEN) ?? [];
	const b = after.match(TOKEN) ?? [];
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA -= 1;
		endB -= 1;
	}
	const midA = a.slice(start, endA);
	const midB = b.slice(start, endB);
	const markedA = midA.map((text) => ({ text, changed: true }));
	const markedB = midB.map((text) => ({ text, changed: true }));
	if (midA.length * midB.length <= EXACT_LIMIT && midA.length > 0 && midB.length > 0) {
		// Longest common subsequence of the words in the middle: the words both sides share keep no mark.
		const cols = midB.length + 1;
		const table = new Array<number>((midA.length + 1) * cols).fill(0);
		for (let i = midA.length - 1; i >= 0; i -= 1) {
			for (let j = midB.length - 1; j >= 0; j -= 1) {
				table[i * cols + j] =
					midA[i] === midB[j]
						? (table[(i + 1) * cols + j + 1] ?? 0) + 1
						: Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
			}
		}
		let i = 0;
		let j = 0;
		while (i < midA.length && j < midB.length) {
			// Whitespace alone is never a shared word worth marking around.
			if (midA[i] === midB[j] && midA[i]?.trim()) {
				(markedA[i] as { changed: boolean }).changed = false;
				(markedB[j] as { changed: boolean }).changed = false;
				i += 1;
				j += 1;
			} else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) i += 1;
			else j += 1;
		}
	}
	const frontA = a.slice(0, start).map((text) => ({ text, changed: false }));
	const frontB = b.slice(0, start).map((text) => ({ text, changed: false }));
	const backA = a.slice(endA).map((text) => ({ text, changed: false }));
	const backB = b.slice(endB).map((text) => ({ text, changed: false }));
	return { before: runs([...frontA, ...markedA, ...backA]), after: runs([...frontB, ...markedB, ...backB]) };
}

/** The text a block reads as: its words, a new line at each hard break and between blocks inside it (list items, table cells). */
export function blockText(node: CmsNode): string {
	if (node.type === "text") return node.text ?? "";
	if (node.type === "hardBreak") return "\n";
	if (node.type === "image") return String(node.attrs?.alt ?? "") || String(node.attrs?.src ?? "");
	if (!node.content?.length) return "";
	const inline = node.content.every(
		(child) => child.type === "text" || child.type === "hardBreak" || child.type === "image",
	);
	return node.content.map(blockText).join(inline ? "" : "\n");
}

/** The text of the heading line of a box (a callout's title, the tab names). */
function headerText(source: string): string {
	try {
		const value = JSON.parse(source) as { title?: unknown; labels?: unknown };
		if (typeof value.title === "string") return value.title;
		if (Array.isArray(value.labels)) return value.labels.join(" · ");
	} catch {
		// A fragment that cannot be read is shown as it is.
	}
	return source;
}

interface Placed {
	readonly unit: TranslationUnit;
	readonly kind: CompareBlock["kind"];
	readonly level?: number;
	readonly text: string;
}

function place(unit: TranslationUnit): Placed {
	if (unit.kind === "header") return { unit, kind: "paragraph", text: headerText(unit.source) };
	const { node } = unit;
	if (node.type === "heading")
		return { unit, kind: "heading", level: Number(node.attrs?.level ?? 2), text: blockText(node) };
	if (node.type === "paragraph") return { unit, kind: "paragraph", text: blockText(node) };
	if (node.type === "codeBlock") return { unit, kind: "code", text: String(node.attrs?.code ?? "") || blockText(node) };
	if (node.type === UNPARSED_NODE) return { unit, kind: "code", text: String(node.attrs?.source ?? "") };
	if (node.type === "image") return { unit, kind: "image", text: blockText(node) };
	return { unit, kind: "other", text: blockText(node) };
}

const display = (placed: Placed, segments: readonly Segment[]): CompareBlock => ({
	kind: placed.kind,
	type: placed.unit.type,
	...(placed.level === undefined ? {} : { level: placed.level }),
	segments,
});

const valueText = (value: FormValue | undefined): string => {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.join(", ");
	return "";
};

/** Names for what the comparison writes itself. */
export interface CompareLabels {
	readonly slug: string;
}

/**
 * Compares two versions of an entry of `collection`: `left` is the one the person holds, `right` the one it is set against. Properties are listed only
 * when they differ; the body is compared block by block (paired by block id, see `diffSources`), and a block that changed in place marks only the words
 * that differ, while a block that is only on one side, or only moved, is marked whole.
 */
export function compareEntries(
	site: Site,
	collection: string,
	left: EntryForm,
	right: EntryForm,
	labels: CompareLabels,
): EntryComparison {
	const titleKey = titleKeyOf(site, collection);
	const titleDiff = diffText(formText(left, titleKey), formText(right, titleKey));
	const title = { left: titleDiff.before, right: titleDiff.after };
	const titleDiffers = formText(left, titleKey) !== formText(right, titleKey);

	const known = site.isCollection(collection) ? site.storedFields(collection) : [];
	const labelOf = new Map(known.map(({ name, field }) => [name, String(field.label ?? name)]));
	const optionLabel = (name: string, value: string): string => {
		const found = known.find((stored) => stored.name === name)?.field;
		return found?.kind === "select" && value in found.options ? String(found.options[value]) : value;
	};
	const names = [
		"slug",
		...known.map(({ name }) => name),
		...Object.keys({ ...left, ...right }).filter(
			(key) => key !== "slug" && key !== "doc" && key !== TRANSLATION_FORM_KEY && !labelOf.has(key),
		),
	].filter((name, index, all) => all.indexOf(name) === index && name !== titleKey);

	const properties: CompareProperty[] = [];
	for (const name of names) {
		const a = valueText(left[name]);
		const b = valueText(right[name]);
		if (a === b) continue;
		const diff = diffText(optionLabel(name, a), optionLabel(name, b));
		properties.push({
			name,
			label: name === "slug" ? labels.slug : (labelOf.get(name) ?? name),
			left: diff.before,
			right: diff.after,
		});
	}

	const leftUnits = flattenUnits(site, left.doc).map(place);
	const rightUnits = flattenUnits(site, right.doc).map(place);
	const changes = diffSources(site, left.doc, right.doc);
	let leftBlocks: CompareBlock[];
	let rightBlocks: CompareBlock[];
	let bodyCount: number;
	if (changes === null) {
		// A body that could not be read has no blocks to pair: each side is shown as it is, marked whole when the two differ.
		const differs = documentKey(site, left.doc) !== documentKey(site, right.doc);
		leftBlocks = leftUnits.map((placed) =>
			display(placed, differs ? wholeSegments(placed.text) : [{ text: placed.text, changed: false }]),
		);
		rightBlocks = rightUnits.map((placed) =>
			display(placed, differs ? wholeSegments(placed.text) : [{ text: placed.text, changed: false }]),
		);
		bodyCount = differs ? 1 : 0;
	} else {
		const marksOf = (side: "before" | "after") => {
			const map = new Map<string, Segment[]>();
			const keyOf = (unit: TranslationUnit) => `${unit.kind}:${(unit.node as { id?: string }).id ?? ""}:${unit.source}`;
			for (const change of changes) {
				if (side === "before" && change.kind === "added") continue;
				if (side === "after" && change.kind === "removed") continue;
				const unit =
					change.kind === "added"
						? change.after
						: change.kind === "removed"
							? change.before
							: side === "before"
								? change.before
								: change.after;
				const text = place(unit).text;
				if (change.kind === "changed" || (change.kind === "moved" && change.edited)) {
					const pair = diffText(place(change.before).text, place(change.after).text);
					map.set(keyOf(unit), side === "before" ? pair.before : pair.after);
				} else map.set(keyOf(unit), wholeSegments(text));
			}
			return { map, keyOf };
		};
		const before = marksOf("before");
		const after = marksOf("after");
		leftBlocks = leftUnits.map((placed) =>
			display(placed, before.map.get(before.keyOf(placed.unit)) ?? [{ text: placed.text, changed: false }]),
		);
		rightBlocks = rightUnits.map((placed) =>
			display(placed, after.map.get(after.keyOf(placed.unit)) ?? [{ text: placed.text, changed: false }]),
		);
		bodyCount = changes.length;
	}

	return {
		title,
		properties,
		left: leftBlocks,
		right: rightBlocks,
		count: properties.length + (titleDiffers ? 1 : 0) + bodyCount,
	};
}
