/** Test helpers: isolated-schema DB, sample data, sample content and API handlers. Use only in app and plugin tests. */
import type { Cms } from "./cms/index.js";
import { type AdminHandler, type PublicHandler } from "./http/v1/handler.js";
export * from "./adapters/postgres/__test__/test-database.js";
export { createContentStore, migrateContentStore } from "./adapters/postgres/content-store.js";
export { CONTENT_STORE_MIGRATIONS } from "./adapters/postgres/migrations/index.js";
export { createPluginStorage as pluginStorageFor } from "./adapters/postgres/plugin-storage.js";
export { type TestServer, testServer } from "./adapters/postgres/test-server.js";
export { type FakeCmsParts, fakeCms } from "./cms/index.js";
export { type BodyTextOptions, documentText, EXCERPT_TEXT, SEARCH_TEXT } from "./core/body-text.js";
export type { Collection } from "./core/collections.js";
export { computeContentHash } from "./core/content-hash.js";
export type { Entry } from "./core/store/index.js";
export * from "./core/store/__test__/seed.js";
export type { JsonValue } from "./core/types.js";
export { matchRoute } from "./http/router.js";
export { createMemoryPluginStorage, type MemoryPluginStorage } from "./plugin/memory-storage.js";
export { serverSideOf } from "./plugin/server.js";
export { createSecretsVault } from "./secrets/index.js";
export { createContentService } from "./services/content-service.js";
/**
 * Calls a route handler the way the router does: for an admin route the same-origin and admin checks run first, then the handler gets `{ request, params, auth, cms }`.
 * `callRoute(GET, { request, cms })`, `params` for a route with `[id]`.
 */
export declare const callRoute: <P extends Record<string, string> = Record<string, string>>(handler: AdminHandler<P>, call: {
    readonly request: Request;
    readonly cms: Cms;
    readonly params?: P;
}) => Promise<Response>;
/** `callRoute` for a handler of a `public: true` route: no checks, only the error frame. */
export declare const callPublicRoute: <P extends Record<string, string> = Record<string, string>>(handler: PublicHandler<P>, call: {
    readonly request: Request;
    readonly cms: Cms;
    readonly params?: P;
}) => Promise<Response>;
/**
 * `callRoute` for a test that calls one handler many times: `const getEntry = routeCaller(GET)`, then `getEntry(request, { cms, params })`. The context takes `params`
 * as a value or as a promise.
 */
export declare const routeCaller: <P extends Record<string, string> = Record<string, string>>(handler: AdminHandler<P>) => (request: Request, context: {
    readonly cms: Cms;
    readonly params?: P | Promise<P>;
}) => Promise<Response>;
/** `routeCaller` for the handler of a `public: true` route. */
export declare const publicRouteCaller: <P extends Record<string, string> = Record<string, string>>(handler: PublicHandler<P>) => (request: Request, context: {
    readonly cms: Cms;
    readonly params?: P | Promise<P>;
}) => Promise<Response>;
