/**
 * Authoring API. Entry point imported by the site config file (`cms.config.ts`).
 *
 * Modules exported here import no `Site`, no instance and no server code: the config file imports this entry point, and it runs before any site exists.
 * What a config needs to know about a site (`createSite`, `SiteProvider`) is in `@monti-cms/core/site`.
 */
export type { BlockAttribute, BlockChildren, BlockDefinition, BlockEditing, BlockInsert, BlockIssue, BlockNode, BlockSyntax, BlockValidate, BlockValidateContext, } from "./blocks/define.js";
export { defineBlock } from "./blocks/define.js";
export { ConfigError, type ConfigIssue, configError, IssueList, pathOf } from "./config/check/issue.js";
export { type AdminConfig, type CmsConfig, type CollectionsConfig, defineSite, type EditorConfig, type EditorWidthStep, type LocaleConfig, type LocalePrefixMode, type SchemaCmsConfig, type SeedConfig, type SeedTemplate, type SiteConfig, } from "./config/define.js";
export { describeNodeEnv, type EnvSource, envValue, WHERE_TO_SET_ENV } from "./core/env.js";
export { type Problem, problemError, problemText, SetupError } from "./core/problem.js";
export { createActiveTranslator } from "./i18n/active.js";
export { defineMessages, type MessageBundle, type MessageDict, type MessageValue, type MessageVars, translate, } from "./i18n/define.js";
export { type AdminPluginShape, definePlugin, emptyServerPlugin, type Plugin, type PluginCommand, type PluginCommandContext, type PluginCommandOption, type PluginConfigView, type PluginContributions, type PluginId, type PluginKeySlot, type PluginLabel, type PluginNamed, type PluginNavItem, type PluginRoute, type ServerPlugin, } from "./plugin/define.js";
export { type CollectionSchema, defineCollection, type LayoutGroup, type MetadataOf, } from "./schema/collection.js";
export type { PluginFieldSet } from "./schema/field-sets.js";
export { type BacklinkField, type ConditionalField, type Field, type FieldKind, type FieldRole, fields, type Localized, type MediaField, type RelationField, type SelectField, type SlugField, SUMMARY_ROLE, type TextField, TITLE_ROLE, type ValueField, type ViewField, } from "./schema/fields.js";
export type { PluginPlacement } from "./schema/layout.js";
export { defineSchema } from "./schema-file/define.js";
export { parseSchemaFile } from "./schema-file/format.js";
export type { SchemaAdmin, SchemaCollection, SchemaFile, SchemaMigration, SchemaTypes, } from "./schema-file/types.js";
export * from "./text-check/normalize.js";
export * from "./text-check/remote.js";
export * from "./text-check/types.js";
