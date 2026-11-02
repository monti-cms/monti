import { z } from "zod";
import { ERROR_STATUS, type ErrorCode } from "../../core/error-codes";
import type { Entry } from "../../core/store";
import { CmsError } from "../../core/store/errors";
import { defineOperation, type OperationContext, type WritePlan } from "../define";
import { spotBase } from "./base";

const entryId = z.string().min(1).describe("The id of an entry");

/** The entry as a write plans against it: it must exist and be out of the trash. */
async function liveEntry(context: OperationContext, id: string): Promise<Entry> {
	const entry = await context.cms.store().getEntry(id);
	if (entry.deletedAt) throw new CmsError(`Entry ${id} is in the trash`, "invalid_status");
	return entry;
}

/** What an entry is called in a proposal: its title, its draft address and its collection. */
const subjectOf = (context: OperationContext, entry: Entry): WritePlan["subject"] => ({
	title:
		(context.cms.site.isCollection(entry.collection)
			? context.cms.site.titleOfValues(entry.collection as never, entry.working.metadata as never)
			: null) ?? "",
	...(entry.workingSlug ? { path: `/${entry.workingSlug}` } : {}),
	collection: entry.collection,
});

/** The name of a folder of a collection for a proposal, or `null` for none (or a folder that is gone). */
async function folderName(context: OperationContext, collection: string, id: string | null): Promise<string | null> {
	if (!id) return null;
	const folders = await context.cms
		.store()
		.listFolders({ collection })
		.catch(() => []);
	return folders.find((folder) => folder.id === id)?.name ?? null;
}

/** Saves the draft of `entry` with one field set to `value`, keeping the rest of the draft as it is. Returns the entry after the save. */
async function saveField(context: OperationContext, entry: Entry, field: string, value: unknown): Promise<Entry> {
	const metadata = { ...(entry.working.metadata as Record<string, unknown>) };
	if (value === null || value === undefined) delete metadata[field];
	else metadata[field] = value;
	const { entry: saved } = await context.cms.contentService().saveDraft(entry.id, {
		collection: entry.collection,
		slug: entry.workingSlug,
		metadata,
		doc: entry.working.doc,
		expectedVersion: entry.version,
	} as never);
	return saved;
}

const fieldValue = (entry: Entry, field: string): unknown =>
	(entry.working.metadata as Record<string, unknown>)[field] ?? null;

/**
 * Sets fields of an entry's draft: a summary, tags (the ids of the items), a category, any field of the collection's schema. One change per field, so each can
 * be reviewed, applied and undone on its own; a field someone changed in the meantime is left alone.
 */
export const updateEntryFields = defineOperation({
	name: "entries.updateFields",
	kind: "write",
	describe:
		"Propose new values for fields of one entry's draft (summary, tags as item ids, category, any schema field). Nothing changes until the admin applies it. " +
		"Give only the fields to change; read the entry first for the current values. Relation fields take the full new list of ids.",
	input: () =>
		z.object({
			id: entryId,
			fields: z.record(z.string(), z.unknown()).describe("Field name → new value"),
		}),
	plan: async ({ id, fields }, context) => {
		const entry = await liveEntry(context, id);
		const { site } = context.cms;
		const plans: WritePlan[] = [];
		for (const [field, after] of Object.entries(fields)) {
			if (!site.storedField(entry.collection as never, field)) {
				throw new CmsError(`The collection "${entry.collection}" has no field "${field}"`, "invalid_input");
			}
			const before = fieldValue(entry, field);
			if (JSON.stringify(before) === JSON.stringify(after ?? null)) continue;
			plans.push({
				target: { kind: "entry", id, spot: field },
				preview: { before, after: after ?? null },
				base: spotBase(before),
				change: { field, value: after ?? null },
				subject: subjectOf(context, entry),
			});
		}
		return plans;
	},
	apply: async (plan, context) => {
		const { field, value } = plan.change as { field: string; value: unknown };
		const entry = await liveEntry(context, plan.target.id);
		if (spotBase(fieldValue(entry, field)) !== plan.base) throw new CmsError("The field changed since", "conflict");
		const before = fieldValue(entry, field);
		const saved = await saveField(context, entry, field, value);
		return { base: spotBase(fieldValue(saved, field)), undo: { value: before } };
	},
	revert: async (plan, undo, context) => {
		const { field } = plan.change as { field: string };
		const entry = await liveEntry(context, plan.target.id);
		await saveField(context, entry, field, (undo as { value: unknown }).value);
	},
	baseOf: async (target, context) => {
		const entry = await context.cms
			.store()
			.getEntry(target.id)
			.catch(() => null);
		if (!entry || entry.deletedAt || !target.spot) return null;
		return spotBase(fieldValue(entry, target.spot));
	},
});

/** Runs one bulk op on one entry at its current version; a refusal is the error the bulk service gave. */
async function bulkOne(context: OperationContext, entry: Entry, request: Record<string, unknown>): Promise<void> {
	const { results } = await context.cms
		.bulkService()
		.run({ ...request, items: [{ id: entry.id, expectedVersion: entry.version }] } as never);
	const [result] = results;
	if (result?.ok) return;
	// The bulk service names why an item failed; a reason the error codes do not know is reported as an internal error.
	const code = result && result.error in ERROR_STATUS ? (result.error as ErrorCode) : "internal_error";
	throw new CmsError(`Could not change entry ${entry.id}`, code);
}

/** Moves entries to a folder (or out of any folder with `null`). One change per entry. */
export const moveEntriesToFolder = defineOperation({
	name: "entries.moveToFolder",
	kind: "write",
	describe:
		"Propose moving entries to a folder of their collection (folderId null moves them out of any folder). Nothing changes until the admin applies it. " +
		"Find the folder id with folders.list.",
	input: () =>
		z.object({
			ids: z.array(entryId).min(1).max(100),
			folderId: z.string().nullable().describe("The id of the folder, or null for none"),
		}),
	plan: async ({ ids, folderId }, context) => {
		const plans: WritePlan[] = [];
		for (const id of ids) {
			const entry = await liveEntry(context, id);
			if (entry.folderId === folderId) continue;
			plans.push({
				target: { kind: "entry", id, spot: "folder" },
				preview: { before: entry.folderId, after: folderId },
				base: spotBase(entry.folderId),
				change: { folderId },
				subject: subjectOf(context, entry),
				shown: {
					before: await folderName(context, entry.collection, entry.folderId),
					after: await folderName(context, entry.collection, folderId),
				},
			});
		}
		return plans;
	},
	apply: async (plan, context) => {
		const { folderId } = plan.change as { folderId: string | null };
		const entry = await liveEntry(context, plan.target.id);
		if (spotBase(entry.folderId) !== plan.base) throw new CmsError("The entry moved since", "conflict");
		await bulkOne(context, entry, { op: "folder.move", folderId });
		return { base: spotBase(folderId), undo: { folderId: entry.folderId } };
	},
	revert: async (plan, undo, context) => {
		const entry = await liveEntry(context, plan.target.id);
		await bulkOne(context, entry, { op: "folder.move", folderId: (undo as { folderId: string | null }).folderId });
	},
	baseOf: async (target, context) => {
		const entry = await context.cms
			.store()
			.getEntry(target.id)
			.catch(() => null);
		return entry && !entry.deletedAt ? spotBase(entry.folderId) : null;
	},
});

const TRASH_BASE = { live: spotBase("live"), trashed: spotBase("trashed") };

/** Moves entries to the trash. Undoing restores them (as drafts, like a restore from the trash screen). Deleting for good is never the agent's. */
export const trashEntries = defineOperation({
	name: "entries.trash",
	kind: "write",
	describe:
		"Propose moving entries to the trash, only when the admin asked for it. Nothing changes until the admin applies it, and it can be undone. " +
		"Never propose this on your own; deleting for good is not possible.",
	input: () => z.object({ ids: z.array(entryId).min(1).max(100) }),
	plan: async ({ ids }, context) => {
		const plans: WritePlan[] = [];
		for (const id of ids) {
			const entry = await liveEntry(context, id);
			plans.push({
				target: { kind: "entry", id, spot: "trash" },
				preview: { before: "live", after: "trash" },
				base: TRASH_BASE.live,
				change: {},
				subject: subjectOf(context, entry),
			});
		}
		return plans;
	},
	apply: async (plan, context) => {
		const entry = await liveEntry(context, plan.target.id).catch(() => {
			throw new CmsError("The entry is gone or already in the trash", "conflict");
		});
		await bulkOne(context, entry, { op: "trash" });
		return { base: TRASH_BASE.trashed, undo: {} };
	},
	revert: async (plan, _undo, context) => {
		const [result] = await context.cms.trashService().restore([{ type: "entry", id: plan.target.id }]);
		if (!result?.ok) throw new CmsError(`Could not restore entry ${plan.target.id}`, "conflict");
	},
	baseOf: async (target, context) => {
		const entry = await context.cms
			.store()
			.getEntry(target.id)
			.catch(() => null);
		if (!entry) return null;
		return entry.deletedAt ? TRASH_BASE.trashed : TRASH_BASE.live;
	},
});
