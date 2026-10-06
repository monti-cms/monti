/**
 * Server config authoring API. The entry point imported by the server config file (`cms.server.ts`).
 * Modules exported here must not import the server config (`server/resolved.ts`) or `container.ts` (cycle).
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
