/**
 * Server entry point imported by the app's server file (`cms.server.ts`): the server config authoring API (`defineServerConfig`, `postgres`, `githubAuth`)
 * and `createCms`, which turns the server config into the CMS instance the rest of the app uses.
 */

export { type GithubAuthOptions, githubAuth } from "../adapters/auth/github";
export { type PostgresOptions, postgres } from "../adapters/postgres/adapter";
export type { AfterCommit, ContentChange, ContentChangeKind } from "../adapters/postgres/store/after-commit";
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
	type CmsRouteHandler,
	type ContentService,
	type CreateCmsOptions,
	createCms,
	type PublicServerConfig,
} from "../cms";
export { defaultPublicJson, type PublicApiOptions } from "../http/v1/public/options";
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
