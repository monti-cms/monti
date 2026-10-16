/**
 * Entry point that works in the browser and on the server: request/response shapes of the admin API, the data shapes the stores return
 * (`Entry`, `Folder`, `ListEntriesItem`, ...), and helpers built from the site config (collections, locales, URLs, blocks, schemas).
 * It contains no server-only code (DB, secrets), so screens, custom pages and "use client" files may import it.
 */

export * from "./blocks/active";
export * from "./blocks/define";
export * from "./blocks/definitions";
export * from "./blocks/derive";
export * from "./config/check/collections";
export * from "./config/check/fields";
export { ConfigError, type Issue, IssueList, pathOf } from "./config/check/issue";
export type { CmsConfig, EditorConfig, EditorWidthStep } from "./config/define";
export * from "./config/rules";
export * from "./core/admin-features";
export * from "./core/admin-paths";
export * from "./core/api";
export * from "./core/api-keys";
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
// Data shapes the stores return. The store's own `JsonValue` (mutable) is left out: `./core/types` already exports the readonly one under that name.
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
	Folder,
	IncomingReferenceItem,
	JsonArray,
	JsonObject,
	JsonPrimitive,
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
	TranslationGroup,
} from "./core/store/types";
export * from "./core/time";
export * from "./core/translation/hints";
export * from "./core/translation/skeleton";
export * from "./core/translation/source-diff";
export * from "./core/translation/state";
export * from "./core/types";
export type { StoredDocument } from "./doc/stored-document";
export * from "./i18n";
export * from "./schema/allowed";
export * from "./schema/collection";
export * from "./schema/derive";
export * from "./schema/field-sets";
export * from "./schema/fields";
export * from "./schema/layout";
export * from "./schema/walk";
export * from "./site";
export * from "./text-check/normalize";
export * from "./text-check/remote";
export * from "./text-check/types";
