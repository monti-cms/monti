import type { BacklinkField } from "@monti-cms/core";
import { isConflict } from "../../api/client";
import type { EntryEditorClient } from "../../api/entries";

// A backlink (a post's series) is stored on the other record, so picking one changes that record. The editor keeps the picks as unsaved changes and
// writes them with the post's save, like every other field.

/**
 * The picks in one backlink field that the server does not have yet: the records to put this entry into (with the title the input showed), and
 * the records to take it out of.
 *
 * @experimental
 */
export interface BacklinkChange {
	readonly add: readonly { readonly id: string; readonly title: string }[];
	readonly remove: readonly string[];
}

/** The records the field shows: the server's, with the unsaved picks laid over them. */
export function backlinkShown(
	server: readonly { id: string; title: string }[],
	change: BacklinkChange | undefined,
): { id: string; title: string }[] {
	if (!change) return [...server];
	const kept = server.filter((member) => !change.remove.includes(member.id));
	return [...kept, ...change.add.filter((added) => !kept.some((member) => member.id === added.id))];
}

/**
 * The change that turns the server's records into `next`. `null` when they are the same, so taking a pick back leaves nothing to save.
 * `titleOf` names a record the server does not list yet.
 */
export function backlinkChangeTo(
	server: readonly { id: string }[],
	next: readonly string[],
	titleOf: (id: string) => string,
): BacklinkChange | null {
	const add = next.filter((id) => !server.some((member) => member.id === id)).map((id) => ({ id, title: titleOf(id) }));
	const remove = server.filter((member) => !next.includes(member.id)).map((member) => member.id);
	return add.length === 0 && remove.length === 0 ? null : { add, remove };
}

type RecordMetadata = Record<string, unknown>;

/**
 * Puts `targetId` into the other record's relation list (`field.via`), or takes it out. A new entry goes to the end; taking it out removes every slot
 * that holds it. For a record collection, saving is publishing. If the versions diverge (changed elsewhere first), it reads the record again and tries once more.
 */
export async function writeBacklink(
	client: Pick<EntryEditorClient, "get" | "update">,
	field: BacklinkField,
	recordId: string,
	targetId: string,
	into: boolean,
): Promise<void> {
	for (let attempt = 0; attempt < 2; attempt++) {
		const record = await client.get(recordId);
		const metadata = (record.working.metadata ?? {}) as RecordMetadata;
		const current = metadata[field.via];
		const ids = Array.isArray(current) ? current.filter((id): id is string => typeof id === "string") : [];
		const next = into ? (ids.includes(targetId) ? ids : [...ids, targetId]) : ids.filter((id) => id !== targetId);
		try {
			await client.update(recordId, {
				expectedVersion: record.version,
				slug: record.workingSlug,
				metadata: { ...metadata, [field.via]: next },
			});
			return;
		} catch (saveError) {
			if (!isConflict(saveError) || attempt === 1) throw saveError;
		}
	}
}
