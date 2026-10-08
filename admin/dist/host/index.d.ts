/**
 * What a framework package mounts the admin UI with (server components): the layout, the page that picks the screen, and the two things the
 * admin asks of the framework: a router (`AdminRouterProvider`, from `@monti-cms/admin/router`) and a server (`AdminServer`: redirect and 404).
 * `@monti-cms/nextjs/admin` is the Next.js App Router package built on it; a site on Next.js imports that, not this.
 */
export { AdminLayout, type AdminLayoutProps, adminMetadata } from "./layout.js";
export { AdminPage, type AdminPageProps } from "./page.js";
export type { AdminServer } from "./server.js";
