/**
 * Entry point that attaches the admin UI to a Next app (server component).
 *
 * ```tsx
 * // app/(admin)/admin/layout.tsx
 * import "../../globals.css";
 * export { CmsAdminLayout as default, cmsAdminMetadata as metadata } from "@monti-cms/admin/next";
 *
 * // app/(admin)/admin/[[...path]]/page.tsx
 * export { CmsAdminPage as default } from "@monti-cms/admin/next";
 * ```
 */
export { CmsAdminLayout, cmsAdminMetadata } from "./layout.js";
export { CmsAdminPage } from "./page.js";
