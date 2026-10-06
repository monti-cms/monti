import { isDeepStrictEqual } from "node:util";
import { CmsError } from "../store/errors";
import type { EntryStatus } from "../store/types";
import type { Reference } from "../types";

/**
 * Publish rules: who may be published, which references a publish has to check, and when saving or publishing changes nothing.
 */

/** A stored body (working or published) as far as these rules look at it. */
export interface BodyState {
	readonly contentHash: string;
	readonly schemaVersion: number;
	readonly updatedAt: Date;
	readonly metadata: unknown;
	readonly translation: unknown;
}

/** What a save compares: the draft's body, its slug and its translation status. */
export interface WorkingBodyState {
	readonly contentHash: string;
	readonly schemaVersion: number;
	readonly slug: string | null;
	readonly metadata: unknown;
	readonly translation: unknown;
}

/** A trashed entry cannot be published, and an archived one must be unarchived first. */
export function assertPublishableStatus(status: EntryStatus): void {
	if (status === "trashed") throw new CmsError("A trashed entry cannot be published", "invalid_status");
	if (status === "archived") {
		throw new CmsError("An archived entry must be unarchived before publishing", "invalid_status");
	}
}

export function assertSameCollection(stored: string, given: string): void {
	if (stored !== given) throw new CmsError("Collection mismatch", "invalid_input");
}

export function assertExpectedVersion(stored: number, expected: number): void {
	if (stored !== expected) throw new CmsError("Conflict", "conflict", stored);
}

/** A trashed entry must be restored before it can be edited. */
export function assertEditableStatus(status: EntryStatus): void {
	if (status === "trashed") throw new CmsError("A trashed entry must be restored before editing", "invalid_status");
}

/**
 * The references a publish checks: the prepared snapshot's, plus the references the saved draft still has. Even stale leftovers are checked,
 * so a publish confirms the target still exists. A reference in both keeps the occurrences of both.
 */
export function mergePublishReferences(
	snapshot: readonly Reference[],
	previous: readonly Reference[],
): readonly Reference[] {
	const merged = new Map<string, Reference>(snapshot.map((ref) => [`${ref.kind}:${ref.targetId}`, ref]));
	for (const ref of previous) {
		const key = `${ref.kind}:${ref.targetId}`;
		const current = merged.get(key);
		if (!current) merged.set(key, ref);
		else {
			const occurrences = new Map(
				[...current.occurrences, ...ref.occurrences].map((occurrence) => [JSON.stringify(occurrence), occurrence]),
			);
			merged.set(key, { ...current, occurrences: [...occurrences.values()] });
		}
	}
	return [...merged.values()];
}

/**
 * Whether saving the draft changes nothing stored. The content hash decides whether the body changed, not the MDX string, which differs for a
 * syntax-only change. `translation` is the status the save would store.
 */
export function isSameWorkingBody(stored: WorkingBodyState | null, next: WorkingBodyState): boolean {
	return Boolean(
		stored &&
			stored.contentHash === next.contentHash &&
			stored.schemaVersion === next.schemaVersion &&
			stored.slug === next.slug &&
			isDeepStrictEqual(stored.metadata, next.metadata) &&
			isDeepStrictEqual(stored.translation ?? null, next.translation ?? null),
	);
}

/**
 * Whether publishing writes nothing new: the published body is already the draft (same hash, schema, modified date, metadata and translation status)
 * and the public slug is already the draft's.
 */
export function isRepublish(
	published: BodyState | null,
	working: BodyState,
	slugs: { readonly current: string | null; readonly target: string | null },
): boolean {
	return Boolean(
		published &&
			published.contentHash === working.contentHash &&
			published.schemaVersion === working.schemaVersion &&
			published.updatedAt.getTime() === working.updatedAt.getTime() &&
			slugs.current === slugs.target &&
			isDeepStrictEqual(published.metadata, working.metadata) &&
			isDeepStrictEqual(published.translation, working.translation),
	);
}
