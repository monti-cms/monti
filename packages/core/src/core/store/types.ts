import type { StoredDocument } from "../../doc/stored-document";
import type { ListSortField } from "../api";
import type { TranslationState } from "../translation/state";
import type { ReferenceKind, ReferenceOccurrence } from "../types";

export type JsonPrimitive = string | number | boolean | null;
export interface JsonArray extends Array<JsonValue> {}
export interface JsonObject {
	[key: string]: JsonValue;
}
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type EntryMetadata = JsonObject;

export type EntryStatus = "draft" | "published" | "archived" | "trashed";

/** Entry for public reads only. Drafts, archived, and trashed entries cannot be represented by this type. */
export interface PublishedEntryRecord {
	readonly id: string;
	readonly collection: string;
	/** Content language. A translation's metadata is merged with the source's shared values. */
	readonly locale: string;
	readonly translationGroupId: string;
	readonly slug: string;
	readonly metadata: EntryMetadata;
	/** The stored document of the body. `null` in list reads with `includeBody: false`. */
	readonly doc: StoredDocument | null;
	readonly publishedAt: Date | null;
	readonly updatedAt: Date;
}

/**
 * Public detail read result. `alias` means the request came in on a former address, and `entry.slug` is the canonical current slug.
 * The caller handles `alias` as a 308 (permanent redirect). `reservation` and `deleted` slugs and
 * entries with no current slug do not exist in the public layer, so they fall under `not_found`.
 */
export type PublishedEntryLookup =
	| { readonly status: "current"; readonly entry: PublishedEntryRecord }
	| { readonly status: "alias"; readonly entry: PublishedEntryRecord }
	| { readonly status: "not_found" };

export interface EntryBody {
	metadata: EntryMetadata;
	/** The stored document of the body (one `unparsed` node when the body could not become a document, which only a draft can be). */
	doc: StoredDocument;
	schemaVersion: number;
	contentHash: string;
	updatedAt: Date;
	/** Translation status of a translation. `null` for sources and legacy translations. */
	translation?: TranslationState | null;
}

export interface BodyTemplate {
	id: string;
	name: string;
	/** The template body, a stored document like an entry body (one `unparsed` node when it came from a text that could not be read). */
	doc: StoredDocument;
	version: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface Entry {
	id: string;
	collection: string;
	/** Content language. */
	locale: string;
	/** Translation group ID. Equals the source's ID; for a source, its own ID. */
	translationGroupId: string;
	status: EntryStatus;
	version: number;
	folderId: string | null;
	createdAt: Date;
	updatedAt: Date;
	/** When the latest change that raised `version` was made (a save, publish or status change). Falls back to `updatedAt` for an entry with no change recorded. */
	changedAt?: Date;
	/** Who made that change (see `core/actor`). Absent when it was made outside an admin request, or before changes were recorded. */
	changedBy?: string;
	publishedAt?: Date;
	trashedAt?: Date;
	workingSlug: string | null;
	publishedSlug: string | null;
	working: EntryBody;
	published?: EntryBody;
}

/** Translation group. The first item of `members` is the source. */
export interface TranslationGroup {
	groupId: string;
	members: {
		id: string;
		locale: string;
		status: EntryStatus;
		isSource: boolean;
		title: string | null;
		workingSlug: string | null;
	}[];
}

export interface MediaOriginalFile {
	storageKey: string | null;
	stagingKey: string | null;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
}

export interface MediaAssetRecord {
	id: string;
	status: "pending" | "ready" | "failed" | "deleting";
	filename: string;
	mimeType: string | null;
	byteSize: number | null;
	width: number | null;
	height: number | null;
	stagingKey: string | null;
	storageKey: string | null;
	/** Original file when the upload was converted for the web. `null` for keep-original uploads. */
	original: MediaOriginalFile | null;
	defaultAlt: string;
	defaultCaption: string;
	createdAt: Date;
	updatedAt: Date;
	readyAt: Date | null;
}

export interface CreateMediaAssetInput {
	id?: string;
	filename: string;
	mimeType: string;
	byteSize: number;
	stagingKey: string;
	original?: { mimeType: string; byteSize: number; stagingKey: string };
}

export interface CompleteMediaAssetInput {
	id: string;
	storageKey: string;
	mimeType: string;
	byteSize: number;
	/** `null` for attachments, which have no dimensions. */
	width: number | null;
	height: number | null;
	original?: { storageKey: string; mimeType: string; byteSize: number; width: number; height: number };
}

export interface MediaReferenceItem {
	entryId: string;
	title: string | null;
	collection: string;
	state: "working" | "published";
}

export interface ListMediaItem extends MediaAssetRecord {
	referencesCount: number;
	references: MediaReferenceItem[];
}

export interface ListMediaParams {
	search?: string;
	mimeType?: string;
	/** Images only (`image`) or non-image attachments only (`file`). */
	kind?: "all" | "image" | "file";
	used?: "all" | "used" | "unused";
	uploadedFrom?: Date;
	uploadedTo?: Date;
	page?: number;
	pageSize?: number;
}

export interface ListMediaResult {
	items: ListMediaItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface Folder {
	id: string;
	collection: string;
	parentId: string | null;
	name: string;
	position: number;
	version: number;
}

export interface ListEntriesItem {
	id: string;
	collection: string;
	/** Content language and translation group ID. Shared relation values and the displayed publish date come from the source draft. */
	locale: string;
	translationGroupId: string;
	title: string | null;
	slug: string | null;
	status: EntryStatus;
	version: number;
	folderId: string | null;
	/**
	 * Relation field name to selected items and their names. Contains every relation field of the collection (an empty array when no value), in declaration and selection order.
	 * An item whose name cannot be found (a deleted target, etc.) has `title: null`. Non-per-language relations are read from the source draft.
	 */
	relations: Readonly<Record<string, readonly ListRelationValue[]>>;
	/**
	 * Field name to the value stored as text (text, select, and media fields). The list's default field-column cell renders it. Fields without a value are omitted.
	 * Non-per-language fields are read from the source draft.
	 */
	values: Readonly<Record<string, string>>;
	/** A published version exists and the latest draft differs from it (`발행됨 · 수정 중`). */
	hasUnpublishedChanges: boolean;
	publishedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	trashedAt: Date | null;
	/**
	 * Filled only in group view (`groupTranslations`). Holds the content in the same translation group that is not in
	 * the trash (including the source), in `LOCALES` order.
	 */
	translations?: readonly ListTranslationMember[];
	/**
	 * Filled only for record collections (categories, tags, collections). Holds the languages that have a name, in `LOCALES` order.
	 * The default language is the item's own name; other languages use `metadata.translations[locale].title`.
	 */
	recordLocales?: readonly string[];
}

/** One relation value of a list row. */
export interface ListRelationValue {
	id: string;
	title: string | null;
}

/** Per-language content of the same group attached to one list row (the source). */
export interface ListTranslationMember {
	id: string;
	locale: string;
	status: EntryStatus;
	version: number;
	isSource: boolean;
	hasUnpublishedChanges: boolean;
}

export interface DateRange {
	from?: Date;
	to?: Date;
}

export interface ListEntriesParams {
	collection: string;
	search?: string;
	includeBody?: boolean;
	/** Column header filter: title only (partial match). Combined with `search` using AND. */
	titleContains?: string;
	/** Column header filter: slug only (partial match). */
	slugContains?: string;
	statuses?: readonly EntryStatus[];
	/**
	 * Only these languages. All languages if unset.
	 * In group view, filters to "groups that have content in this language (outside the trash)".
	 */
	locales?: readonly string[];
	/**
	 * Each translation group shows as one source row. Search may match the title or slug in any language of the group,
	 * while other filters and sorting use the source's values. Every row fills `translations`.
	 */
	groupTranslations?: boolean;
	folderId?: string | null;
	includeDescendants?: boolean;
	/** Relation field name to selected item IDs. Multiple values of the same field are OR; different fields are AND. */
	relations?: Readonly<Record<string, readonly string[]>>;
	hasUnpublishedChanges?: boolean;
	createdAt?: DateRange;
	updatedAt?: DateRange;
	publishedAt?: DateRange;
	sort?: { field: ListSortField; direction: "asc" | "desc" };
	page?: number;
	pageSize?: 25 | 50 | 100;
}

/** Largest number of hits one search returns. */
export const MAX_ENTRY_SEARCH_LIMIT = 50;
/** Number of hits a search returns when `limit` is not given. */
export const DEFAULT_ENTRY_SEARCH_LIMIT = 20;

/** Search of the entries of one collection, for a picker (a relation field). Not a list: it has no paging, folders or filters beyond these. */
export interface SearchEntriesParams {
	collection: string;
	/** Text to find in the title (or slug). Empty or absent returns the first entries by title. */
	query?: string;
	/** Only entries of this content language. All languages if unset. */
	locale?: string;
	/** Only published entries. Otherwise every entry outside the trash. */
	publishedOnly?: boolean;
	/** At most this many hits (1 to {@link MAX_ENTRY_SEARCH_LIMIT}, default {@link DEFAULT_ENTRY_SEARCH_LIMIT}). */
	limit?: number;
	/**
	 * Entries to look up by id instead of searching (the values a picker already holds, so they show their titles whatever the search finds).
	 * With it, `query`, `locale`, `publishedOnly` and `limit` are not applied; entries of another collection and trashed ones are not found.
	 */
	ids?: readonly string[];
}

/** One entry found by {@link SearchEntriesParams}. */
export interface EntrySearchHit {
	id: string;
	/** The title of the draft, or the slug when the draft has no title. `null` when it has neither. */
	title: string | null;
	slug: string | null;
	status: EntryStatus;
}

export interface ListEntriesResult {
	items: ListEntriesItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface IncomingReferenceItem {
	state: "working" | "published";
	sourceId: string;
	sourceCollection: string;
	sourceTitle: string | null;
	sourceSlug: string | null;
	kind: ReferenceKind;
	isStale: boolean;
	occurrences: readonly ReferenceOccurrence[];
}

export interface ExportSnapshotBody {
	metadata: EntryMetadata;
	doc: StoredDocument;
	schemaVersion: number;
	contentHash: string;
	updatedAt: Date;
	/** Translation status of a translation. */
	translation?: TranslationState | null;
}

export interface ExportSnapshotEntry {
	id: string;
	collection: string;
	/** Content language and translation group ID. For a source, the group ID is its own ID. */
	locale: string;
	translationGroupId: string;
	status: string;
	version: number;
	folderId: string | null;
	workingSlug: string | null;
	publishedSlug: string | null;
	createdAt: Date;
	updatedAt: Date;
	publishedAt: Date | null;
	working: ExportSnapshotBody;
	published?: ExportSnapshotBody;
}

export interface ExportSnapshotReference {
	entryId: string;
	state: string;
	kind: string;
	targetId: string;
	isStale: boolean;
	occurrences: unknown;
}

export interface ExportSnapshotAddress {
	collection: string;
	locale: string;
	slug: string;
	entryId: string | null;
	type: string;
}

/** Common source for admin backup and public projection. A single REPEATABLE READ READ ONLY snapshot. */
export interface ExportSnapshot {
	entries: ExportSnapshotEntry[];
	references: ExportSnapshotReference[];
	folders: Folder[];
	addresses: ExportSnapshotAddress[];
	media: MediaAssetRecord[];
	templates: BodyTemplate[];
	preferences: { userId: string; preferences: JsonObject; updatedAt: Date }[];
}

/** Public list sort. Publish date is the source's, modified date is this language body's, title is this language's title. */
export type PublishedSort = "publishedAt" | "updatedAt" | "title";

export interface PublishedPageParams {
	readonly collection: string;
	/** Only this language's content. Defaults to the default language. */
	readonly locale?: string;
	/** Relation field name to selected item IDs. Multiple values of the same field are OR; different fields are AND. */
	readonly where?: Readonly<Record<string, string | readonly string[]>>;
	readonly sort?: PublishedSort;
	/**
	 * Display language used for title sorting. An item collection keeps one default-language record with per-language names (`translations`), so it sorts
	 * by that language's name (falling back to the default name). If unset, `locale`.
	 */
	readonly titleLocale?: string;
	readonly order?: "asc" | "desc";
	/** 1-based. */
	readonly page?: number;
	/** 1 to 500. Default 25. */
	readonly pageSize?: number;
	readonly includeBody?: boolean;
}
