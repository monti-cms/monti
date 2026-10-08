/**
 * Next.js adapter of the CMS: the route handler for the admin API. The other pieces are separate entry points so each loads only what it needs:
 * `@monti-cms/nextjs/config` (`withCms` for `next.config.ts`), `@monti-cms/nextjs/admin` (admin layout and page) and `@monti-cms/nextjs/auth` (`nextHost`, the Next.js side of `@monti-cms/auth`).
 */
export { previewEntry } from "./preview.js";
export { createRouteHandler } from "./route-handler.js";
