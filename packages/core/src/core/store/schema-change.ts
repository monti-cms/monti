import type { StoredDocument } from "../../doc/stored-document";
import type { ReferenceKind, ReferenceOccurrence } from "../types";
import type { EntryMetadata, EntryStatus, JsonObject } from "./types";

/** The types of the schema-change port (`SchemaChangeStore` in `ports.ts`). */

/**
 * The schema as it was last applied to the store (`monti schema:apply`): the data model (collections, locales, default locale) in the form
 * the diff reads. The store returns `null` until a first apply recorded the baseline.
 */
export interface SchemaState {
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

/** An entry of another collection that points into a collection, for the check before a drop. */
export interface FootprintReferrer {
	readonly id: string;
	readonly title: string | null;
	readonly collection: string;
	readonly locale: string;
	readonly status: EntryStatus;
}

/**
 * What a collection holds in the store, counted for the review of removing it. Entries are counted once per translation group (a translation comes with its
 * source), the trashed ones included.
 */
export interface CollectionFootprint {
	/** Entries (translation groups), the trashed ones included. */
	readonly entries: number;
	/** Of `entries`, the ones in the trash. */
	readonly trashed: number;
	/** Translations on top of `entries` (one row per extra language). */
	readonly translations: number;
	readonly folders: number;
	/** Addresses of the collection, the old ones (renamed, reserved, deleted) included. */
	readonly addresses: number;
	/** Only with `detail`: what points into the collection from outside. */
	readonly incoming?: {
		/** Entries of other collections, the trashed ones included, whose relation fields point at an entry of the collection. They block a drop until unlinked. */
		readonly relations: number;
		/** The first of them (by creation), at most `sampleSize`. */
		readonly sample: readonly FootprintReferrer[];
		/** Places in the bodies of entries of other collections that link to an entry of the collection. They do not block: they become broken links. */
		readonly bodyLinks: number;
	};
}

/** What a drop deleted. */
export interface DroppedCollection {
	readonly collection: string;
	readonly entries: number;
	readonly trashed: number;
	readonly translations: number;
	readonly folders: number;
	readonly addresses: number;
}

export interface ApplySchemaChangeParams {
	/** Ids of every transform of the schema, in order. The store runs the ones that are not recorded yet, and records them. */
	readonly transformIds: readonly string[];
	/** The collections whose bodies the pending transforms may change. Only their bodies are read. */
	readonly collections: readonly string[];
	/**
	 * The `dropCollection` transforms, by id (a subset of `transformIds`). The ones that are not recorded yet delete their collection's data in the same
	 * transaction: every entry with its translations, bodies and references, its folders and its addresses. Refused (`in_use`, nothing changed) while an entry of
	 * another collection still has a relation field pointing at one of its entries. Body links from other collections do not block: their reference rows go and
	 * the links stay in the text, broken.
	 */
	readonly dropCollections?: readonly { readonly id: string; readonly collection: string }[];
	/** The schema (as JSON) to record. */
	readonly schema: JsonObject;
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
	/** What the dropped collections held, as deleted. */
	readonly dropped: readonly DroppedCollection[];
	/** Stored bodies rewritten, and the entries they belong to. */
	readonly bodies: number;
	readonly entries: number;
	readonly dryRun: boolean;
}
