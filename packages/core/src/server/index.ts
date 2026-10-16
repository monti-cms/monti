/**
 * Server-only entry point. Never import it from browser code (`@monti-cms/core/site` is the entry point that works in both).
 * It has what `monti.config.ts` needs (`defineConfig`, the `postgres` adapter and the server config types) and what server code
 * needs to work with the CMS instance: the `Cms` type, store ports, services, events, hooks, login types and snapshot helpers. It does not use
 * `server-only`, so it can also be loaded outside Next (cron scripts, site tests). The login method (`auth`) comes from `@monti-cms/auth`; the gateway, its errors and the checks routes run are in `@monti-cms/core/adapters/auth`.
 */

// Config file: the instance and its options.
export { type PostgresOptions, postgres } from "../adapters/postgres/adapter";
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
export type {
	AfterCommit,
	AppliedSchemaChange,
	ApplySchemaChangeParams,
	BodyCursor,
	ClaimedDelivery,
	ContentChange,
	ContentChangeKind,
	ContentEvent,
	ContentStore,
	DeferredDelivery,
	EntryStore,
	EventDelivery,
	EventDeliveryCounts,
	EventDeliveryState,
	EventLogState,
	EventStore,
	FolderStore,
	LifecycleStore,
	ListStore,
	MediaMetadataStore,
	MutableJsonValue,
	PreferenceStore,
	PublicReadStore,
	RewrittenBody,
	ScannedBody,
	SchemaChangeStore,
	SchemaState,
	TemplateStore,
	TransferStore,
} from "../core/store";
// Stores: ports, errors, events, schema-change types and the data shapes (also exported from `@monti-cms/core/site`).
export {
	CONTENT_CHANGE_KINDS,
	DEFAULT_ENTRY_SEARCH_LIMIT,
	DeferDelivery,
	eventRowOf,
	isDeferred,
	MAX_ENTRY_SEARCH_LIMIT,
	withEventDispatch,
} from "../core/store";
export { defaultPublicJson, type PublicApiOptions } from "../http/v1/public/options";
export type {
	MediaStore,
	PrepareUploadInput,
	PrepareUploadOutput,
	PromoteFileInput,
	StoredFileHead,
} from "../media/store";
export { ALLOWED_MEDIA_MIMES } from "../media/store";

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
export { defineConfig, type MontiServerOptions, SECRET_ENV, SITE_URL_ENV } from "./config";
export { type Decision, formatDecision } from "./decision";
export {
	type AuthAdapter,
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
