/**
 * Next.js adapter of the CMS: the route handler for the admin API. The other pieces are separate entry points so each loads only what it needs:
 * `@monti-cms/nextjs/config` (`withCms` for `next.config.ts`), `@monti-cms/nextjs/admin` (admin layout and page) and `@monti-cms/nextjs/auth` (`githubAuth`).
 */
export { type CmsRouteHandler, createRouteHandler } from "./route-handler";
