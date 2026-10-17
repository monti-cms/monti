import { runRoute, } from "./http/v1/handler.js";
export * from "./adapters/postgres/__test__/test-database.js";
export { createContentStore, migrateContentStore } from "./adapters/postgres/content-store.js";
export { CONTENT_STORE_MIGRATIONS } from "./adapters/postgres/migrations/index.js";
export { createPluginStorage as pluginStorageFor } from "./adapters/postgres/plugin-storage.js";
export { testServer } from "./adapters/postgres/test-server.js";
export { createCms, fakeCms } from "./cms/index.js";
export { computeContentHash } from "./core/content-hash.js";
export * from "./core/store/__test__/seed.js";
export { matchRoute } from "./http/router.js";
export { createMemoryPluginStorage } from "./plugin/memory-storage.js";
export { serverSideOf } from "./plugin/server.js";
export { createSecretsVault } from "./secrets/index.js";
export { createContentService } from "./services/content-service.js";
/**
 * Calls a route handler the way the router does: the guard of its `access` kind (`admin` unless given) runs first, then the handler gets `{ request, params, auth, cms, plugin }`.
 * `callRoute(GET, { request, cms })`, `params` for a route with `[id]`, `access` for a route that is not `admin`, `plugin` (its name) for a plugin's route.
 */
export const callRoute = (handler, call) => runRoute(call.cms, call.request, call.params ?? {}, handler, call.access, call.plugin ? call.cms.plugin(call.plugin) : undefined);
/**
 * `callRoute` for a test that calls one handler many times: `const getEntry = routeCaller(GET)`, then `getEntry(request, { cms, params })`. The context takes `params`
 * as a value or as a promise. Give the `access` kind of a route that is not `admin`: `routeCaller(POST, "same-origin-form")`, and the plugin of a plugin's route:
 * `routeCaller(GET, { plugin: "ai" })` (or both: `routeCaller(POST, { access: "signed", plugin: "git-sync" })`).
 */
export const routeCaller = (handler, route) => async (request, context) => {
    const { access, plugin } = typeof route === "string" ? { access: route, plugin: undefined } : (route ?? {});
    return callRoute(handler, { request, cms: context.cms, params: await context.params, access, plugin });
};
