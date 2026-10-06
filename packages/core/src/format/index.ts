/**
 * Formats: notations a stored document can be written as and read from (`@monti-cms/core/format`).
 *
 * A plugin provides formats with `CmsPlugin.formats`; a site picks one with the `format` option of the read and write APIs. This entry point is light on
 * purpose (types, `defineFormat` and the registry): it does not read the site config, so a plugin may import it wherever it is loaded.
 */
export type { FormatRegistry } from "./registry";
export { createFormatRegistry, NO_FORMATS } from "./registry";
export type {
	BlockCatalog,
	CmsFormat,
	FormatContext,
	FormatExportContext,
	FormatImportContext,
	FormatImportResult,
	FormatInfo,
	FormatIssue,
	FormatLink,
	FormatMedia,
	FormatPurpose,
	LegacyBodies,
} from "./types";
export { assertFormatName, defineFormat } from "./types";
