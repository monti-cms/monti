/**
 * Server-only entry point. Never import it from browser code (`@monti-cms/core/site` is the entry point that works in both).
 * It has what `monti.config.ts` needs (`defineConfig`, the `postgres` adapter and the server config types) and what server code
 * needs to work with the CMS instance: the `Cms` type, services, events, hooks and snapshot helpers, and what a plugin's server side needs (`defineServerPlugin`, route scaffolding, errors, storage). It does not use
 * `server-only`, so it can also be loaded outside Next (cron scripts, site tests). The login method (`auth`) comes from `@monti-cms/auth`; the gateway, its errors and the checks routes run are in `@monti-cms/core/adapters/auth`.
 */

// Config file: the instance and its options.
export { type PostgresOptions, postgres } from "../adapters/postgres/adapter";
// Plugins: route scaffolding, errors, storage and the plugin helpers.
export type { ApiKeys } from "../api-keys/api-keys";
export type {
	BulkService,
	Cms,
	// What `cms.transaction` hands its work: plugin storage and the API key store inside one transaction.
	CmsTransaction,
	ContentService,
	HandleOptions,
	PublicServerConfig,
} from "../cms";
export type { ImageWarningResolvers, InputBody, TextImport } from "../core/snapshot";
// Snapshot helpers and the public API options.
export {
	documentInputBody,
	imageWarningsForSnapshot,
	MAX_DOC_BYTES,
	MAX_METADATA_BYTES,
	MAX_TEXT_BYTES,
	prepareSnapshot,
	readInputBody,
	serviceInputKeys,
	validateExactRecord,
	validateForPublish,
} from "../core/snapshot";
export type { AfterCommit, ContentChange, ContentChangeKind, ContentEvent, DeferredDelivery } from "../core/store";
// Stores: ports, errors, events, schema-change types and the data shapes (also exported from `@monti-cms/core/site`).
export { CONTENT_CHANGE_KINDS, DeferDelivery, isDeferred } from "../core/store";
export { type ExportBodyParams, exportBodyText } from "../format/export-body";
export {
	CmsError,
	cmsErrorText,
	ERROR_STATUS,
	type ErrorCode,
	type ErrorNotice,
	errorResponse,
	handleApiError,
} from "../http/v1/error-handler";
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
} from "../http/v1/handler";
export { defaultPublicJson, type PublicApiOptions } from "../http/v1/public/options";
export { type ContentLookup, createContentLookup, type SlugsInUseParams } from "../plugin/content-lookup";
export type { PluginContext } from "../plugin/context";
export { defineServerPlugin } from "../plugin/define";
export { type PluginLog, pluginError, pluginLog } from "../plugin/log";
export type {
	PluginCollection,
	PluginMigration,
	PluginStorage,
	StorageItem,
	StorageWriteOptions,
} from "../plugin/storage";
export type { PluginSecrets } from "../secrets";
// Services: writes, events and the published read.
export type { ContentServiceOptions, WriteResult } from "../services/content-service";
export type {
	CmsEvents,
	EventDeliveryOptions,
	EventListOptions,
	EventRetryOptions,
	EventRetryResult,
} from "../services/events";
export type {
	AfterCommitHook,
	TransformHook,
	ValidateHook,
	ValidatePublishHook,
	ValidationHookContext,
	ValidationResult,
	WriteData,
	WriteHookContext,
	WriteHooks,
	WriteOperation,
} from "../services/hooks";
export type { ServerTextCheck, TextCheckRouteOptions } from "../text-check/route";
export { handleTextCheck, parseTextCheckBody, textCheckRoute } from "../text-check/route";
export { defineConfig, type MontiServerOptions, SECRET_ENV, SITE_URL_ENV } from "./config";
export { type Decision, formatDecision } from "./decision";
export type { CmsServerConfig } from "./define";
