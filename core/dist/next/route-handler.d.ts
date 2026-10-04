/**
 * Admin API handler (server only). Used in the app's `app/api/cms/[...path]/route.ts`.
 *
 * ```ts
 * export const { GET, POST, PATCH, PUT, DELETE } = createCmsRouteHandler();
 * ```
 *
 * Why it is separate from `@monti-cms/core/next`, which `next.config.ts` reads: this handler reads the server config (`@cms-server`),
 * so it must not be loaded while Next reads its config file.
 */
export { CMS_ROUTE_PATTERNS, createCmsRouteHandler } from "../http/router.js";
