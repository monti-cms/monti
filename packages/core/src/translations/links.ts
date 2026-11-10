import type { BlockKit } from "../body/blocks";
import { type Block, type Doc, plainText, type TranslationLink } from "../body/doc";
import { fingerprint } from "../bytes";
import { canonical, sameJson } from "../json";

/** A block without its ids and its link: what a translation compares, so moving or pairing a block is not a change. */
const bare = ({ id: _id, link: _link, children, ...block }: Block): unknown => ({
	...block,
	...(children ? { children: children.map(bare) } : {}),
});

/** A value without its empty parts (`attrs: {}`, `marks: []`): the editor drops them on its way through, and they say nothing. */
const trimmed = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(trimmed);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.entries(value).flatMap(([key, each]) => {
			const kept = trimmed(each);
			const empty =
				kept === undefined ||
				(Array.isArray(kept) && kept.length === 0) ||
				(kept !== null && typeof kept === "object" && !Array.isArray(kept) && Object.keys(kept).length === 0);
			return empty ? [] : [[key, kept]];
		}),
	);
};

/** Whether two blocks hold the same words and attrs, whatever their ids, links and empty parts. */
export const sameBlock = (a: Block, b: Block) => sameJson(trimmed(bare(a)), trimmed(bare(b)));

/**
 * A source block's hash: a translation keeps it in `link.seen` and compares it with the block the source publishes later. Measured without the
 * empty parts, as {@link sameBlock} compares, so a block the editor saves again unchanged is not a change (T120).
 */
export const blockHash = (block: Block) => fingerprint(JSON.stringify(canonical(trimmed(bare(block)))));

/** Each top-level block's hash by id. */
export const blockHashes = (doc: Doc | null): Record<string, string> =>
	Object.fromEntries((doc?.blocks ?? []).map((block) => [block.id, blockHash(block)]));

const hasText = (value: unknown): boolean =>
	typeof value === "string" ? value.trim() !== "" : Array.isArray(value) ? value.some(hasText) : false;

/** Whether a block has words a translation rewrites (doc 03's `translate`); one without them follows the source (`followSource`). */
export function hasWords(block: Block, kit: BlockKit): boolean {
	const definition = kit.blocks.get(block.type);
	if (!definition) return false;
	if (definition.holds === "text" && definition.translate?.text !== false && plainText(block.content).trim() !== "")
		return true;
	if ((definition.translate?.attrs ?? []).some((attr) => hasText(block.attrs?.[attr]))) return true;
	return (block.children ?? []).some((child) => hasWords(child, kit));
}

/** A source block copied into a translation: a new id, paired with the source block, still in the source's words. */
export const pairedCopy = (block: Block, id: string, kit: BlockKit): Block => ({
	...block,
	id,
	link: { from: block.id, seen: blockHash(block), state: hasWords(block, kit) ? "pending" : "followSource" },
});

/** A mark on a translation (doc 04). The marks are never stored: they are counted from the source's published blocks and the links. */
export type TranslationMark =
	| { kind: "changed"; block: string; from: string; seen: string }
	| { kind: "removed"; block: string; from: string; seen: string }
	| { kind: "added"; from: string; after: string | null };

/**
 * A translation's marks against its source's published body (`null`: the source is not on the site, so nothing is marked). A changed block of
 * `followSource` is no mark: it shows the source block as it is.
 */
export function marksOf(translation: Doc, skips: readonly string[], source: Doc | null): TranslationMark[] {
	if (!source) return [];
	const hashes = blockHashes(source);
	const marks: TranslationMark[] = [];
	const pairedTo = new Map<string, string>();
	for (const block of translation.blocks) {
		const link = block.link;
		if (!link) continue;
		if (!pairedTo.has(link.from)) pairedTo.set(link.from, block.id);
		if (!(link.from in hashes)) marks.push({ kind: "removed", block: block.id, from: link.from, seen: link.seen });
		else if (link.state !== "followSource" && hashes[link.from] !== link.seen)
			marks.push({ kind: "changed", block: block.id, from: link.from, seen: link.seen });
	}
	let after: string | null = null;
	for (const block of source.blocks) {
		const paired = pairedTo.get(block.id);
		if (paired) after = paired;
		else if (!skips.includes(block.id)) marks.push({ kind: "added", from: block.id, after });
	}
	return marks;
}

/**
 * A translation's body after a save, with its links kept by the core (doc 04): a block keeps the link it had, whatever the save sent, and a new block
 * gets none. A pending or followSource block whose words changed is now translated; the blocks in `retranslated` (an assistant's edit) are translated
 * against the source block as it is now. Paired blocks the save removed come back as `skipped`: their source blocks are not offered again.
 */
export function keepLinks(
	previous: Doc | null,
	next: Doc,
	hashes: Record<string, string>,
	retranslated: ReadonlySet<string> = new Set(),
	added: ReadonlyMap<string, Block> = new Map(),
): { doc: Doc; skipped: string[] } {
	const before = new Map((previous?.blocks ?? []).map((block) => [block.id, block]));
	const used = new Set<string>();
	const blocks = next.blocks.map(({ link: sent, ...block }): Block => {
		const old = before.get(block.id);
		const link = old?.link;
		// A new block the editor sent paired with a source block added since (doc 04, `added`, the undecided block it showed for it): it pairs with
		// that block, seen as the source has it now, translated unless it is still the source's words. Any other link a save sends is dropped.
		if (!old && sent && added.has(sent.from) && !used.has(sent.from)) {
			used.add(sent.from);
			const source = added.get(sent.from) as Block;
			return {
				...block,
				link: { from: sent.from, seen: blockHash(source), state: sameBlock(source, block) ? "pending" : "translated" },
			};
		}
		if (!link || used.has(link.from)) return block;
		used.add(link.from);
		// A block whose source block is gone (a "removed" mark), its words rewritten: it stays, on its own, as leaving it as it is does.
		if (Object.keys(hashes).length > 0 && !(link.from in hashes) && !sameBlock(old, block)) return block;
		let kept: TranslationLink = link;
		// A block whose words change is translated against the source block as it is now: what changed there is taken in, and its mark goes
		// (2026-11-10, owner). Kept as it was, a block keeps what it saw until someone says to leave it.
		if (retranslated.has(block.id) || (link.from in hashes && !sameBlock(old, block)))
			kept = { ...link, state: "translated", seen: hashes[link.from] ?? link.seen };
		else if ((link.state === "pending" || link.state === "followSource") && !sameBlock(old, block))
			kept = { ...link, state: "translated" };
		return { ...block, link: kept };
	});
	const skipped = (previous?.blocks ?? []).flatMap((block) =>
		block.link && !used.has(block.link.from) ? [block.link.from] : [],
	);
	return { doc: { ...next, blocks }, skipped };
}
