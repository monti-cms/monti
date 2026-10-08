import type { DiffOptions, SchemaChange, SchemaDiff, SchemaLike } from "./types.js";
/**
 * What changed between two schemas: collections, stored fields and select options added, removed or renamed, and fields whose type, required flag, language
 * handling or conditional branch changed, locales added or removed, and the allowed blocks, marks and heading levels of a body. Pure and read-only: nothing here
 * looks at stored entries (that is `checkSchemaChange`).
 *
 * Labels, help text, layout, list columns and the like are not data changes and are not listed. Collection and field names are stored values, so a rename is
 * not visible in two schemas: it shows as a removal and an addition (`renameHints` points out pairs that look alike). A `renameField` or `mapOption`
 * transform in `options.transforms` says it is a rename and turns the pair into one `field_renamed` or `option_renamed` change; any change a transform handles has its `handledBy`.
 */
export declare function diffSchema(oldSchema: SchemaLike, newSchema: SchemaLike, options?: DiffOptions): SchemaDiff;
/** A short English description of a change, for the command line and logs. A screen words its own. */
export declare function describeSchemaChange(change: SchemaChange): string;
