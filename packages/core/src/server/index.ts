/**
 * Server entry point imported by the app's server file (`cms.server.ts`): the server config authoring API (`defineServerConfig`, `postgres`)
 * and `createCms`, which turns the server config into the CMS instance the rest of the app uses. The login method (`auth`) comes from
 * `@monti-cms/auth`.
 */

export { type PostgresOptions, postgres } from "../adapters/postgres/adapter";
export type {
	AllowedMediaMime,
	MediaStore,
	PrepareUploadInput,
	PrepareUploadOutput,
	PromoteFileInput,
	StoredFileHead,
} from "../adapters/r2/types";
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
	CmsEvents,
	EventDeliveryOptions,
	EventListOptions,
	EventRetryOptions,
	EventRetryResult,
} from "../services/events";
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
} from "../services/hooks";
export {
	type AuthAdapter,
	type AuthContext,
	type AuthCreateContext,
	type AuthProvider,
	CMS_AUTH_BASE_PATH,
	type CmsAuth,
	type CmsServerConfig,
	type DatabaseAdapter,
	defineServerConfig,
	type MediaAdapter,
} from "./define";
