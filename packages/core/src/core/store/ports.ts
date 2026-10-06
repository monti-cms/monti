import type { PreparedSnapshot, Reference, WorkingCopy } from "../types";
import type {
	BodyTemplate,
	CompleteMediaAssetInput,
	CreateMediaAssetInput,
	Entry,
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
	createTemplate(data: { name: string; mdx: string }): Promise<BodyTemplate>;
	updateTemplate(params: { id: string; expectedVersion: number; name?: string; mdx?: string }): Promise<BodyTemplate>;
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
		TransferStore {}
