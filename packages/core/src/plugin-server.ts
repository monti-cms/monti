/**
 * 플러그인 서버 쪽 진입점. 플러그인의 API 경로·저장소·마이그레이션이 쓴다(본체 라우트 틀·DB 연결·오류).
 * 브라우저 코드에서 import하지 않는다.
 */

export { AuthError } from "./adapters/auth/auth-gateway";
export {
	type ContentLookup,
	createContentLookup,
	type SlugsInUseParams,
} from "./adapters/postgres/store/content-lookup";
export { withTransaction } from "./adapters/postgres/store/context";
export { CmsError } from "./adapters/postgres/store/errors";
export { getCmsContentStore, getCmsMediaStore, getCmsSecret } from "./container";
export { HttpError, handleApiError } from "./http/v1/error-handler";
export * from "./http/v1/handler";
export { getCmsDatabase, loadServerPlugins } from "./plugin/server";
export * from "./text-check/route";
