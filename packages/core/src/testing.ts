/** Test helpers: isolated-schema DB, sample data, sample content and API handlers. Use only in app and plugin tests. */
import type { Cms } from "./cms";
import { type AdminHandler, type PublicHandler, runAdminRoute, runPublicRoute } from "./http/v1/handler";

export * from "./adapters/postgres/__test__/test-database";
export { createContentStore, migrateContentStore } from "./adapters/postgres/content-store";
export { CONTENT_STORE_MIGRATIONS } from "./adapters/postgres/migrations";
export { createPluginStorage as pluginStorageFor } from "./adapters/postgres/plugin-storage";
export { type TestServer, testServer } from "./adapters/postgres/test-server";
export { type FakeCmsParts, fakeCms } from "./cms";
export { type BodyTextOptions, documentText, EXCERPT_TEXT, SEARCH_TEXT } from "./core/body-text";
export type { Collection } from "./core/collections";
export { computeContentHash } from "./core/content-hash";
export type { Entry } from "./core/store";
export * from "./core/store/__test__/seed";
export type { JsonValue } from "./core/types";
export { matchRoute } from "./http/router";
export { createMemoryPluginStorage, type MemoryPluginStorage } from "./plugin/memory-storage";
export { serverSideOf } from "./plugin/server";
export { createSecretsVault } from "./secrets";
export { createContentService } from "./services/content-service";

/**
 * Calls a route handler the way the router does: for an admin route the same-origin and admin checks run first, then the handler gets `{ request, params, auth, cms }`.
 * `callRoute(GET, { request, cms })`, `params` for a route with `[id]`.
 */
export const callRoute = <P extends Record<string, string> = Record<string, string>>(
	handler: AdminHandler<P>,
	call: { readonly request: Request; readonly cms: Cms; readonly params?: P },
): Promise<Response> => runAdminRoute(call.cms, call.request, call.params ?? ({} as P), handler);

/** `callRoute` for a handler of a `public: true` route: no checks, only the error frame. */
export const callPublicRoute = <P extends Record<string, string> = Record<string, string>>(
	handler: PublicHandler<P>,
	call: { readonly request: Request; readonly cms: Cms; readonly params?: P },
): Promise<Response> => runPublicRoute(call.cms, call.request, call.params ?? ({} as P), handler);

/**
 * `callRoute` for a test that calls one handler many times: `const getEntry = routeCaller(GET)`, then `getEntry(request, { cms, params })`. The context takes `params`
 * as a value or as a promise.
 */
export const routeCaller =
	<P extends Record<string, string> = Record<string, string>>(handler: AdminHandler<P>) =>
	async (request: Request, context: { readonly cms: Cms; readonly params?: P | Promise<P> }): Promise<Response> =>
		callRoute(handler, { request, cms: context.cms, params: await context.params });

/** `routeCaller` for the handler of a `public: true` route. */
export const publicRouteCaller =
	<P extends Record<string, string> = Record<string, string>>(handler: PublicHandler<P>) =>
	async (request: Request, context: { readonly cms: Cms; readonly params?: P | Promise<P> }): Promise<Response> =>
		callPublicRoute(handler, { request, cms: context.cms, params: await context.params });
