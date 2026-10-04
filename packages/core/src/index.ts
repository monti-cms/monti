/**
 * 저작 API. 사이트 설정 파일(`cms.config.ts`)이 import하는 진입점이다.
 *
 * 여기서 내보내는 모듈은 사이트 설정(`config/resolved.ts`)을 import하면 안 된다. 설정 파일이 이 진입점을 import하므로
 * 순환이 생겨 설정이 반쯤 만들어진 채로 읽힌다.
 */

export {
	type CodeBlockConfig,
	type CodeLineEffectDefinition,
	type CodeLineEffectEditor,
	DEFAULT_CODE_LINE_EFFECTS,
} from "./annotation/code-block/line-effects";
export type {
	BlockAttribute,
	BlockChildren,
	BlockDefinition,
	BlockEditor,
	BlockInsert,
	BlockSyntax,
} from "./blocks/define";
export { defineBlock } from "./blocks/define";
export {
	type AdminConfig,
	type CmsConfig,
	type CollectionsConfig,
	defineConfig,
	type LocaleConfig,
	type LocalePrefixMode,
	type SeedConfig,
	type SeedTemplate,
	type SiteConfig,
} from "./config/define";
export { createActiveTranslator } from "./i18n/active";
export {
	defineMessages,
	josa,
	type MessageBundle,
	type MessageDict,
	type MessageValue,
	type MessageVars,
	translate,
} from "./i18n/define";
export {
	assertPluginNamesFree,
	assertPluginPagesFree,
	assertPluginRoutesFree,
	CORE_ADMIN_PAGES,
	CORE_FEATURE_KEYS,
} from "./plugin/collisions";
export {
	type CmsPlugin,
	type CmsServerPlugin,
	definePlugin,
	type PluginConfigView,
	type PluginDatabase,
	type PluginNamed,
	type PluginNavItem,
	type PluginRoute,
} from "./plugin/define";
export {
	type CollectionSchema,
	type CollectionWorkflow,
	defineCollection,
	type LayoutGroup,
	type MetadataOf,
	SYSTEM_LIST_COLUMNS,
	type SystemListColumn,
} from "./schema/collection";
export {
	type BacklinkField,
	type ConditionalField,
	type Field,
	type FieldKind,
	type FieldRole,
	fields,
	type Localized,
	type MediaField,
	type RelationField,
	type SelectField,
	type SlugField,
	SUMMARY_ROLE,
	type TextField,
	type ValueField,
	type ViewField,
} from "./schema/fields";
export { fieldWithRole, type StoredField, valueFieldsOf, valueWithRole } from "./schema/walk";
// 글 검사기 약속(설정 파일이 읽는 확장도 쓰므로 사이트 설정을 읽지 않는다).
export * from "./text-check/normalize";
export * from "./text-check/remote";
export * from "./text-check/types";
