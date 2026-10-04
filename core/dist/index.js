/**
 * Authoring API. Entry point imported by the site config file (`cms.config.ts`).
 *
 * Modules exported here must not import the site config (`config/resolved.ts`). The config file imports this entry point,
 * so that would create a cycle and the config would be read half-built.
 */
export { DEFAULT_CODE_LINE_EFFECTS, } from "./annotation/code-block/line-effects.js";
export { defineBlock } from "./blocks/define.js";
export { defineConfig, } from "./config/define.js";
export { createActiveTranslator } from "./i18n/active.js";
export { defineMessages, josa, translate, } from "./i18n/define.js";
export { assertPluginNamesFree, assertPluginPagesFree, assertPluginRoutesFree, CORE_ADMIN_PAGES, CORE_FEATURE_KEYS, } from "./plugin/collisions.js";
export { definePlugin, } from "./plugin/define.js";
export { defineCollection, SYSTEM_LIST_COLUMNS, } from "./schema/collection.js";
export { fields, SUMMARY_ROLE, } from "./schema/fields.js";
export { fieldWithRole, valueFieldsOf, valueWithRole } from "./schema/walk.js";
// Entry validator contract (also used by extensions the config file reads, so it must not read the site config).
export * from "./text-check/normalize.js";
export * from "./text-check/remote.js";
export * from "./text-check/types.js";
