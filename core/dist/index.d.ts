/**
 * Authoring API. Entry point imported by the site config file (`cms.config.ts`).
 *
 * Modules exported here must not import the site config (`config/resolved.ts`). The config file imports this entry point,
 * so that would create a cycle and the config would be read half-built.
 */
export { type CodeBlockConfig, type CodeLineEffectDefinition, type CodeLineEffectEditor, DEFAULT_CODE_LINE_EFFECTS, } from "./annotation/code-block/line-effects.js";
export type { BlockAttribute, BlockChildren, BlockDefinition, BlockEditor, BlockInsert, BlockSyntax, } from "./blocks/define.js";
export { defineBlock } from "./blocks/define.js";
export { type AdminConfig, type CmsConfig, type CollectionsConfig, defineConfig, type LocaleConfig, type LocalePrefixMode, type SeedConfig, type SeedTemplate, type SiteConfig, } from "./config/define.js";
export { createActiveTranslator } from "./i18n/active.js";
export { defineMessages, josa, type MessageBundle, type MessageDict, type MessageValue, type MessageVars, translate, } from "./i18n/define.js";
export { assertPluginNamesFree, assertPluginPagesFree, assertPluginRoutesFree, CORE_ADMIN_PAGES, CORE_FEATURE_KEYS, } from "./plugin/collisions.js";
export { type CmsPlugin, type CmsServerPlugin, definePlugin, type PluginConfigView, type PluginDatabase, type PluginNamed, type PluginNavItem, type PluginRoute, } from "./plugin/define.js";
export { type CollectionSchema, type CollectionWorkflow, defineCollection, type LayoutGroup, type MetadataOf, SYSTEM_LIST_COLUMNS, type SystemListColumn, } from "./schema/collection.js";
export { type BacklinkField, type ConditionalField, type Field, type FieldKind, type FieldRole, fields, type Localized, type MediaField, type RelationField, type SelectField, type SlugField, SUMMARY_ROLE, type TextField, type ValueField, type ViewField, } from "./schema/fields.js";
export { fieldWithRole, type StoredField, valueFieldsOf, valueWithRole } from "./schema/walk.js";
export * from "./text-check/normalize.js";
export * from "./text-check/remote.js";
export * from "./text-check/types.js";
