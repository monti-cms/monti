/**
 * 서버 설정 저작 API. 서버 설정 파일(`cms.server.ts`)이 import하는 진입점이다.
 * 여기서 내보내는 모듈은 서버 설정(`server/resolved.ts`)·`container.ts`를 import하면 안 된다(순환).
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
