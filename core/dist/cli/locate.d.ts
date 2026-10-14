import { SCHEMA_FILE_CANDIDATES } from "../schema-file/locate.js";
/** Candidate locations of the config file, the module that exports the CMS instance as `cms`. */
export declare const CONFIG_CANDIDATES: readonly ["monti.config.ts", "src/monti.config.ts"];
/**
 * Location of the config file (`monti.config.ts`, the module that exports the CMS instance as `cms`). Looked up in this order: the chosen value
 * (`--config`) -> the `MONTI_CONFIG_PATH` environment variable -> common locations (`./monti.config.ts`, `./src/monti.config.ts`).
 */
export declare function locateConfig(cwd: string, chosen?: string | undefined, env?: Record<string, string | undefined>): string;
/**
 * Where a site keeps the config `monti schema:extract` reads, in the order it looks: `monti.config.ts` (a config whose data is still written in code), then the
 * site config file of the earlier setup (`cms.config.ts`, a default export of `defineSite` from `@monti-cms/core`).
 */
export declare const EXTRACT_CONFIG_CANDIDATES: readonly ["monti.config.ts", "src/monti.config.ts", "cms.config.ts", "src/cms.config.ts"];
/** The config file `monti schema:extract` reads: the chosen path (`--config`), else the first of {@link EXTRACT_CONFIG_CANDIDATES}. */
export declare function locateExtractConfig(cwd: string, chosen?: string): string;
/** The schema file of a site: the chosen path (`--schema`), else the first of {@link SCHEMA_FILE_CANDIDATES}. The lookup itself lives with the schema file format. */
export declare const locateSchema: (cwd: string, chosen?: string) => string;
export { SCHEMA_FILE_CANDIDATES };
