/**
 * Server-side entry point for plugins. Used by plugin API routes, stores and migrations (core route scaffolding, errors).
 * The CMS instance types a plugin works with (`Cms`, `ContentService`, store ports, write hooks, `DeferDelivery`) come from `@monti-cms/core/server`.
 * A plugin route reads the CMS instance it is served by from its handler input (`adminRoute(async ({ cms }) => ...)`): `cms.store()`, `cms.mediaStore()`,
 * `cms.storage(pluginName)`, `cms.secrets(pluginName)`. Do not import from browser code.
 */

export type { ApiKeys } from "./api-keys/api-keys";

export type { Issue } from "./core/types";
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
export {
	type AdminHandler,
	type AdminRequest,
	adminRoute,
	assertVersionPresent,
	type BearerHandler,
	type BearerRequest,
	bearerRoute,
	bearerTokenOf,
	bulkWritten,
	deleted,
	ok,
	type PublicHandler,
	type PublicRequest,
	parseWith,
	publicRoute,
	type RouteAccess,
	readBodyText,
	readFormatQuery,
	readFormBody,
	readJsonBody,
	readQuery,
	readVersionedBody,
	readVersionQuery,
	written,
} from "./http/v1/handler";
export { type ContentLookup, createContentLookup, type SlugsInUseParams } from "./plugin/content-lookup";
export type { PluginContext } from "./plugin/context";
export { type PluginLog, pluginError, pluginLog } from "./plugin/log";
export type {
	PluginCollection,
	PluginMigration,
	PluginStorage,
	StorageItem,
	StorageWriteOptions,
} from "./plugin/storage";
export type { PluginSecrets } from "./secrets";

export * from "./text-check/route";
