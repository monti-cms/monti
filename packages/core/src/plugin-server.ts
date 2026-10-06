/**
 * Server-side entry point for plugins. Used by plugin API routes, stores and migrations (core route scaffolding, DB connection, errors).
 * A plugin route reads the CMS instance it is served by from its handler input (`adminRoute(async ({ cms }) => ...)`): `cms.store()`, `cms.mediaStore()`,
 * `cms.database()`, `cms.secrets(pluginName)`. Do not import from browser code.
 */

export { AuthError } from "./adapters/auth/auth-gateway";
export {
	type ContentLookup,
	createContentLookup,
	type SlugsInUseParams,
} from "./adapters/postgres/store/content-lookup";
export { withTransaction } from "./adapters/postgres/store/context";
export { CmsError } from "./adapters/postgres/store/errors";
export type { Cms } from "./cms";
export { HttpError, handleApiError } from "./http/v1/error-handler";
export * from "./http/v1/handler";
export type { LoadedServerPlugin } from "./plugin/server";
export type { LegacySecretFormat, PluginSecrets, PluginSecretsOptions } from "./secrets";
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
