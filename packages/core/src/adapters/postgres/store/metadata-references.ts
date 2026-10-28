import { isDeepStrictEqual } from "node:util";
import { readReferenceOccurrences } from "../../../core/types";
import type { Db } from "../db/kysely";

/**
 * Replaces the metadata references of one stored body and leaves its body references as they are. A reference keeps its stale flag; it is dropped when no
 * occurrence is left. Occurrences are written metadata first and body after, the order a save writes them, so a later identical save sees nothing to change.
 */
export async function replaceMetadataReferences(
	db: Db,
	entryId: string,
	state: "working" | "published",
	metadataReferences: readonly {
		readonly kind: "entry" | "media";
		readonly targetId: string;
		readonly occurrences: readonly unknown[];
	}[],
): Promise<void> {
	const current = await db
		.selectFrom("entry_references")
		.select(["kind", "target_id", "is_stale", "occurrences"])
		.where("entry_id", "=", entryId)
		.where("state", "=", state)
		.execute();
	const key = (kind: string, targetId: string) => `${kind === "media" ? "media" : "entry"}:${targetId}`;

	const next = new Map<
		string,
		{ kind: "entry" | "media"; targetId: string; isStale: boolean; occurrences: unknown[] }
	>();
	for (const ref of metadataReferences) {
		next.set(key(ref.kind, ref.targetId), {
			kind: ref.kind,
			targetId: ref.targetId,
			isStale: false,
			occurrences: [...ref.occurrences],
		});
	}
	const before = new Map<string, { isStale: boolean; occurrences: unknown[] }>();
	for (const row of current) {
		const occurrences = readReferenceOccurrences(row.occurrences);
		const body = occurrences.filter((occurrence) => occurrence.type !== "metadata");
		const k = key(row.kind, row.target_id);
		before.set(k, { isStale: row.is_stale, occurrences });
		if (body.length === 0) continue;
		const entry = next.get(k) ?? {
			kind: row.kind === "media" ? ("media" as const) : ("entry" as const),
			targetId: row.target_id,
			isStale: false,
			occurrences: [],
		};
		entry.occurrences.push(...body);
		next.set(k, entry);
	}
	for (const [k, entry] of next) {
		const stored = before.get(k);
		if (stored && !entry.isStale) entry.isStale = stored.isStale;
	}

	const same =
		next.size === before.size &&
		[...next].every(([k, entry]) => {
			const stored = before.get(k);
			return stored && stored.isStale === entry.isStale && isDeepStrictEqual(stored.occurrences, entry.occurrences);
		});
	if (same) return;

	await db.deleteFrom("entry_references").where("entry_id", "=", entryId).where("state", "=", state).execute();
	for (const entry of next.values()) {
		const isMedia = entry.kind === "media";
		await db
			.insertInto("entry_references")
			.values({
				entry_id: entryId,
				state,
				kind: entry.kind,
				target_id: entry.targetId,
				target_entry_id: isMedia ? null : entry.targetId,
				target_media_id: isMedia ? entry.targetId : null,
				is_stale: entry.isStale,
				occurrences: JSON.stringify(entry.occurrences),
			})
			.execute();
	}
}
