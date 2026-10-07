import type { Issue, PreparedSnapshot, Reference, WorkingCopy } from "../types";
import type { ClaimedDelivery, EventDelivery, EventDeliveryCounts, EventDeliveryState } from "./events";
import type {
	AppliedSchemaChange,
	ApplySchemaChangeParams,
	BodyCursor,
	ScannedBody,
	SchemaState,
} from "./schema-change";
import type {
	BodyTemplate,
	CompleteMediaAssetInput,
	CreateMediaAssetInput,
	Entry,
	EntrySearchHit,
	ExportSnapshot,
	Folder,
	IncomingReferenceItem,
	JsonObject,
	ListEntriesParams,
	ListEntriesResult,
	ListMediaParams,
	ListMediaResult,
	MediaAssetRecord,
	PublishedEntryLookup,
	PublishedEntryRecord,
	PublishedPageParams,
	SearchEntriesParams,
	TranslationGroup,
} from "./types";

/**
 * Store ports: what the services, the HTTP layer and the plugins ask of a database. `ContentStore` is the union of the sub-ports below;
 * an adapter (`adapters/postgres`) implements all of them, and nothing outside an adapter knows which database is behind it.
 *
 * Every write that takes `expectedVersion` fails with a `CmsError` coded `conflict` (carrying the stored version) when the stored version differs.
 * The rules a store applies (slug addresses, translations, publish and lifecycle transitions) are in `core/domain/`; the adapter only runs them in a transaction.
 */

/** Entry reads and draft writes. */
export interface EntryStore {
	/**
	 * Creates a draft with its references and slug reservation. `snapshot` is the draft as the write pipeline prepared it.
	 * With `publishImmediately` it is published in the same transaction.
	 */
	createEntryWithReferences(params: {
		snapshot: PreparedSnapshot;
		references: readonly Reference[];
		folderId?: string | null;
		publishImmediately?: boolean;
		/** Content language. Defaults to the default language. */
		locale?: string;
		/** Source ID for a translation (the translation group ID). */
		translationOf?: string;
	}): Promise<Entry>;
	/**
	 * Saves the latest draft. An identical value leaves the version and modified date unchanged. Moving only the folder bumps the version
	 * but keeps the content modified date.
	 */
	saveWorkingWithReferences(params: {
		entryId: string;
		expectedVersion: number;
		snapshot: PreparedSnapshot;
		references: readonly Reference[];
		folderId?: string | null;
		publishImmediately?: boolean;
		/** With `publishImmediately`: reset the publish date to now. */
		resetPublishedAt?: boolean;
		/** Sets the publish date (instead of now or the kept first-publish time), for content that was published before it came here. */
		publishedAt?: Date;
		onWarnings?: (warnings: readonly Issue[]) => void;
	}): Promise<Entry>;
	getWorkingReferences(params: { entryId: string }): Promise<Reference[]>;
	getWorking(params: { entryId: string }): Promise<WorkingCopy>;
	/** The source and its translations, in language order. */
	getTranslationGroup(params: { entryId: string }): Promise<TranslationGroup>;
	getEntry(id: string): Promise<Entry>;
	/** Admin preview lookup: also finds drafts, archived and trashed entries, so the caller must check admin authentication first. */
	getWorkingEntryBySlug(params: { collection: string; slug: string; locale?: string }): Promise<Entry | null>;
	/** Publishes the saved draft. `snapshot` is the prepared draft (see `PublishOptions.snapshot` in the adapter). */
	publishEntry(params: {
		id: string;
		expectedVersion: number;
		snapshot: PreparedSnapshot;
		resetPublishedAt?: boolean;
		/** Sets the publish date (instead of now or the kept first-publish time), for content that was published before it came here. */
		publishedAt?: Date;
		/** Receives the notices the checks against locked rows found (a link to an entry that is not published). They never block. */
		onWarnings?: (warnings: readonly Issue[]) => void;
	}): Promise<Entry>;
	/**
	 * The entries the addresses of internal body links point to (default language, `/posts/slug`), as translation group ids. An address no entry holds,
	 * and one held by a trashed entry, is not in the result.
	 */
	resolveLinkTargets(params: {
		addresses: readonly { collection: string; slug: string; locale?: string }[];
	}): Promise<{ collection: string; slug: string; locale: string; entryId: string }[]>;
	/** Field relations and body references that point at an entry, split into draft and published. */
	getIncomingReferences(params: { targetId: string }): Promise<IncomingReferenceItem[]>;
	/**
	 * Slugs already used in the same collection and language: current, reserved, former and deleted-entry slugs, which are the same slugs that cause
	 * a `slug_conflict` on save. An empty `slugs` returns an empty set.
	 */
	slugsInUse(params: {
		collection: string;
		locale: string;
		slugs: readonly string[];
		/** Ignore slugs used by this entry (the entry being edited). */
		excludeEntryId?: string;
	}): Promise<Set<string>>;
}

/** Status transitions. A disallowed source status is rejected with `invalid_status`. */
export interface LifecycleStore {
	/** Draft or published to archived. */
	archiveEntry(params: { id: string; expectedVersion: number }): Promise<Entry>;
	/** Archived to draft. */
	unarchiveEntry(params: { id: string; expectedVersion: number }): Promise<Entry>;
	trashEntry(params: { id: string; expectedVersion: number }): Promise<Entry>;
	/** A record collection is published again on restore, so it needs its prepared draft (`snapshot`). */
	restoreEntry(params: { id: string; expectedVersion: number; snapshot?: PreparedSnapshot }): Promise<Entry>;
	permanentDeleteEntry(params: { id: string; expectedVersion: number }): Promise<void>;
}

/** The admin list: search, filters, sorting and paging done by the store. */
export interface ListStore {
	listEntries(params: ListEntriesParams): Promise<ListEntriesResult>;
	/**
	 * Finds entries of one collection by title for a picker, so it loads only what it shows. The best matches come first: a title equal to the
	 * query, then one that starts with it, one with a word that starts with it, one that contains it, and last a slug that contains it; equal
	 * matches are ordered by title. Matching ignores case. Trashed entries are never found.
	 */
	searchEntries(params: SearchEntriesParams): Promise<EntrySearchHit[]>;
}

/** Per-collection virtual folders. */
export interface FolderStore {
	createFolder(params: {
		collection: string;
		parentId: string | null;
		name: string;
		position?: number;
	}): Promise<Folder>;
	/** The HTTP layer always requires `expectedVersion`. The store compares it only when given. */
	updateFolder(params: {
		id: string;
		expectedVersion?: number;
		name?: string;
		parentId?: string | null;
		position?: number;
	}): Promise<Folder>;
	/** Moves the folder's entries and child folders up to its parent, then deletes it. */
	deleteFolder(params: { id: string; expectedVersion?: number }): Promise<void>;
	getFolderContents(params: { id: string }): Promise<{ entryCount: number; childFolders: Folder[] }>;
	listFolders(params: { collection: string }): Promise<Folder[]>;
}

/** Public reads. Never returns drafts, archived or trashed entries. */
export interface PublicReadStore {
	listPublishedEntries(params: {
		collections: readonly string[];
		includeBody?: boolean;
		/** Only this language's content. All languages if unset. Record collections have only the default language. */
		locale?: string;
	}): Promise<PublishedEntryRecord[]>;
	getPublishedEntryBySlug(params: {
		collection: string;
		slug: string;
		includeBody?: boolean;
		/** Language of the slug. Defaults to the default language. */
		locale?: string;
	}): Promise<PublishedEntryLookup>;
	listPublishedPage(
		params: PublishedPageParams,
	): Promise<{ items: PublishedEntryRecord[]; total: number; page: number; pageSize: number }>;
	/** Published languages of a translation group (including the source). Empty if the source is not published. */
	listPublishedTranslations(params: {
		translationGroupId: string;
	}): Promise<{ id: string; collection: string; locale: string; slug: string }[]>;
	/** Published versions (all languages) for translation group IDs. Targets that are not published are omitted. */
	listPublishedByGroups(params: { translationGroupIds: readonly string[] }): Promise<PublishedEntryRecord[]>;
}

/** Media metadata. The file itself is handled by `MediaStore`. */
export interface MediaMetadataStore {
	createMediaAsset(input: CreateMediaAssetInput): Promise<MediaAssetRecord>;
	completeMediaAsset(input: CompleteMediaAssetInput): Promise<MediaAssetRecord>;
	failMediaAsset(id: string): Promise<void>;
	/** The library's default alt and caption. They are copied only on insert, so bodies already written do not change. */
	updateMediaMetadata(params: {
		id: string;
		filename?: string;
		defaultAlt?: string;
		defaultCaption?: string;
	}): Promise<MediaAssetRecord>;
	listMediaAssets(params?: ListMediaParams): Promise<ListMediaResult>;
	getMediaAsset(id: string): Promise<MediaAssetRecord | null>;
	/** The ready media files stored under these keys (the keys of public URLs). A key no ready file holds is left out. Core turns image URLs of an imported body into media ids with it. */
	findReadyMediaByStorageKeys(params: { keys: readonly string[] }): Promise<{ id: string; storageKey: string }[]>;
	/** Delete step 1: checks the media is not in use and sets it to `deleting`. */
	beginMediaDelete(id: string): Promise<MediaAssetRecord>;
	/** Delete step 2: removes the row after the file was deleted. */
	finalizeMediaDelete(id: string): Promise<void>;
	/** Incomplete and failed uploads older than the cutoff time. */
	listStaleUploads(params: { before: Date }): Promise<MediaAssetRecord[]>;
}

/** Body templates picked from `새 글`. */
export interface TemplateStore {
	listTemplates(): Promise<BodyTemplate[]>;
	getTemplate(id: string): Promise<BodyTemplate>;
	/** `doc` is checked as a stored document; its blocks get ids. Without it the template is empty. */
	createTemplate(data: { name: string; doc?: unknown }): Promise<BodyTemplate>;
	/** Without `doc` the stored body is kept. Blocks keep the ids of the body they replace where they pair up. */
	updateTemplate(params: { id: string; expectedVersion: number; name?: string; doc?: unknown }): Promise<BodyTemplate>;
	deleteTemplate(params: { id: string; expectedVersion: number }): Promise<void>;
}

/** Per-admin list and editor preferences. */
export interface PreferenceStore {
	getPreferences(params: { userId: string }): Promise<JsonObject | null>;
	savePreferences(params: { userId: string; preferences: JsonObject }): Promise<void>;
}

/** Admin export. */
export interface TransferStore {
	/** A consistent read-only snapshot of everything the export holds. Entry order is fixed so the same data yields the same result. */
	readExportSnapshot(): Promise<ExportSnapshot>;
}

/**
 * Schema changes (`schema-change/`): what the store knows about the schema it was last applied under, a read-only look at the stored bodies for the impact
 * check, and the transactional apply of the data transforms.
 */
export interface SchemaChangeStore {
	/** The schema last applied (`applySchemaChange`), or `null` when none was yet. */
	readSchemaState(): Promise<SchemaState | null>;
	/** Which of these transform ids already ran (are recorded). Read-only. */
	appliedSchemaTransforms(ids: readonly string[]): Promise<string[]>;
	/**
	 * A page of the stored bodies (working and published) of the collections, ordered by entry and then state, so the bodies of one entry are next to each other.
	 * Without `collections`, all of them. Pass the `next` of the last page as `after` for the following one; `next` is `null` on the last. Read-only.
	 * (`scanAllBodies` in `schema-change/` walks the pages.)
	 */
	scanBodies(params?: {
		collections?: readonly string[];
		after?: BodyCursor;
		limit?: number;
	}): Promise<{ bodies: readonly ScannedBody[]; next: BodyCursor | null }>;
	/**
	 * Runs the transforms that are not recorded yet over the bodies of `collections`, records them, and records the schema and its version, in one transaction under the
	 * lock the migrations use, so a second run (or a concurrent one) runs nothing again. `version` and `updated_at` of entries and bodies stay as they are, and
	 * working and published bodies are rewritten the same way, so "unpublished changes" stays true or false as it was.
	 */
	applySchemaChange(params: ApplySchemaChangeParams): Promise<AppliedSchemaChange>;
}

/**
 * The event outbox (`events.ts`). The store writes an event for every committed change in the same transaction as the change (so the two stand or fall
 * together); this port is what the dispatcher (`services/events.ts`) and the admin use to deliver them. Delivery rows are made by `enqueueEvents`, one per
 * subscriber, so a subscriber added later does not get the history before it.
 * Times are passed in (`now`) so the caller owns the clock.
 */
export interface EventStore {
	/**
	 * Makes the delivery rows (one per subscriber, `pending`, due now) of the events that have none: those of one entry, or the recent ones of any entry
	 * (committed since `since`). It is idempotent, and returns the number of rows made.
	 */
	enqueueEvents(params: { subscribers: readonly string[]; entryId?: string; since?: Date; now: Date }): Promise<number>;
	/**
	 * Claims the deliveries that are due: `pending`, `failed` with `nextAttemptAt` reached (any `failed` with `ignoreBackoff`), and `delivering` whose lease ran out.
	 * A delivery is claimed only when no earlier event of the same entry is waiting for the same subscriber (`pending`, `delivering` or `failed`), which is the
	 * delivery order per entry; dead and dismissed deliveries do not hold the order. The claim counts the try (`attempts`) and holds the delivery for `leaseMs`.
	 * Oldest events first. Two callers never claim the same delivery.
	 */
	claimDeliveries(params: {
		subscribers: readonly string[];
		now: Date;
		leaseMs: number;
		limit: number;
		entryIds?: readonly string[];
		ignoreBackoff?: boolean;
	}): Promise<ClaimedDelivery[]>;
	completeDelivery(params: { eventId: string; subscriber: string; now: Date }): Promise<void>;
	/** Records a failed try: `failed` and due at `retryAt`, or `dead` when the try was the `maxAttempts`th. Returns the new state. */
	failDelivery(params: {
		eventId: string;
		subscriber: string;
		error: string;
		now: Date;
		retryAt: Date;
		maxAttempts: number;
	}): Promise<"failed" | "dead">;
	/**
	 * Puts a claimed delivery back to `pending`, due at `retryAt`, without counting the try (`attempts` goes back by one) and without an error: the subscriber
	 * asked to be called again later (a batch window, a rate limit it knows the end of). It is not listed as failed and never dead-letters. It still holds the
	 * order of its entry. Returns `false` when the delivery is not in flight.
	 */
	deferDelivery(params: { eventId: string; subscriber: string; retryAt: Date }): Promise<boolean>;
	/** Deliveries in the states (default `failed` and `dead`), newest event first. */
	listEventDeliveries(params?: {
		states?: readonly EventDeliveryState[];
		limit?: number;
		offset?: number;
	}): Promise<{ items: EventDelivery[]; total: number }>;
	countEventDeliveries(): Promise<EventDeliveryCounts>;
	/** A failed or dead delivery becomes `pending` and due now, with its attempts counted from zero. `false` when it is in another state. */
	retryDelivery(params: { eventId: string; subscriber: string; now: Date }): Promise<boolean>;
	/** A failed or dead delivery becomes `dismissed`: it is no longer retried or listed. `false` when it is in another state. */
	dismissDelivery(params: { eventId: string; subscriber: string }): Promise<boolean>;
	/** Removes events committed before `before` whose deliveries are all finished (delivered or dismissed), or that have none. Returns the number removed. */
	pruneEvents(params: { before: Date }): Promise<number>;
}

/** Everything the content store offers. */
export interface ContentStore
	extends EntryStore,
		LifecycleStore,
		ListStore,
		FolderStore,
		PublicReadStore,
		MediaMetadataStore,
		TemplateStore,
		PreferenceStore,
		TransferStore,
		SchemaChangeStore,
		EventStore {}
