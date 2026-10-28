/**
 * Entry point that works in the browser and on the server: request/response shapes of the admin API, the data shapes the stores return
 * (`Entry`, `Folder`, `ListEntriesItem`, ...), and helpers built from the site config (collections, locales, URLs, blocks, schemas).
 * It contains no server-only code (DB, secrets), so screens, custom pages and "use client" files may import it.
 */

export * from "./blocks/active";
export { RESERVED_BLOCK_ATTRIBUTES } from "./blocks/define";
export * from "./blocks/definitions";
export * from "./blocks/derive";
export * from "./config/check/collections";
export * from "./config/check/fields";
export type { ConfigIssue } from "./config/check/issue";

export {
	DEFAULT_ADMIN_PATH,
	HOST_PATTERN,
	isAdminPath,
	isHomeHref,
	isHttpUrl,
	isLocalUrl,
	isTimeZone,
	LOCALE_CODE,
	LOCALE_PREFIX_MODES,
	languageName,
	NAME_PATTERN,
	OPTION_VALUE_PATTERN,
	PREVIEW_PARAM_NAME,
	RESERVED_COLLECTION_NAMES,
	UUID_PATTERN,
	UUID_SOURCE,
} from "./config/rules";
export * from "./core/admin-features";
export * from "./core/admin-paths";
export type {
	AdminColumnSettings,
	BulkOp,
	CollectionPreferences,
	ListSortField,
	PageSize,
	PreferencesBody,
} from "./core/api";
export { LIST_SORT_FIELDS, PAGE_SIZES, TRANSLATION_FILTERS } from "./core/api";
export type { ApiKeyChoiceInput, ApiKeyList, ApiKeySlotView, ApiKeyView } from "./core/api-keys";
export { apiKeyChoiceSchema } from "./core/api-keys";
export { type BodyTextOptions, documentText, EXCERPT_TEXT, SEARCH_TEXT } from "./core/body-text";
export * from "./core/collections";
export { canTransition, type LifecycleAction } from "./core/domain/lifecycle";
export * from "./core/file-display";
export * from "./core/ids";
export {
	type IssueLike,
	type IssueText,
	issueMessages,
	issueText,
	type ToldIssue,
	tellIssues,
} from "./core/issue-text";
export * from "./core/links";
export * from "./core/locales";
export * from "./core/path-pattern";
export * from "./core/plain-text";
export * from "./core/plural";
export * from "./core/slug";
// Data shapes the stores return. The store's own mutable JSON type (`MutableJsonValue`) is left out: `./core/types` exports the readonly `JsonValue`.
export type {
	BodyTemplate,
	CompleteMediaAssetInput,
	CreateMediaAssetInput,
	DateRange,
	Entry,
	EntryBody,
	EntryMetadata,
	EntrySearchHit,
	EntryStatus,
	ExportSnapshot,
	ExportSnapshotAddress,
	ExportSnapshotBody,
	ExportSnapshotEntry,
	ExportSnapshotReference,
	FieldCondition,
	Folder,
	FolderListItem,
	IncomingReferenceItem,
	JsonArray,
	JsonObject,
	JsonPrimitive,
	ListCounts,
	ListCountsParams,
	ListEntriesItem,
	ListEntriesParams,
	ListEntriesResult,
	ListMediaItem,
	ListMediaParams,
	ListMediaResult,
	ListRelationValue,
	ListTranslationMember,
	MediaAssetRecord,
	MediaOriginalFile,
	MediaReferenceItem,
	PublishedEntryLookup,
	PublishedEntryRecord,
	PublishedPageParams,
	PublishedSort,
	SearchEntriesParams,
	TranslationFilter,
	TranslationGroup,
} from "./core/store/types";
export * from "./core/time";
export * from "./core/translation/hints";
export * from "./core/translation/skeleton";
export * from "./core/translation/source-diff";
export * from "./core/translation/state";
export type {
	BodyPosition,
	Collection,
	InternalLinkSource,
	Issue,
	JsonValue,
	MetadataValue,
	PreparedSnapshot,
	Reference,
	ReferenceKind,
	ReferenceOccurrence,
	ResolvedInternalLink,
	ResolvedTargets,
	SaveDraftInput,
	ServiceInput,
	WorkingCopy,
} from "./core/types";
export { readReferenceOccurrence, readReferenceOccurrences, ServiceError } from "./core/types";
export type { SiteI18n, Translator } from "./i18n";
export { createI18n, createTranslator, fillVars, josa, languageOf } from "./i18n";
export * from "./schema/allowed";
export type { CollectionKind, PublishedMetadataOf } from "./schema/collection";
export { kindDefaults, normalizeCollection } from "./schema/collection";
export * from "./schema/derive";
export type { NamedFieldSet } from "./schema/field-sets";
export { FIELD_SETS_CONTRIBUTION, fieldSetsOf, freshSetFields, hasFieldSet } from "./schema/field-sets";
export type { FieldTraits, StorageType, ValueOf } from "./schema/fields";
export {
	DEFAULT_TITLE_FIELD,
	FILL_FROM_BODY_MAX_LENGTH,
	fieldTraits,
	fillFromBodyLength,
	isRequiredField,
	isStoredField,
	RECORD_TRANSLATIONS_KEY,
	RESERVED_METADATA_KEYS,
	storageTypeOf,
} from "./schema/fields";
export type { NamedPlacement, PanelGroup, PanelSource, SitePanel } from "./schema/layout";
export {
	checkPlacements,
	createPanel,
	DEFAULT_TAB,
	isPanelField,
	LAYOUT_CONTRIBUTION,
	panelGroupsOf,
	panelTabOf,
	panelTabsOf,
	placementsOf,
} from "./schema/layout";
export * from "./schema/walk";
export * from "./site";
