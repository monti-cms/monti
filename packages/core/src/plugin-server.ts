/**
 * Server-side entry point for plugins. Used by plugin API routes, stores and migrations (core route scaffolding, DB connection, errors).
 * Do not import from browser code.
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
} from "./services/hooks";

export * from "./text-check/route";
