/**
 * Entry point that works in the browser and on the server: request/response shapes of the admin API, the data shapes the stores return
 * (`Entry`, `Folder`, `ListEntriesItem`, ...), and helpers built from the site config (collections, locales, URLs, blocks, schemas).
 * It contains no server-only code (DB, secrets), so screens, custom pages and "use client" files may import it.
 */
export * from "./blocks/active.js";
export { RESERVED_BLOCK_ATTRIBUTES } from "./blocks/define.js";
export * from "./blocks/definitions.js";
export * from "./blocks/derive.js";
export * from "./config/check/collections.js";
export * from "./config/check/fields.js";
export { DEFAULT_ADMIN_PATH, HOST_PATTERN, isAdminPath, isHomeHref, isHttpUrl, isLocalUrl, isTimeZone, LOCALE_CODE, LOCALE_PREFIX_MODES, languageName, NAME_PATTERN, OPTION_VALUE_PATTERN, PREVIEW_PARAM_NAME, RESERVED_COLLECTION_NAMES, UUID_PATTERN, UUID_SOURCE, } from "./config/rules.js";
export * from "./core/admin-features.js";
export * from "./core/admin-paths.js";
export { LIST_SORT_FIELDS, PAGE_SIZES } from "./core/api.js";
export { apiKeyChoiceSchema } from "./core/api-keys.js";
export { documentText, EXCERPT_TEXT, SEARCH_TEXT } from "./core/body-text.js";
export * from "./core/collections.js";
export { canTransition } from "./core/domain/lifecycle.js";
export * from "./core/file-display.js";
export * from "./core/ids.js";
export { issueMessages, issueText, tellIssues, } from "./core/issue-text.js";
export * from "./core/links.js";
export * from "./core/locales.js";
export * from "./core/path-pattern.js";
export * from "./core/plain-text.js";
export * from "./core/plural.js";
export * from "./core/slug.js";
export * from "./core/time.js";
export * from "./core/translation/hints.js";
export * from "./core/translation/skeleton.js";
export * from "./core/translation/source-diff.js";
export * from "./core/translation/state.js";
export { readReferenceOccurrence, readReferenceOccurrences, ServiceError } from "./core/types.js";
export { createI18n, createTranslator, fillVars, josa, languageOf } from "./i18n/index.js";
export * from "./schema/allowed.js";
export { kindDefaults, normalizeCollection } from "./schema/collection.js";
export * from "./schema/derive.js";
export { FIELD_SETS_CONTRIBUTION, fieldSetsOf, freshSetFields, hasFieldSet } from "./schema/field-sets.js";
export { DEFAULT_TITLE_FIELD, FILL_FROM_BODY_MAX_LENGTH, fieldTraits, fillFromBodyLength, isRequiredField, isStoredField, RECORD_TRANSLATIONS_KEY, RESERVED_METADATA_KEYS, storageTypeOf, } from "./schema/fields.js";
export { checkPlacements, createPanel, DEFAULT_TAB, isPanelField, LAYOUT_CONTRIBUTION, panelGroupsOf, panelTabOf, panelTabsOf, placementsOf, } from "./schema/layout.js";
export * from "./schema/walk.js";
export * from "./site/index.js";
