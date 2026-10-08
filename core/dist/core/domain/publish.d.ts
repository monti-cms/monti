import type { EntryStatus } from "../store/types.js";
import type { Reference } from "../types.js";
/**
 * Publish rules: who may be published, which references a publish has to check, and when saving or publishing changes nothing.
 */
/**
 * A stored body (working or published) as far as these rules look at it. The schema version a body is stored under is not compared here: it says which schema
 * the body was written under, not what it says, so a body saved again under a newer schema version is the same body.
 */
export interface BodyState {
    readonly contentHash: string;
    readonly updatedAt: Date;
    readonly metadata: unknown;
    readonly translation: unknown;
}
/** What a save compares: the draft's body, its slug and its translation status. */
export interface WorkingBodyState {
    readonly contentHash: string;
    readonly slug: string | null;
    readonly metadata: unknown;
    readonly translation: unknown;
}
/** A trashed entry cannot be published, and an archived one must be unarchived first. */
export declare function assertPublishableStatus(status: EntryStatus): void;
export declare function assertSameCollection(stored: string, given: string): void;
export declare function assertExpectedVersion(stored: number, expected: number): void;
/** A trashed entry must be restored before it can be edited. */
export declare function assertEditableStatus(status: EntryStatus): void;
/**
 * The references a publish checks: the prepared snapshot's, plus the references the saved draft still has. Even stale leftovers are checked,
 * so a publish confirms the target still exists. A reference in both keeps the occurrences of both.
 */
export declare function mergePublishReferences(snapshot: readonly Reference[], previous: readonly Reference[]): readonly Reference[];
/**
 * Whether saving the draft changes nothing stored. The content hash decides whether the body changed, not the MDX string, which differs for a
 * syntax-only change. `translation` is the status the save would store.
 */
export declare function isSameWorkingBody(stored: WorkingBodyState | null, next: WorkingBodyState): boolean;
/**
 * Whether publishing writes nothing new: the published body is already the draft (same hash, modified date, metadata and translation status)
 * and the public slug is already the draft's.
 */
export declare function isRepublish(published: BodyState | null, working: BodyState, slugs: {
    readonly current: string | null;
    readonly target: string | null;
}): boolean;
