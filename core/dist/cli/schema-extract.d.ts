import type { CmsConfig } from "../config/define.js";
import type { SchemaFile } from "../schema-file/types.js";
/**
 * Where a site keeps its config, in the order `monti schema:extract` looks for it: `monti.config.ts` (a config whose data is still written in code), then the
 * site config file of the earlier setup (`cms.config.ts`, a default export of `defineSite` from `@monti-cms/core`).
 */
export declare const CONFIG_FILE_CANDIDATES: readonly ["monti.config.ts", "src/monti.config.ts", "cms.config.ts", "src/cms.config.ts"];
/** What stays in the config file, because it needs code (or differs per environment). */
export interface StaysInCode {
    /** The part of the config (`plugins`, `blocks`, `site.url`, ...). */
    readonly what: string;
    /** Why, and what is in it. */
    readonly detail: string;
}
export interface ExtractedSchema {
    readonly schema: SchemaFile;
    readonly stays: readonly StaysInCode[];
}
/**
 * Takes the plain-data part of a config: collections (with the labels the admin shows, in the admin language), locales, default locale, time zone, site settings
 * (except `url`, which differs per environment), admin path, language and text overrides, and seed templates. Everything that needs code is left out and listed in `stays`.
 * A plugin's fields are already in the collections (`seoFields()` made them), so they are data like the rest; the plugin itself stays in code.
 */
export declare function extractSchemaData(config: CmsConfig, options?: {
    readonly locale?: string;
}): ExtractedSchema;
/** The text of a schema file: the link to the JSON Schema first, then the data, indented with tabs. */
export declare const schemaFileText: (schema: SchemaFile, link?: string) => string;
export interface ExtractOptions {
    readonly cwd: string;
    /** Config file to read (relative to `cwd`). Default: `monti.config.ts`, then `cms.config.ts` (each also under `src/`). */
    readonly config?: string;
    /** Schema file to write (relative to `cwd`). Default: `monti.schema.json` next to the config file. */
    readonly out?: string;
    /** Replace the schema file if it exists. */
    readonly overwrite?: boolean;
    /** Also write the declaration file (default true). */
    readonly types?: boolean;
    /** Language the labels that plugins provide in the admin language (the SEO fields) are written in. Default: the admin language of the site. */
    readonly locale?: string;
    /** Loads the config module (absolute path). Default: `import()`, which runs TypeScript through tsx when the `monti` command registered it. Tests pass their own. */
    readonly load?: (file: string) => Promise<{
        readonly default?: unknown;
        readonly config?: unknown;
        readonly cms?: unknown;
    }>;
}
export interface ExtractReport {
    readonly config: string;
    /** The schema file written, relative to `cwd`. */
    readonly schema: string;
    /** The declaration file written, relative to `cwd`. */
    readonly types?: string;
    readonly collections: number;
    readonly locales: number;
    readonly templates: number;
    readonly stays: readonly StaysInCode[];
}
/**
 * `monti schema:extract`: loads the site's config file (TypeScript is read by tsx, which `bin/monti.mjs` registers), writes its data part to `monti.schema.json`
 * and the types of that file, and reports what stays in code. It reads the site config as the default export (`defineSite` of `@monti-cms/core`) or, for
 * `monti.config.ts`, from the `cms` it exports. It never changes the config file; the report shows how to load the schema from it.
 */
export declare function extractSchema(options: ExtractOptions): Promise<ExtractReport>;
/** Turns the report into human-readable text, ending with the slim config to put in the config file. */
export declare function formatExtractReport(report: ExtractReport): string;
