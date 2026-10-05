/**
 * Entry point used by screens (admin, custom screens, public pages). Request/response shapes of the admin API plus helpers built from the site config:
 * collections, locales, URLs, blocks and schemas. It contains no server-only code (DB, secrets).
 */

export * from "./blocks/active";
export * from "./blocks/define";
export * from "./blocks/definitions";
export * from "./blocks/derive";
export * from "./config/resolved";
export * from "./core/admin-paths";
export * from "./core/api";
export * from "./core/collections";
export * from "./core/file-display";
export * from "./core/ids";
export * from "./core/links";
export * from "./core/locales";
export * from "./core/plain-text";
export * from "./core/slug";
export * from "./core/time";
export * from "./core/translation/hints";
export * from "./core/translation/skeleton";
export * from "./core/translation/source-diff";
export * from "./core/translation/state";
export * from "./core/types";
export * from "./i18n";
export type { StoredDocument } from "./mdx/stored-document";
export { getPluginOptions } from "./plugin/options";
export * from "./schema/collection";
export * from "./schema/derive";
export * from "./schema/fields";
export * from "./schema/walk";
export * from "./text-check/normalize";
export * from "./text-check/remote";
export * from "./text-check/types";
