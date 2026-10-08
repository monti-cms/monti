/**
 * Authoring API. Entry point imported by the site config file (`cms.config.ts`).
 *
 * Modules exported here import no `Site`, no instance and no server code: the config file imports this entry point, and it runs before any site exists.
 * What a config needs to know about a site (`createSite`, `SiteProvider`) is in `@monti-cms/core/client`.
 */
export { DEFAULT_CODE_LINE_EFFECTS, } from "./annotation/code-block/line-effects.js";
export { defineBlock } from "./blocks/define.js";
export { defineSite, } from "./config/define.js";
export { problemError, problemText, SetupError } from "./core/problem.js";
export { createActiveTranslator } from "./i18n/active.js";
export { defineMessages, translate, } from "./i18n/define.js";
export { assertPluginNamesFree, assertPluginPagesFree, assertPluginRoutesFree, CORE_ADMIN_PAGES, CORE_FEATURE_KEYS, } from "./plugin/collisions.js";
export { definePlugin, } from "./plugin/define.js";
export { defineCollection, SYSTEM_LIST_COLUMNS, } from "./schema/collection.js";
export { fields, SUMMARY_ROLE, TITLE_ROLE, } from "./schema/fields.js";
export { fieldWithRole, findTitleField, titleFieldOf, titleValue, valueFieldsOf, valueWithRole, } from "./schema/walk.js";
export { parseSchemaFile, SchemaFileError } from "./schema-file/format.js";
// Entry validator contract (also used by extensions the config file reads, so it must not read the site config).
export * from "./text-check/normalize.js";
export * from "./text-check/remote.js";
export * from "./text-check/types.js";
