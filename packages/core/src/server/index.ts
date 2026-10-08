/**
 * Server entry point imported by the app's config file (`monti.config.ts`): `defineConfig`, which takes the site options and the server options (database,
 * login, storage, secret) together and makes the CMS instance the rest of the app uses, and the `postgres` adapter. `createCms` stays for code that builds
 * the site config and the server config itself. The login method (`auth`) comes from `@monti-cms/auth`.
 */

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
export type {
	AfterCommit,
	ContentChange,
	ContentChangeKind,
	ContentEvent,
	DeferredDelivery,
	EventDelivery,
	EventDeliveryCounts,
	EventDeliveryState,
} from "../core/store";
export { DeferDelivery } from "../core/store";
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
export type { WriteResult } from "../services/content-service";
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
	type LoginAccountRefusal,
	type LoginAccounts,
	type MediaAdapter,
	type MigrationSummary,
	type RequestHost,
} from "./define";
