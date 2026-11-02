import { z } from "zod";
import { formatNameSchema } from "../../core/api";
import type { Entry } from "../../core/store";
import { CmsError } from "../../core/store/errors";
import type { StoredDocument } from "../../doc/stored-document";
import type { CmsNode } from "../../doc/types";
import { importText } from "../../format/convert";
import { createBodyExporter } from "../../services/body-export";
import { defineOperation, type OperationContext, type WritePlan } from "../define";
import { spotBase } from "./base";
import { liveEntry, subjectOf } from "./entry-common";

/** The spot of a body change: the id of the top-level block it replaces. */
const bodySpot = (blockId: string) => `body:${blockId}`;
const blockIdOf = (spot: string | undefined): string | null => (spot?.startsWith("body:") ? spot.slice(5) : null);

/** What applying one body change does: the block `blockId` is replaced by `nodes` (none removes it). */
interface BodyChange {
	readonly blockId: string;
	readonly nodes: readonly CmsNode[];
}

const docOf = (entry: Entry, content: readonly CmsNode[]): StoredDocument => ({ ...entry.working.doc, content });
const blockOf = (entry: Entry, blockId: string): CmsNode | null =>
	entry.working.doc.content.find((block) => block.id === blockId) ?? null;

/** Saves the draft of `entry` with its body set to `content`, keeping the rest of the draft as it is. */
async function saveBody(context: OperationContext, entry: Entry, content: readonly CmsNode[]): Promise<Entry> {
	const { entry: saved } = await context.cms.contentService().saveDraft(entry.id, {
		collection: entry.collection,
		slug: entry.workingSlug,
		metadata: entry.working.metadata,
		doc: docOf(entry, content),
		expectedVersion: entry.version,
	} as never);
	return saved;
}

/** The base of a body change: the block with the change's id as stored (`null` once it is gone). */
const blockBase = (block: CmsNode | null) => spotBase(block ?? null);

/**
 * Edits the body of an entry's draft by finding text and replacing it, the way an editor's find-and-replace does. Each edit lands in the one top-level block
 * (paragraph, heading, list, quote) that holds its text; edits in the same block become one change, so each block can be reviewed, accepted and undone on
 * its own. A replacement may hold blank lines (it becomes several blocks) or be empty (the block goes).
 */
export const updateEntryBody = defineOperation({
	name: "entries.updateBody",
	kind: "write",
	describe:
		"Propose edits to the body of one entry's draft. Nothing changes until the admin accepts it. Read the entry with the same `format` first, then give " +
		"each edit as `find` (text copied exactly from one block of that body, long enough to occur once) and `replace` (its new text in the same format). " +
		"Replacing a whole paragraph with an empty string removes it; blank lines in `replace` make new paragraphs. Keep edits small: change only what was asked.",
	input: () =>
		z.object({
			id: z.string().min(1).describe("The id of an entry"),
			format: formatNameSchema.describe("The body format the edits are written in (`site.describe` lists them)"),
			edits: z
				.array(z.object({ find: z.string().min(1), replace: z.string() }))
				.min(1)
				.max(50),
		}),
	plan: async ({ id, format, edits }, context) => {
		const entry = await liveEntry(context, id);
		const exporter = await createBodyExporter(context.cms, { format });
		const blocks = entry.working.doc.content;
		const texts = await Promise.all(blocks.map((block) => exporter.text(docOf(entry, [block]), entry.locale)));
		const edited = new Map<number, string>();
		for (const { find, replace } of edits) {
			const holders = texts.flatMap((_, index) => {
				const text = edited.get(index) ?? texts[index] ?? "";
				return text.includes(find) ? [index] : [];
			});
			const [index] = holders;
			if (holders.length !== 1 || index === undefined) {
				throw new CmsError(
					holders.length === 0
						? `No block of the body holds the text: ${find.slice(0, 80)}`
						: `The text occurs in ${holders.length} blocks; quote more of it: ${find.slice(0, 80)}`,
					"invalid_input",
				);
			}
			const text = edited.get(index) ?? texts[index] ?? "";
			if (text.indexOf(find) !== text.lastIndexOf(find)) {
				throw new CmsError(
					`The text occurs twice in one block; quote more of it: ${find.slice(0, 80)}`,
					"invalid_input",
				);
			}
			edited.set(
				index,
				text.replace(find, () => replace),
			);
		}
		const registry = await context.cms.formats();
		const plans: WritePlan[] = [];
		for (const [index, after] of [...edited].sort(([a], [b]) => a - b)) {
			const block = blocks[index];
			const before = texts[index] ?? "";
			if (!block?.id || after === before) continue;
			const nodes = after.trim()
				? (
						await importText(context.cms.site, registry, format, after, {
							locale: entry.locale,
							entryId: entry.id,
							previous: docOf(entry, [block]),
							strict: true,
						})
					).doc.content
				: [];
			const change: BodyChange = { blockId: block.id, nodes };
			plans.push({
				target: { kind: "entry", id, spot: bodySpot(block.id) },
				preview: { before, after: after.trim() ? after : null },
				base: blockBase(block),
				change,
				subject: subjectOf(context, entry),
			});
		}
		return plans;
	},
	apply: async (plan, context) => {
		const { blockId, nodes } = plan.change as BodyChange;
		const entry = await liveEntry(context, plan.target.id);
		const content = entry.working.doc.content;
		const index = content.findIndex((block) => block.id === blockId);
		if (index < 0 || blockBase(content[index] ?? null) !== plan.base) {
			throw new CmsError("The block changed since", "conflict");
		}
		const saved = await saveBody(context, entry, [...content.slice(0, index), ...nodes, ...content.slice(index + 1)]);
		// The blocks that took the block's place, by the ids the save gave them: what reverting takes out again.
		const placed = saved.working.doc.content.slice(index, index + nodes.length).map((block) => block.id ?? "");
		return {
			base: blockBase(blockOf(saved, blockId)),
			undo: { block: content[index], placed, next: content[index + 1]?.id ?? null },
		};
	},
	revert: async (plan, undo, context) => {
		const { block, placed, next } = undo as { block: CmsNode; placed: string[]; next: string | null };
		const entry = await liveEntry(context, plan.target.id);
		const current = entry.working.doc.content;
		// The block goes back where the blocks that took its place begin, or before the block that followed it when it was removed.
		const anchor = placed.length > 0 ? placed[0] : next;
		const found = anchor ? current.findIndex((node) => node.id === anchor) : -1;
		const kept = current.filter((node) => !placed.includes(node.id ?? ""));
		const at = found < 0 ? kept.length : found;
		await saveBody(context, entry, [...kept.slice(0, at), block, ...kept.slice(at)]);
	},
	baseOf: async (target, context) => {
		const blockId = blockIdOf(target.spot);
		const entry = await context.cms
			.store()
			.getEntry(target.id)
			.catch(() => null);
		if (!entry || entry.deletedAt || !blockId) return null;
		return blockBase(blockOf(entry, blockId));
	},
});
