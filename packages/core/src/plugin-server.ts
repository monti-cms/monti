/**
 * Server-side entry point for plugins. Used by plugin API routes, stores and migrations (core route scaffolding, errors).
 * The CMS instance types a plugin works with (`Cms`, `ContentService`, store ports, write hooks, `DeferDelivery`) come from `@monti-cms/core/server`.
 * A plugin route reads the CMS instance it is served by from its handler input (`adminRoute(async ({ cms }) => ...)`): `cms.store()`, `cms.mediaStore()`,
 * `cms.storage(pluginName)`, `cms.secrets(pluginName)`. Do not import from browser code.
 */

export { AuthError } from "./adapters/auth/auth-gateway";
export type { ApiKeys } from "./api-keys/api-keys";
export { type Problem, problemError, problemText, SetupError } from "./core/problem";
export { type Issue, ServiceError } from "./core/types";
export { type ExportBodyParams, exportBodyText } from "./format/export-body";
export {
	CmsError,
	cmsErrorText,
	ERROR_STATUS,
	type ErrorCode,
	type ErrorNotice,
	errorResponse,
	handleApiError,
} from "./http/v1/error-handler";
export * from "./http/v1/handler";
export { type ContentLookup, createContentLookup, type SlugsInUseParams } from "./plugin/content-lookup";
export type { PluginContext } from "./plugin/context";
export { type PluginLog, pluginError, pluginLog } from "./plugin/log";
export type { LoadedServerPlugin } from "./plugin/server";
export type {
	PluginCollection,
	PluginMigration,
	PluginStorage,
	StorageItem,
	StorageWriteOptions,
} from "./plugin/storage";
export type { PluginSecrets } from "./secrets";

export * from "./text-check/route";
