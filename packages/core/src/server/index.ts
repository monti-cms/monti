/**
 * Server-only entry point. Never import it from browser code (`@monti-cms/core/site` is the entry point that works in both).
 * It has what `monti.config.ts` needs (`defineConfig`, `createCms`, the `postgres` adapter and the server config types) and what server code
 * needs to work with the CMS instance: the `Cms` type, store ports, services, events, hooks, login types and snapshot helpers. It does not use
 * `server-only`, so it can also be loaded outside Next (cron scripts, site tests). The login method (`auth`) comes from `@monti-cms/auth`.
 */

// Login: the gateway, its errors and the checks routes run.
export * from "../adapters/auth";
// Config file: the instance and its options.
export { type PostgresOptions, postgres } from "../adapters/postgres/adapter";
export {
	type BulkService,
	type Cms,
	type ContentService,
	type CreateCmsOptions,
	createCms,
	type HandleOptions,
	type PublicServerConfig,
} from "../cms";
// Snapshot helpers and the public API options.
export * from "../core/snapshot";
// Stores: ports, errors, events, schema-change types and the data shapes (also exported from `@monti-cms/core/site`).
export * from "../core/store";
export { defaultPublicJson, type PublicApiOptions } from "../http/v1/public/options";
export type {
	AllowedMediaMime,
	MediaStore,
	PrepareUploadInput,
	PrepareUploadOutput,
	PromoteFileInput,
	StoredFileHead,
} from "../media/store";
export { ALLOWED_MEDIA_MIMES } from "../media/store";
export type { CmsRead } from "../read";

// Services: writes, events and the published read.
export * from "../services/content-service";
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
export { defineConfig, type MontiServerOptions, SECRET_ENV, SITE_URL_ENV } from "./config";
export { type Decision, formatDecision } from "./decision";
export {
	type AuthAdapter,
	type AuthContext,
	type AuthCreateContext,
	type AuthProvider,
	CMS_AUTH_BASE_PATH,
	type CmsAuth,
	type CmsServerConfig,
	type DatabaseAdapter,
	type DatabaseState,
	type LoginAccountRefusal,
	type LoginAccounts,
	type MediaAdapter,
	type MigrationSummary,
	type RequestHost,
} from "./define";
