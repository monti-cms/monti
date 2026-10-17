/** Test helpers: isolated-schema DB, sample data, sample content, API handlers and the low-level `createCms`. Use only in app and plugin tests. */
import type { Cms } from "./cms/index.js";
import { type AdminHandler, type BearerHandler, type PublicHandler, type RouteAccess } from "./http/v1/handler.js";
export * from "./adapters/postgres/__test__/test-database.js";
export { createContentStore, migrateContentStore } from "./adapters/postgres/content-store.js";
export { CONTENT_STORE_MIGRATIONS } from "./adapters/postgres/migrations/index.js";
export { createPluginStorage as pluginStorageFor } from "./adapters/postgres/plugin-storage.js";
export { type TestServer, testServer } from "./adapters/postgres/test-server.js";
export { type CreateCmsOptions, createCms, type FakeCmsParts, fakeCms } from "./cms/index.js";
export { computeContentHash } from "./core/content-hash.js";
export * from "./core/store/__test__/seed.js";
export { matchRoute } from "./http/router.js";
export { createMemoryPluginStorage, type MemoryPluginStorage } from "./plugin/memory-storage.js";
export { serverSideOf } from "./plugin/server.js";
export { createSecretsVault } from "./secrets/index.js";
export { createContentService } from "./services/content-service.js";
type AnyHandler<P extends Record<string, string>> = AdminHandler<P> | PublicHandler<P> | BearerHandler<P>;
/**
 * Calls a route handler the way the router does: the guard of its `access` kind (`admin` unless given) runs first, then the handler gets `{ request, params, auth, cms, plugin }`.
 * `callRoute(GET, { request, cms })`, `params` for a route with `[id]`, `access` for a route that is not `admin`, `plugin` (its name) for a plugin's route.
 */
export declare const callRoute: <P extends Record<string, string> = Record<string, string>>(handler: AnyHandler<P>, call: {
    readonly request: Request;
    readonly cms: Cms;
    readonly params?: P;
    readonly access?: RouteAccess;
    readonly plugin?: string;
}) => Promise<Response>;
/**
 * `callRoute` for a test that calls one handler many times: `const getEntry = routeCaller(GET)`, then `getEntry(request, { cms, params })`. The context takes `params`
 * as a value or as a promise. Give the `access` kind of a route that is not `admin`: `routeCaller(POST, "same-origin-form")`, and the plugin of a plugin's route:
 * `routeCaller(GET, { plugin: "ai" })` (or both: `routeCaller(POST, { access: "signed", plugin: "git-sync" })`).
 */
export declare const routeCaller: <P extends Record<string, string> = Record<string, string>>(handler: AnyHandler<P>, route?: RouteAccess | {
    readonly access?: RouteAccess;
    readonly plugin?: string;
}) => (request: Request, context: {
    readonly cms: Cms;
    readonly params?: P | Promise<P>;
}) => Promise<Response>;
