import type { ColumnType, GeneratedAlways } from "kysely";
import type { EntryStatus } from "../../../core/store/types";

/**
 * The value types `database.ts` is built from. `database.ts` is generated (`pnpm gen:db-types`); this file is the hand-written part beside it: the
 * Kysely types of the columns the driver reads in its own way, and the shapes of the JSONB values that are not a type of the store.
 */

/** A `jsonb` column: read as `T` (the driver parses it), written as the JSON text (`JSON.stringify`, as every store write does). */
export type Jsonb<T> = ColumnType<T, string, string>;

/** A `bigint` column: the driver reads it as a string; either is accepted on write. */
export type Int8 = ColumnType<string, string | number | bigint, string | number | bigint>;

/** A `bigserial` column: a string when read, and never written. */
export type BigSerial = GeneratedAlways<string>;

/** What `cms_events.payload` holds (see `eventRowOf`). */
export interface EventPayload {
	translationGroupId: string;
	status: EntryStatus;
	publishedSlug: string | null;
	workingSlug: string | null;
	/** The entry's title when the change was made (a deleted entry has no row left to read it from). */
	title: string | null;
	/** Who made the change; absent on events recorded before the field existed. */
	actor?: string | null;
}
