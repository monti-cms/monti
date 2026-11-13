import { type Kysely, sql, type Transaction } from "kysely";
import type { Database } from "./db/schema";
import { type RecordLabel, type RecordRef, recordKey } from "./operation";
import type { Site } from "./site";

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
	 * the record before the undo sees a conflict instead of overwriting it. A kind without it is versioned only (the schema: a structure change is
	 * reversed by a new change, doc 00): its records are never in what an undo puts back.
	 */
	restore?(db: Db, id: string, data: unknown | null): Promise<void>;
	/** Whether a record in this state (`data` as `load` returned it) is in the trash. A kind that never goes there leaves it out. */
	inTrash?(data: unknown): boolean;
	/** What the activity log calls a record in this state (`data` as `load` returned it): its title, and for an entry where it is on this site. */
	label?(data: unknown, site: Site): RecordLabel;
};

export function defineRecordKind(kind: RecordKind): RecordKind {
	return kind;
}

/** Whether a lock's key is a file's: those are taken last (`lockRecords`). */
const ofFile = (key: string) => key.startsWith("media:");

/**
 * Serializes writes that touch the same records until their transaction ends. One order keeps multi-record writes from stopping each other:
 * every record that is no file by its key, then the files by theirs. The files come last because a write comes for the files its records
 * name only once it has run (`rewriteUses`), holding those records: a write that held a file and then asked for a template would wait on a
 * template's save that holds the template and asks for the file.
 */
export async function lockRecords(trx: Db, refs: RecordRef[]): Promise<void> {
	const keys = refs.map(recordKey).sort();
	for (const key of [...keys.filter((each) => !ofFile(each)), ...keys.filter(ofFile)])
		await sql`select pg_advisory_xact_lock(hashtext(${`monti:record:${key}`}))`.execute(trx);
}
