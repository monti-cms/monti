import { sortKeys } from "../core/sort-keys";
import type { JsonValue } from "../core/types";
import type { CmsNode } from "./types";

/**
 * Block ids: every block node of a stored document carries an `id` that is unique within the document. Ids are not written to MDX
 * and are not part of the content hash; they only say which block is which across versions of the same body.
 *
 * A body read from MDX (the source panel, an import, AI output, an old client) has no ids, so they are inherited from the previous
 * version of the body by pairing its blocks with the new ones (`assignBlockIds`); a block with no partner gets a new id.
 *
 * A block of a translation may also carry `sourceId`, the id of the source block it was made from (`linkedToSource`). It is kept and dropped
 * with `id`: not written to MDX, not hashed, inherited along with the id, and it names a block of another document, so it is never checked
 * against this one. When the source block's id changes, the link simply stops matching.
 */

/** 8 characters of base36. Unique within one document; documents never share an id space. */
export const BLOCK_ID_PATTERN = /^[0-9a-z]{8}$/;

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

export const newBlockId = (): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(8));
	let id = "";
	for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
	return id;
};

export const isBlockId = (value: unknown): value is string => typeof value === "string" && BLOCK_ID_PATTERN.test(value);

/** Blocks whose children are inline content (text, marks, inline nodes). Everything else holds blocks. */
const TEXTBLOCKS = new Set(["paragraph", "heading", "tableCell"]);

/** Calls `visit` for every block node, parents before children, with the types of its ancestor blocks. */
export const forEachBlock = (
	nodes: readonly CmsNode[],
	visit: (node: CmsNode, ancestors: readonly string[]) => void,
	ancestors: readonly string[] = [],
): void => {
	for (const node of nodes) {
		if (node.text !== undefined) continue;
		visit(node, ancestors);
		if (node.content && !TEXTBLOCKS.has(node.type)) forEachBlock(node.content, visit, [...ancestors, node.type]);
	}
};

const withoutIdsNode = (node: CmsNode): CmsNode => {
	const { id: _id, sourceId: _sourceId, content, ...rest } = node;
	// Keys stay in the stored order, so a document without ids reads (and hashes) as it did before ids existed.
	return sortedNode(content ? { ...rest, content: content.map(withoutIdsNode) } : rest);
};

/** The same nodes with every block id and source link removed (what the content hash and document comparisons see). */
export const withoutBlockIds = (nodes: readonly CmsNode[]): CmsNode[] => nodes.map(withoutIdsNode);

/**
 * What a block reads as: its kind, attributes and everything inside it (two tables with the same attributes differ by their cells). Keys are
 * sorted at every depth: a stored block and the same block freshly read write their keys (and their attributes' keys) in different orders.
 */
const readsAs = (node: CmsNode): string => JSON.stringify(sortKeys(withoutIdsNode(node) as unknown as JsonValue));

interface Slot {
	readonly node: CmsNode;
	/** Ancestor block kinds + kind: only blocks in the same place in the tree are paired. */
	readonly place: string;
	/** `place` + what the block reads as: blocks that read the same. */
	readonly key: string;
}

const slotsOf = (nodes: readonly CmsNode[]): Slot[] => {
	const slots: Slot[] = [];
	forEachBlock(nodes, (node, ancestors) => {
		const place = [...ancestors, node.type].join(">");
		slots.push({ node, place, key: `${place}|${readsAs(node)}` });
	});
	return slots;
};

/** Above this many cells the exact pass is skipped; the gap and move passes still pair what reads the same. */
const MAX_LCS_CELLS = 4_000_000;

/** Index pairs `[next, previous]` of the longest common subsequence of keys, after trimming the common head and tail. */
const commonSubsequence = (next: readonly Slot[], previous: readonly Slot[]): [number, number][] => {
	const pairs: [number, number][] = [];
	let head = 0;
	while (head < next.length && head < previous.length && next[head]?.key === previous[head]?.key) {
		pairs.push([head, head]);
		head += 1;
	}
	let tail = 0;
	while (
		tail < next.length - head &&
		tail < previous.length - head &&
		next[next.length - 1 - tail]?.key === previous[previous.length - 1 - tail]?.key
	) {
		tail += 1;
	}
	const n = next.length - head - tail;
	const m = previous.length - head - tail;
	if (n > 0 && m > 0 && n * m <= MAX_LCS_CELLS) {
		const width = m + 1;
		const lengths = new Uint32Array((n + 1) * width);
		for (let i = n - 1; i >= 0; i -= 1) {
			for (let j = m - 1; j >= 0; j -= 1) {
				lengths[i * width + j] =
					next[head + i]?.key === previous[head + j]?.key
						? (lengths[(i + 1) * width + j + 1] ?? 0) + 1
						: Math.max(lengths[(i + 1) * width + j] ?? 0, lengths[i * width + j + 1] ?? 0);
			}
		}
		let i = 0;
		let j = 0;
		while (i < n && j < m) {
			if (next[head + i]?.key === previous[head + j]?.key) {
				pairs.push([head + i, head + j]);
				i += 1;
				j += 1;
			} else if ((lengths[(i + 1) * width + j] ?? 0) >= (lengths[i * width + j + 1] ?? 0)) {
				i += 1;
			} else {
				j += 1;
			}
		}
	}
	for (let k = tail; k > 0; k -= 1) pairs.push([next.length - k, previous.length - k]);
	return pairs;
};

/**
 * Pairs each block of `next` with at most one block of `previous`:
 * 1. blocks that read the same, in order (longest common subsequence);
 * 2. between two such pairs, the remaining blocks of the same kind in the same place, in order (an edited paragraph keeps its id;
 *    when a paragraph is split, the first part keeps it);
 * 3. a remaining block that reads the same as a remaining previous block anywhere (a moved block keeps its id).
 */
const pairBlocks = (next: readonly Slot[], previous: readonly Slot[]): Map<CmsNode, CmsNode> => {
	const paired = new Map<CmsNode, CmsNode>();
	const usedPrevious = new Set<number>();
	const exact = commonSubsequence(next, previous);
	const pairedNext = new Set<number>();
	for (const [i, j] of exact) {
		paired.set(next[i]?.node as CmsNode, previous[j]?.node as CmsNode);
		pairedNext.add(i);
		usedPrevious.add(j);
	}

	const anchors: [number, number][] = [[-1, -1], ...exact, [next.length, previous.length]];
	for (let a = 0; a + 1 < anchors.length; a += 1) {
		const [fromNext, fromPrevious] = anchors[a] as [number, number];
		const [toNext, toPrevious] = anchors[a + 1] as [number, number];
		const waiting = new Map<string, number[]>();
		for (let j = fromPrevious + 1; j < toPrevious; j += 1) {
			if (usedPrevious.has(j)) continue;
			const place = previous[j]?.place as string;
			waiting.set(place, [...(waiting.get(place) ?? []), j]);
		}
		for (let i = fromNext + 1; i < toNext; i += 1) {
			if (pairedNext.has(i)) continue;
			const queue = waiting.get(next[i]?.place as string);
			const j = queue?.shift();
			if (j === undefined) continue;
			paired.set(next[i]?.node as CmsNode, previous[j]?.node as CmsNode);
			pairedNext.add(i);
			usedPrevious.add(j);
		}
	}

	const moved = new Map<string, number[]>();
	previous.forEach((slot, j) => {
		if (!usedPrevious.has(j)) moved.set(slot.key, [...(moved.get(slot.key) ?? []), j]);
	});
	next.forEach((slot, i) => {
		if (pairedNext.has(i)) return;
		const j = moved.get(slot.key)?.shift();
		if (j !== undefined) paired.set(slot.node, previous[j]?.node as CmsNode);
	});
	return paired;
};

/** What a block is given: its id and, when it has one, the source block it links to. */
interface Ids {
	readonly id: string;
	readonly sourceId?: string;
}

const copyWithIds = (nodes: readonly CmsNode[], idsOf: Map<CmsNode, Ids>): CmsNode[] =>
	nodes.map((node) => {
		const ids = idsOf.get(node);
		const content = node.content && !TEXTBLOCKS.has(node.type) ? copyWithIds(node.content, idsOf) : node.content;
		const { id: _id, sourceId: _sourceId, ...rest } = node;
		const out: CmsNode = { ...rest };
		if (content) out.content = content;
		if (ids) {
			out.id = ids.id;
			if (ids.sourceId !== undefined) out.sourceId = ids.sourceId;
		}
		return sortedNode(out);
	});

/** Node keys in the stored order (`attrs`, `content`, `id`, `marks`, `sourceId`, `text`, `type`). */
const sortedNode = (node: CmsNode): CmsNode => {
	const out = {} as CmsNode;
	for (const key of ["attrs", "content", "id", "marks", "sourceId", "text", "type"] as const) {
		if (node[key] !== undefined) (out as Record<string, unknown>)[key] = node[key];
	}
	return out;
};

const linkOf = (node: CmsNode | undefined): string | undefined =>
	isBlockId(node?.sourceId) ? node.sourceId : undefined;

/**
 * Gives every block of `nodes` an id, returning new nodes. A block keeps a valid id it already has, with its source link (the first block with a
 * given id keeps it, a later copy, such as a pasted block, gets a new one and no link). A block without one inherits the id and the source link of
 * its partner in the first of `sources` that pairs it (see `pairBlocks`), as long as no other block holds that id; otherwise it gets a new id.
 */
export const assignBlockIds = (
	nodes: readonly CmsNode[],
	sources: readonly (readonly CmsNode[] | null | undefined)[] = [],
): CmsNode[] => {
	const slots = slotsOf(nodes);
	const used = new Set<string>();
	const idsOf = new Map<CmsNode, Ids>();
	const give = (node: CmsNode, id: string, from: CmsNode) => {
		used.add(id);
		const sourceId = linkOf(node) ?? linkOf(from);
		idsOf.set(node, sourceId === undefined ? { id } : { id, sourceId });
	};
	for (const { node } of slots) {
		if (isBlockId(node.id) && !used.has(node.id)) give(node, node.id, node);
	}
	for (const source of sources) {
		if (!source || idsOf.size === slots.length) continue;
		const waiting = slots.filter(({ node }) => !idsOf.has(node));
		const paired = pairBlocks(waiting, slotsOf(source));
		for (const { node } of waiting) {
			const partner = paired.get(node);
			if (partner && isBlockId(partner.id) && !used.has(partner.id)) give(node, partner.id, partner);
		}
	}
	for (const { node } of slots) {
		if (idsOf.has(node)) continue;
		let id = newBlockId();
		while (used.has(id)) id = newBlockId();
		used.add(id);
		// A copy of a block that holds the id already is a new block: it does not link to the original's source.
		idsOf.set(node, isBlockId(node.id) ? { id } : { id, ...(linkOf(node) ? { sourceId: linkOf(node) } : {}) });
	}
	return copyWithIds(nodes, idsOf);
};

/**
 * The same nodes with every block given a new id. Ids are unique within one document, and the translation and diff views pair blocks by them, so a body copied
 * into another (a template applied to an entry) must not bring its ids along: the copies would read as the same blocks as the original's.
 */
export const regenerateBlockIds = (nodes: readonly CmsNode[]): CmsNode[] => assignBlockIds(withoutBlockIds(nodes));

/** Copies the block ids and source links of `from` onto `to`, which has the same tree (the same document read back). */
export const copyBlockIds = (to: readonly CmsNode[], from: readonly CmsNode[]): CmsNode[] => {
	const source = slotsOf(from);
	const idsOf = new Map<CmsNode, Ids>();
	slotsOf(to).forEach(({ node }, index) => {
		const partner = source[index]?.node;
		if (partner?.id)
			idsOf.set(node, partner.sourceId ? { id: partner.id, sourceId: partner.sourceId } : { id: partner.id });
	});
	return copyWithIds(to, idsOf);
};

const linkedNode = (node: CmsNode): CmsNode => {
	if (node.text !== undefined) return node;
	const { id, sourceId: _sourceId, content, ...rest } = node;
	const out: CmsNode = { ...rest };
	if (content) out.content = TEXTBLOCKS.has(node.type) ? content : content.map(linkedNode);
	if (isBlockId(id)) out.sourceId = id;
	return sortedNode(out);
};

/**
 * The blocks of a translation made from `nodes`, a source body: every block links to the source block it is a copy of (`sourceId` is that block's id)
 * and has no id of its own (the translation's blocks are its own; they get ids when it is stored).
 */
export const linkedToSource = (nodes: readonly CmsNode[]): CmsNode[] => nodes.map(linkedNode);
