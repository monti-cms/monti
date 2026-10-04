/**
 * Server config authoring API. The entry point imported by the server config file (`cms.server.ts`).
 * Modules exported here must not import the server config (`server/resolved.ts`) or `container.ts` (cycle).
 */
export { type GithubAuthOptions, githubAuth } from "../adapters/auth/github.js";
export { type PostgresOptions, postgres } from "../adapters/postgres/adapter.js";
export type { AfterCommit, ContentChange, ContentChangeKind } from "../adapters/postgres/store/after-commit.js";
export type { AllowedMediaMime, MediaStore, PrepareUploadInput, PrepareUploadOutput, PromoteFileInput, StoredFileHead, } from "../adapters/r2/types.js";
export { defaultPublicJson, type PublicApiOptions } from "../http/v1/public/options.js";
export { type AuthAdapter, type AuthContext, type AuthCreateContext, type AuthProvider, CMS_AUTH_BASE_PATH, type CmsAuth, type CmsServerConfig, type DatabaseAdapter, defineServerConfig, type MediaAdapter, } from "./define.js";
