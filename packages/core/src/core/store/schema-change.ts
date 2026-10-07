import type { StoredDocument } from "../../doc/stored-document";
import type { ReferenceKind, ReferenceOccurrence } from "../types";
import type { EntryMetadata, EntryStatus, JsonObject } from "./types";

/** The types of the schema-change port (`SchemaChangeStore` in `ports.ts`). */

/**
 * The schema as it was last applied to the store (`monti schema:apply`): the version and the data model (collections, locales, default locale) in the form
 * the diff reads. The store returns `null` until a first apply recorded the baseline.
 */
export interface SchemaState {
	readonly schemaVersion: number;
	/** The applied schema as JSON: `{ collections, locales, defaultLocale }` of the normalized site config. */
	readonly schema: JsonObject;
	readonly appliedAt: Date;
}

/** Where a page of `scanBodies` ends: the entry and the state of its last body. */
export interface BodyCursor {
	readonly entryId: string;
	readonly state: "working" | "published";
}

/** One stored body (working or published) of an entry, as the schema check and the transforms read it. */
export interface ScannedBody {
	readonly entryId: string;
	readonly collection: string;
	readonly locale: string;
	/** A translation of another entry (it holds only the per-language values). */
	readonly isTranslation: boolean;
	readonly status: EntryStatus;
	readonly state: "working" | "published";
	readonly metadata: EntryMetadata;
	readonly doc: StoredDocument;
	/** The schema version the body was written or transformed under. */
	readonly schemaVersion: number;
}

/** What rewriting one body gives back to the store: the body as the write rules prepared it, with the metadata references that go with it. */
export interface RewrittenBody {
	readonly metadata: EntryMetadata;
	readonly doc: StoredDocument;
	readonly contentHash: string;
	/** The references of the body's metadata fields (occurrences of type `metadata`). Body occurrences of a stored reference are kept as they are. */
	readonly references: readonly {
		readonly kind: ReferenceKind;
		readonly targetId: string;
		readonly occurrences: readonly ReferenceOccurrence[];
	}[];
	/** Ids of the transforms that changed this body. */
	readonly changedBy: readonly string[];
}

export interface ApplySchemaChangeParams {
	/** Ids of every transform of the schema, in order. The store runs the ones that are not recorded yet, and records them. */
	readonly transformIds: readonly string[];
	/** The collections whose bodies the pending transforms may change. Only their bodies are read. */
	readonly collections: readonly string[];
	/** The schema (as JSON) and its version to record, and to stamp on every body the transforms change. */
	readonly schema: JsonObject;
	readonly schemaVersion: number;
	/**
	 * Called for each stored body of `collections` when there are pending transforms (`pending`, in order). Returns the body to store, or `null` to leave it
	 * as it is. It must not touch the database. If it throws, nothing is changed.
	 */
	readonly rewrite: (body: ScannedBody, pending: readonly string[]) => Promise<RewrittenBody | null>;
	/** Run everything and report, but change nothing. */
	readonly dryRun?: boolean;
}

export interface AppliedSchemaChange {
	/** The transforms that ran, in order. */
	readonly applied: readonly string[];
	/** The transforms that were recorded before and were skipped. */
	readonly skipped: readonly string[];
	/** Per transform that ran: how many entries and stored bodies it changed. */
	readonly changed: Readonly<Record<string, { readonly entries: number; readonly bodies: number }>>;
	/** Stored bodies rewritten, and the entries they belong to. */
	readonly bodies: number;
	readonly entries: number;
	readonly dryRun: boolean;
}
