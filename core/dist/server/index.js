/**
 * Server config authoring API. The entry point imported by the server config file (`cms.server.ts`).
 * Modules exported here must not import the server config (`server/resolved.ts`) or `container.ts` (cycle).
 */
export { githubAuth } from "../adapters/auth/github.js";
export { postgres } from "../adapters/postgres/adapter.js";
export { defaultPublicJson } from "../http/v1/public/options.js";
export { CMS_AUTH_BASE_PATH, defineServerConfig, } from "./define.js";
