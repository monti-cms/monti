import { BLOCK_BY_NAME, FENCE_BLOCKS } from "../../blocks/derive";
import { withoutBlockIds } from "../../mdx/block-ids";
import { type StoredDocument, UNPARSED_NODE } from "../../mdx/stored-document";
import type { CmsNode } from "../../mdx/types";

/**
 * Block comparison of two source versions (translation screen).
 *
 * Splits the source the translator last confirmed and the current source into blocks and finds changed, added and removed blocks.
 * Expandable boxes (`translateInside` in the block definition, e.g. callout, tabs, alignment) are expanded and their header line (translatable attributes) and inner blocks are each
 * compared. Used by both server and browser.
 *
 * Blocks are paired by block id (`TranslationUnit.node.id`) first, so an edited block stays the same block and a moved block shows as moved;
 * blocks without an id are paired by kind and content.
 */

/** Names of expandable boxes: the box itself is a skeleton and each inner block is a unit. */
const EXPANDED = new Set([...BLOCK_BY_NAME.values()].filter((block) => block.translateInside).map((b) => b.name));

const translatableOf = (name: string): string | undefined => {
	const block = BLOCK_BY_NAME.get(name);
	return Object.entries(block?.attributes ?? {}).find(([, attribute]) => attribute.translatable)?.[0];
};

/** Boxes that gather the child blocks' translatable attributes (e.g. tab names) into one header line. Block name → [child block name, attribute]. */
const CHILD_HEADERS = new Map(
	[...BLOCK_BY_NAME.values()].flatMap((block) => {
		const child = BLOCK_BY_NAME.get(block.children?.blocks?.[0] ?? "");
		const attribute = child && translatableOf(child.name);
		return child && attribute ? [[block.name, [child.name, attribute] as const] as const] : [];
	}),
);

/** Blocks with no text to translate, so the source is used as is. */
const STRUCTURAL = new Set(["horizontalRule", "html", "mdxEsm", "mdxExpression"]);

/** Blocks a human must check even without text (comments and labels may be inside). Code blocks (fence blocks such as a diagram are code blocks too). */
const ALWAYS_MANUAL = new Set(["codeBlock", "math", ...[...FENCE_BLOCKS.values()].map((block) => block.name)]);

export type UnitKind = "block" | "header";

export interface TranslationUnit {
	/** Matching key: ancestor box kind + unit kind + node kind. Only units with the same key are paired. */
	readonly key: string;
	readonly kind: UnitKind;
	/** Node kind (`paragraph`, `codeBlock`, `callout` …). */
	readonly type: string;
	/** For a block, that node; for a header line, the box node. */
	readonly node: CmsNode;
	/** Content of the unit, equal exactly when two units read the same: the JSON of the block (without block ids), or for a header line the JSON of the translatable attributes. */
	readonly source: string;
	/** Block id of the enclosing box (`undefined` at the top level or when the box has no id). */
	readonly parentId: string | undefined;
	/** Nothing to translate, so the source is used as is (dividers, empty paragraphs, images without a description, etc.). */
	readonly auto: boolean;
}

/** Translated value of a header line. A box's translatable attributes (e.g. callout title) or values gathered from children (e.g. tab names). */
export type HeaderValue = { title: string } | { labels: string[] };

const textOf = (node: CmsNode): string =>
	(node.text ?? "") + (node.content ?? []).map(textOf).join("") + attrText(node);

const attrText = (node: CmsNode): string => {
	if (node.type !== "image") return "";
	return [node.attrs?.alt, node.attrs?.title].filter((value) => typeof value === "string").join("");
};

const isAuto = (node: CmsNode): boolean => {
	if (STRUCTURAL.has(node.type)) return true;
	if (ALWAYS_MANUAL.has(node.type)) {
		const value = node.attrs?.code ?? node.attrs?.value;
		return typeof value === "string" ? value.trim().length === 0 : false;
	}
	return textOf(node).trim().length === 0;
};

const blockSource = (node: CmsNode) => JSON.stringify(withoutBlockIds([node])[0]);

const stringAttr = (node: CmsNode, name: string) => {
	const value = node.attrs?.[name];
	return typeof value === "string" ? value : "";
};

const headerValue = (node: CmsNode): HeaderValue | null => {
	const fromChildren = CHILD_HEADERS.get(node.type);
	if (fromChildren) {
		const [childType, attribute] = fromChildren;
		const labels = (node.content ?? [])
			.filter((child) => child.type === childType)
			.map((child) => stringAttr(child, attribute));
		return labels.some((label) => label.trim()) ? { labels } : null;
	}
	// A child that the parent gathers and translates (one tab) gets no header line of its own.
	if (BLOCK_BY_NAME.get(node.type)?.parent) return null;
	const attribute = translatableOf(node.type);
	if (!attribute) return null;
	const title = stringAttr(node, attribute);
	return title.trim() ? { title } : null;
};

/** Splits a source document into translation units (document order). */
export function flattenUnits(doc: Pick<StoredDocument, "content">): TranslationUnit[] {
	const units: TranslationUnit[] = [];
	const walk = (nodes: readonly CmsNode[], scope: string, parentId?: string) => {
		for (const node of nodes) {
			if (EXPANDED.has(node.type)) {
				const header = headerValue(node);
				if (header) {
					units.push({
						key: `${scope}|header|${node.type}`,
						kind: "header",
						type: node.type,
						node,
						source: JSON.stringify(header),
						parentId,
						auto: false,
					});
				}
				walk(node.content ?? [], `${scope}/${node.type}`, node.id);
				continue;
			}
			units.push({
				key: `${scope}|block|${node.type}`,
				kind: "block",
				type: node.type,
				node,
				source: blockSource(node),
				parentId,
				auto: isAuto(node),
			});
		}
	};
	walk(doc.content ?? [], "");
	return units;
}

/** Blocks changed in one source version, in document order. */
export type SourceChange =
	| { readonly kind: "changed"; readonly before: TranslationUnit; readonly after: TranslationUnit }
	| { readonly kind: "added"; readonly after: TranslationUnit }
	/** Only from a comparison by block id: the block (edited or not, see `edited`) sits elsewhere than before. */
	| {
			readonly kind: "moved";
			readonly before: TranslationUnit;
			readonly after: TranslationUnit;
			/** The block's own content changed as well. */
			readonly edited: boolean;
	  }
	| { readonly kind: "removed"; readonly before: TranslationUnit };

/** Longest common subsequence of two lists (pairs whose key and source fragment are both equal). A list of [before index, after index]. */
const commonPairs = (before: readonly TranslationUnit[], after: readonly TranslationUnit[]): [number, number][] => {
	const same = (i: number, j: number) => before[i]?.key === after[j]?.key && before[i]?.source === after[j]?.source;
	const cols = after.length + 1;
	const table = new Array<number>((before.length + 1) * cols).fill(0);
	for (let i = before.length - 1; i >= 0; i -= 1) {
		for (let j = after.length - 1; j >= 0; j -= 1) {
			table[i * cols + j] = same(i, j)
				? (table[(i + 1) * cols + j + 1] ?? 0) + 1
				: Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
		}
	}
	const pairs: [number, number][] = [];
	let i = 0;
	let j = 0;
	while (i < before.length && j < after.length) {
		if (same(i, j)) {
			pairs.push([i, j]);
			i += 1;
			j += 1;
		} else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) i += 1;
		else j += 1;
	}
	return pairs;
};

/**
 * Pairs units by kind and content only (no ids). Equal blocks are omitted; a block whose content alone changed at the same position (a pair with the same key) is
 * `changed`, a new block is `added`, and a removed block is `removed`. `onEqual` is called with each pair of equal blocks.
 */
const diffUnits = (
	before: readonly TranslationUnit[],
	after: readonly TranslationUnit[],
	onEqual?: (before: TranslationUnit, after: TranslationUnit) => void,
): SourceChange[] => {
	const changes: SourceChange[] = [];
	const common = commonPairs(before, after);
	for (const [bi, ai] of common) onEqual?.(before[bi] as TranslationUnit, after[ai] as TranslationUnit);
	const anchors = [...common, [before.length, after.length] as [number, number]];
	let prevBefore = 0;
	let prevAfter = 0;
	for (const [bi, ai] of anchors) {
		// Segment between anchors: pairing same-key items in order gives changed blocks; leftovers are removed or added blocks.
		let b = prevBefore;
		for (let a = prevAfter; a < ai; a += 1) {
			const next = after[a];
			if (!next) continue;
			let found = -1;
			for (let k = b; k < bi; k += 1) {
				if (before[k]?.key === next.key) {
					found = k;
					break;
				}
			}
			if (found === -1) {
				changes.push({ kind: "added", after: next });
				continue;
			}
			for (let k = b; k < found; k += 1) {
				const gone = before[k];
				if (gone) changes.push({ kind: "removed", before: gone });
			}
			const old = before[found];
			if (old) changes.push({ kind: "changed", before: old, after: next });
			b = found + 1;
		}
		for (let k = b; k < bi; k += 1) {
			const gone = before[k];
			if (gone) changes.push({ kind: "removed", before: gone });
		}
		prevBefore = bi + 1;
		prevAfter = ai + 1;
	}
	return changes;
};

/** Positions in `values` of one longest strictly increasing subsequence. */
const longestIncreasing = (values: readonly number[]): Set<number> => {
	/** For each length, the position of the smallest value that ends an increasing subsequence of that length. */
	const tails: number[] = [];
	const previous = new Array<number>(values.length).fill(-1);
	values.forEach((value, position) => {
		let low = 0;
		let high = tails.length;
		while (low < high) {
			const mid = (low + high) >> 1;
			if ((values[tails[mid] as number] as number) < value) low = mid + 1;
			else high = mid;
		}
		previous[position] = low > 0 ? (tails[low - 1] as number) : -1;
		tails[low] = position;
	});
	const kept = new Set<number>();
	for (let position = tails.length > 0 ? (tails[tails.length - 1] as number) : -1; position >= 0; ) {
		kept.add(position);
		position = previous[position] as number;
	}
	return kept;
};

/**
 * Pairs units by block id (`node.id`, the id of the box for a header unit), then pairs the units left without a partner by kind and content (`diffUnits`),
 * each stretch between two blocks that kept their place on its own.
 * A pair is unchanged (omitted) when its source is equal, otherwise `changed`. A pair is `moved` when it is not on the longest increasing subsequence of the
 * pairs' positions (in document order of the units, boxes expanded), so only as many blocks are reported as moved as needed to explain the new order, or when the
 * block now sits in another box. Pairs found by content only (no id) are never `moved`.
 */
const diffById = (before: readonly TranslationUnit[], after: readonly TranslationUnit[]): SourceChange[] => {
	const beforeById = new Map<string, number>();
	before.forEach((unit, index) => {
		const id = unit.node.id;
		if (id !== undefined && !beforeById.has(id)) beforeById.set(id, index);
	});
	// Position in `before` of the id partner of each unit of `after` (-1: none).
	const partnerOf = new Array<number>(after.length).fill(-1);
	const taken = new Set<number>();
	after.forEach((unit, index) => {
		const id = unit.node.id;
		const found = id === undefined ? undefined : beforeById.get(id);
		if (found === undefined || taken.has(found)) return;
		taken.add(found);
		partnerOf[index] = found;
	});

	const own = new Array<SourceChange | undefined>(after.length);
	// Pairs in the order of `before`: [before position, after position].
	const pairs = partnerOf
		.flatMap((found, index) => (found === -1 ? [] : [[found, index] as const]))
		.sort((left, right) => left[0] - right[0]);
	const inOrder = longestIncreasing(pairs.map(([, index]) => index));
	pairs.forEach(([found, index], rank) => {
		const old = before[found] as TranslationUnit;
		const next = after[index] as TranslationUnit;
		const edited = old.source !== next.source;
		if (!inOrder.has(rank) || old.parentId !== next.parentId) {
			own[index] = { kind: "moved", before: old, after: next, edited };
		} else if (edited) {
			own[index] = { kind: "changed", before: old, after: next };
		}
	});

	// Units without an id partner: by kind and content, within the stretches between blocks that kept their place.
	const beforeIndex = new Map(before.map((unit, index) => [unit, index] as const));
	const afterIndex = new Map(after.map((unit, index) => [unit, index] as const));
	const stable: (readonly [number, number])[] = [
		[-1, -1],
		...pairs.filter((_, rank) => inOrder.has(rank)),
		[before.length, after.length],
	];
	// Position in `after` of the partner of each unit of `before` (-1: none).
	const partnerOfBefore = new Array<number>(before.length).fill(-1);
	for (const [found, index] of pairs) partnerOfBefore[found] = index;
	const removed = new Map<number, SourceChange>();
	const equal = (old: TranslationUnit, next: TranslationUnit) => {
		partnerOfBefore[beforeIndex.get(old) as number] = afterIndex.get(next) as number;
	};
	for (let at = 0; at + 1 < stable.length; at += 1) {
		const [fromBefore, fromAfter] = stable[at] as readonly [number, number];
		const [toBefore, toAfter] = stable[at + 1] as readonly [number, number];
		const restBefore = before.filter((_, index) => index > fromBefore && index < toBefore && !taken.has(index));
		const restAfter = after.filter((_, index) => index > fromAfter && index < toAfter && partnerOf[index] === -1);
		for (const change of diffUnits(restBefore, restAfter, equal)) {
			if (change.kind === "removed") {
				removed.set(beforeIndex.get(change.before) as number, change);
				continue;
			}
			const index = afterIndex.get(change.after) as number;
			own[index] = change;
			if (change.kind === "changed") partnerOfBefore[beforeIndex.get(change.before) as number] = index;
		}
	}

	// A removed block is listed after the closest block before it that has a partner (at that partner's new position), or first.
	const trailing = new Map<number, SourceChange[]>();
	let anchor = -1;
	for (let index = 0; index < before.length; index += 1) {
		const partner = partnerOfBefore[index] as number;
		if (partner !== -1) anchor = partner;
		const gone = removed.get(index);
		if (gone) trailing.set(anchor, [...(trailing.get(anchor) ?? []), gone]);
	}
	const changes: SourceChange[] = [...(trailing.get(-1) ?? [])];
	for (let index = 0; index < after.length; index += 1) {
		const change = own[index];
		if (change) changes.push(change);
		changes.push(...(trailing.get(index) ?? []));
	}
	return changes;
};

/**
 * Compares two source versions block by block. Equal blocks are omitted; a block whose content alone changed is `changed`, a new block is `added`, and a removed
 * block is `removed`. Blocks are paired by block id, which also finds `moved` blocks (see `diffById`). `null` if either is not a document (an `unparsed` body).
 */
export function diffSources(before: StoredDocument, after: StoredDocument): SourceChange[] | null {
	const unparsed = (doc: StoredDocument) => doc.content.some((node) => node.type === UNPARSED_NODE);
	if (unparsed(before) || unparsed(after)) return null;
	return diffById(flattenUnits(before), flattenUnits(after));
}
