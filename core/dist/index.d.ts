/**
 * Authoring API. Entry point imported by the site config file (`cms.config.ts`).
 *
 * Modules exported here import no `Site`, no instance and no server code: the config file imports this entry point, and it runs before any site exists.
 * What a config needs to know about a site (`createSite`, `SiteProvider`) is in `@monti-cms/core/client`.
 */
export { type CodeBlockConfig, type CodeBlockFeatures, type CodeBlockThemes, type CodeLineEffectDefinition, type CodeLineEffectEditor, DEFAULT_CODE_LINE_EFFECTS, } from "./annotation/code-block/line-effects.js";
export type { BlockAttribute, BlockChildren, BlockDefinition, BlockEditor, BlockInsert, BlockIssue, BlockNode, BlockSyntax, BlockValidate, BlockValidateContext, } from "./blocks/define.js";
export { defineBlock } from "./blocks/define.js";
export { ConfigError, configError, type Issue, IssueList, pathOf } from "./config/check/issue.js";
export { type AdminConfig, type CmsConfig, type CollectionsConfig, defineSite, type EditorConfig, type EditorWidthStep, type LocaleConfig, type LocalePrefixMode, type SchemaCmsConfig, type SeedConfig, type SeedTemplate, type SiteConfig, } from "./config/define.js";
export { describeNodeEnv, type EnvSource, envValue, WHERE_TO_SET_ENV } from "./core/env.js";
export { type Problem, problemError, problemText, SetupError } from "./core/problem.js";
export { createActiveTranslator } from "./i18n/active.js";
export { defineMessages, type MessageBundle, type MessageDict, type MessageValue, type MessageVars, translate, } from "./i18n/define.js";
export { assertPluginNamesFree, assertPluginPagesFree, assertPluginRoutesFree, CORE_FEATURE_KEYS, checkPluginNames, checkPluginPages, checkPluginRoutes, RESERVED_SCOPES, } from "./plugin/collisions.js";
export { type CmsPlugin, type CmsServerPlugin, definePlugin, emptyServerPlugin, type PluginCommand, type PluginCommandContext, type PluginCommandOption, type PluginConfigView, type PluginKeySlot, type PluginLabel, type PluginNamed, type PluginNavItem, type PluginRoute, type PluginServer, } from "./plugin/define.js";
export { type PluginLog, pluginError, pluginLog } from "./plugin/log.js";
export type { PluginCollection, PluginMigration, PluginStorage, StorageItem, StorageWriteOptions, } from "./plugin/storage.js";
export { type CollectionSchema, defineCollection, type LayoutGroup, type MetadataOf, } from "./schema/collection.js";
export type { PluginFieldSet } from "./schema/field-sets.js";
export { type BacklinkField, type ConditionalField, type Field, type FieldKind, type FieldRole, fields, type Localized, type MediaField, type RelationField, type SelectField, type SlugField, SUMMARY_ROLE, type TextField, TITLE_ROLE, type ValueField, type ViewField, } from "./schema/fields.js";
export type { PluginPlacement } from "./schema/layout.js";
export { fieldWithRole, findTitleField, type StoredField, type TitleField, titleFieldOf, titleValue, valueFieldsOf, valueWithRole, } from "./schema/walk.js";
export { defineSchema } from "./schema-file/define.js";
export { parseSchemaFile } from "./schema-file/format.js";
export type { SchemaAdmin, SchemaCollection, SchemaFile, SchemaMigration, SchemaTypes, } from "./schema-file/types.js";
export * from "./text-check/normalize.js";
export * from "./text-check/remote.js";
export * from "./text-check/types.js";
