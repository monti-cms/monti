import { runAdminRoute, runPublicRoute } from "./http/v1/handler.js";
export * from "./adapters/postgres/__test__/test-database.js";
export { createContentStore, migrateContentStore } from "./adapters/postgres/content-store.js";
export { CONTENT_STORE_MIGRATIONS } from "./adapters/postgres/migrations/index.js";
export { createPluginStorage as pluginStorageFor } from "./adapters/postgres/plugin-storage.js";
export { testServer } from "./adapters/postgres/test-server.js";
export { fakeCms } from "./cms/index.js";
export { documentText, EXCERPT_TEXT, SEARCH_TEXT } from "./core/body-text.js";
export { computeContentHash } from "./core/content-hash.js";
export * from "./core/store/__test__/seed.js";
export { matchRoute } from "./http/router.js";
export { createMemoryPluginStorage } from "./plugin/memory-storage.js";
export { serverSideOf } from "./plugin/server.js";
export { createSecretsVault } from "./secrets/index.js";
export { createContentService } from "./services/content-service.js";
/**
 * Calls a route handler the way the router does: for an admin route the same-origin and admin checks run first, then the handler gets `{ request, params, auth, cms }`.
 * `callRoute(GET, { request, cms })`, `params` for a route with `[id]`.
 */
export const callRoute = (handler, call) => runAdminRoute(call.cms, call.request, call.params ?? {}, handler);
/** `callRoute` for a handler of a `public: true` route: no checks, only the error frame. */
export const callPublicRoute = (handler, call) => runPublicRoute(call.cms, call.request, call.params ?? {}, handler);
/**
 * `callRoute` for a test that calls one handler many times: `const getEntry = routeCaller(GET)`, then `getEntry(request, { cms, params })`. The context takes `params`
 * as a value or as a promise.
 */
export const routeCaller = (handler) => async (request, context) => callRoute(handler, { request, cms: context.cms, params: await context.params });
/** `routeCaller` for the handler of a `public: true` route. */
export const publicRouteCaller = (handler) => async (request, context) => callPublicRoute(handler, { request, cms: context.cms, params: await context.params });
