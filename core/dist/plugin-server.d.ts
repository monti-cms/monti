/**
 * Server-side entry point for plugins. Used by plugin API routes, stores and migrations (core route scaffolding, errors).
 * A plugin route reads the CMS instance it is served by from its handler input (`adminRoute(async ({ cms }) => ...)`): `cms.store()`, `cms.mediaStore()`,
 * `cms.storage(pluginName)`, `cms.secrets(pluginName)`. Do not import from browser code.
 */
export { AuthError } from "./adapters/auth/auth-gateway.js";
export type { BulkService, Cms, ContentService } from "./cms/index.js";
export { type Problem, problemError, problemText, SetupError } from "./core/problem.js";
export type { AfterCommit, ContentChange, ContentChangeKind, ContentEvent, ContentStore, Entry, EntryBody, EntryStatus, PublishedEntryRecord, } from "./core/store/index.js";
export { CmsError, DeferDelivery, type DeferredDelivery } from "./core/store/index.js";
export { type Issue, ServiceError } from "./core/types.js";
export { type ExportBodyParams, exportBodyText } from "./format/export-body.js";
export { HttpError, handleApiError } from "./http/v1/error-handler.js";
export * from "./http/v1/handler.js";
export { type ContentLookup, createContentLookup, type SlugsInUseParams } from "./plugin/content-lookup.js";
export type { LoadedServerPlugin } from "./plugin/server.js";
export type { ImportedItem, PluginCollection, PluginMigration, PluginStorage, StorageItem, StorageWriteOptions, } from "./plugin/storage.js";
export type { LegacySecretFormat, PluginSecrets, PluginSecretsOptions } from "./secrets/index.js";
export type { WriteResult } from "./services/content-service.js";
export type { AfterCommitHook, TransformHook, ValidateHook, ValidatePublishHook, ValidationHookContext, ValidationResult, WriteData, WriteHookContext, WriteHooks, WriteOperation, } from "./services/hooks.js";
export * from "./text-check/route.js";
