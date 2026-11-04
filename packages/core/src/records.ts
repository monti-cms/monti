import type { Kysely, Transaction } from "kysely";
import type { Database } from "./db/schema";

type Db = Kysely<Database> | Transaction<Database>;

/** A record as the engine sees it: its version, and its whole state as JSON for an undo snapshot. */
export type RecordState = { id: string; version: number; data: unknown };

/**
 * A kind of record the engine can version and undo (an entry, a folder, a media file). Operations name records by kind and id; the kind knows how to
 * read their state and put an old state back.
 */
export type RecordKind = {
	kind: string;
	/** The current state of the records that exist; missing ids are left out. */
	load(db: Db, ids: string[]): Promise<RecordState[]>;
	/**
	 * Puts a snapshot back: `data` as `load` returned it, or `null` to remove a record the write created. It raises the version, so a screen that read
	 * the record before the undo sees a conflict instead of overwriting it.
	 */
	restore(db: Db, id: string, data: unknown | null): Promise<void>;
};

export function defineRecordKind(kind: RecordKind): RecordKind {
	return kind;
}
