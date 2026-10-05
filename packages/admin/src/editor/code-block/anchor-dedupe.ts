import { ANCHOR, type CodeLineEffect } from "@monti-cms/core/code-block";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import { Mapping, type StepMap } from "@tiptap/pm/transform";
import { CODE_ANCHOR_REF } from "../added-marks";
import { BLOCK_ID_ATTRIBUTE } from "../block-ids";
import { lineEffectsOf } from "./effects-plugin";
import { nextAnchorId } from "./link-commands";

const anchorDedupeKey = new PluginKey("cmsCodeAnchorDedupe");

interface Holder {
	pos: number;
	node: PmNode;
	/** Whether the block came in with this change (pasted, duplicated, dropped). */
	inserted: boolean;
}

/** Ranges of the new document that the transactions inserted. */
function insertedRanges(transactions: readonly Transaction[]): [number, number][] {
	const maps: StepMap[] = transactions.flatMap((transaction) => transaction.mapping.maps as StepMap[]);
	const ranges: [number, number][] = [];
	maps.forEach((map, index) => {
		const later = new Mapping(maps.slice(index + 1));
		map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
			if (newEnd > newStart) ranges.push([later.map(newStart, -1), later.map(newEnd, 1)]);
		});
	});
	return ranges;
}

const anchorIdsOf = (node: PmNode): Set<string> =>
	new Set(
		lineEffectsOf(node).flatMap((effect) =>
			effect.name === ANCHOR && typeof effect.attrs.id === "string" ? [effect.attrs.id] : [],
		),
	);

/** The block that held each label before the change, by block id. */
function ownersBefore(doc: PmNode): Map<string, unknown> {
	const owners = new Map<string, unknown>();
	doc.descendants((node) => {
		if (node.type.name !== "codeBlock") return true;
		for (const id of anchorIdsOf(node)) if (!owners.has(id)) owners.set(id, node.attrs[BLOCK_ID_ATTRIBUTE]);
		return false;
	});
	return owners;
}

/**
 * Keeps line labels unique in the document, so a body link points to lines of exactly one code block (the public page and the publish
 * check resolve a label to the first block that has it).
 *
 * When a change leaves a label in a second code block (a duplicated, pasted or dropped copy), the block that held it before keeps it.
 * The copy's label is renamed together with the body links that came in with the same change (a pasted section of text and code stays
 * linked to its own code), or removed when none did: the existing links keep pointing to the original lines.
 */
export function createAnchorDedupePlugin(): Plugin {
	return new Plugin({
		key: anchorDedupeKey,
		appendTransaction(transactions, oldState, state) {
			if (!transactions.some((transaction) => transaction.docChanged)) return null;
			const ranges = insertedRanges(transactions);
			const isInserted = (from: number, to: number) => ranges.some(([start, end]) => start <= from && to <= end);

			const holders = new Map<string, Holder[]>();
			state.doc.descendants((node, pos) => {
				if (node.type.name !== "codeBlock") return true;
				if (node.attrs.rawMode) return false;
				for (const id of anchorIdsOf(node)) {
					const holder = { pos, node, inserted: isInserted(pos, pos + node.nodeSize) };
					holders.set(id, [...(holders.get(id) ?? []), holder]);
				}
				return false;
			});
			const duplicated = [...holders].filter(([, list]) => list.length > 1);
			if (duplicated.length === 0) return null;

			const owners = ownersBefore(oldState.doc);
			const markType = CODE_ANCHOR_REF ? state.schema.marks[CODE_ANCHOR_REF.mark] : undefined;
			const tr = state.tr;
			/** Effects per block position, as changed so far (a block can hold several duplicated labels). */
			const effectsAt = new Map<number, CodeLineEffect[]>();
			const effectsOf = (holder: Holder) => effectsAt.get(holder.pos) ?? lineEffectsOf(holder.node);

			for (const [id, list] of duplicated) {
				const owner = owners.get(id);
				const ownerIndex = Math.max(
					0,
					[
						list.findIndex(
							(holder) => !holder.inserted && owner != null && holder.node.attrs[BLOCK_ID_ATTRIBUTE] === owner,
						),
						list.findIndex((holder) => owner != null && holder.node.attrs[BLOCK_ID_ATTRIBUTE] === owner),
						list.findIndex((holder) => !holder.inserted),
					].find((index) => index >= 0) ?? 0,
				);
				let pastedLinks = markType && CODE_ANCHOR_REF ? insertedLinks(tr.doc, id, isInserted) : [];
				list.forEach((holder, index) => {
					if (index === ownerIndex) return;
					const effects = effectsOf(holder);
					if (holder.inserted && pastedLinks.length > 0 && markType && CODE_ANCHOR_REF) {
						const renamed = nextAnchorId(tr.doc);
						effectsAt.set(
							holder.pos,
							effects.map((effect) =>
								effect.name === ANCHOR && effect.attrs.id === id
									? { ...effect, attrs: { ...effect.attrs, id: renamed } }
									: effect,
							),
						);
						tr.setNodeMarkup(holder.pos, undefined, { ...holder.node.attrs, lineEffects: effectsAt.get(holder.pos) });
						for (const link of pastedLinks) {
							tr.addMark(link.from, link.to, markType.create({ ...link.attrs, [CODE_ANCHOR_REF.attribute]: renamed }));
						}
						// The links that came in are now this copy's; another copy has none left.
						pastedLinks = [];
						return;
					}
					effectsAt.set(
						holder.pos,
						effects.filter((effect) => effect.name !== ANCHOR || effect.attrs.id !== id),
					);
					tr.setNodeMarkup(holder.pos, undefined, { ...holder.node.attrs, lineEffects: effectsAt.get(holder.pos) });
				});
			}
			// Not an edit of its own: it joins the change that made the copy.
			return tr.setMeta("addToHistory", false);
		},
	});
}

/** Body links to `id` inside the ranges the change inserted. */
function insertedLinks(
	doc: PmNode,
	id: string,
	isInserted: (from: number, to: number) => boolean,
): { from: number; to: number; attrs: Record<string, unknown> }[] {
	const links: { from: number; to: number; attrs: Record<string, unknown> }[] = [];
	if (!CODE_ANCHOR_REF) return links;
	const { mark: markName, attribute } = CODE_ANCHOR_REF;
	doc.descendants((node, pos) => {
		if (!node.isText) return true;
		const mark = node.marks.find((item) => item.type.name === markName && item.attrs[attribute] === id);
		if (mark && isInserted(pos, pos + node.nodeSize))
			links.push({ from: pos, to: pos + node.nodeSize, attrs: mark.attrs });
		return false;
	});
	return links;
}
