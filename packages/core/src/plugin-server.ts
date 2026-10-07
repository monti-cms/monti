/**
 * Server-side entry point for plugins. Used by plugin API routes, stores and migrations (core route scaffolding, errors).
 * A plugin route reads the CMS instance it is served by from its handler input (`adminRoute(async ({ cms }) => ...)`): `cms.store()`, `cms.mediaStore()`,
 * `cms.storage(pluginName)`, `cms.secrets(pluginName)`. Do not import from browser code.
 */

export { AuthError } from "./adapters/auth/auth-gateway";
export type { BulkService, Cms, ContentService } from "./cms";
export type {
	AfterCommit,
	ContentChange,
	ContentChangeKind,
	ContentEvent,
	ContentStore,
	Entry,
	EntryBody,
	EntryStatus,
	PublishedEntryRecord,
} from "./core/store";
export { CmsError } from "./core/store";
export { type Issue, ServiceError } from "./core/types";
export { type ExportBodyParams, exportBodyText } from "./format/export-body";
export { HttpError, handleApiError } from "./http/v1/error-handler";
export * from "./http/v1/handler";
export { type ContentLookup, createContentLookup, type SlugsInUseParams } from "./plugin/content-lookup";
export type { LoadedServerPlugin } from "./plugin/server";
export type {
	ImportedItem,
	PluginCollection,
	PluginMigration,
	PluginStorage,
	StorageItem,
	StorageWriteOptions,
} from "./plugin/storage";
export type { LegacySecretFormat, PluginSecrets, PluginSecretsOptions } from "./secrets";
export type {
	TransformHook,
	ValidateHook,
	ValidatePublishHook,
	ValidationHookContext,
	ValidationResult,
	WriteData,
	WriteHookContext,
	WriteHooks,
	WriteOperation,
} from "./services/hooks";

export * from "./text-check/route";
