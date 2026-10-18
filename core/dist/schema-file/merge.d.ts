import type { SiteConfig } from "../config/define.js";
/** The layers under the code config: what it is laid over (the environment's site URL, say). */
export interface ConfigDefaults {
    readonly site?: SiteConfig;
    /** Keys the caller reads itself (the server options), so a misspelt one is suggested the right name. */
    readonly alsoKnown?: readonly string[];
}
/** What `defineSite` takes next to `schema`: the code part of the config (anything the config has, except what the file owns). */
type CodeConfig = {
    readonly schema: unknown;
} & {
    readonly [key: string]: unknown;
};
export declare const isRecord: (value: unknown) => value is Record<string, unknown>;
/** The keys of `over` that are set (not `undefined`) laid over `base`: `site: { url: process.env.X || undefined }` keeps the file's `url`. */
export declare const overlay: <T extends object>(base: T | undefined, over: unknown) => T | undefined;
/** A config written in code only, with the lowest layer under its `site`. */
export declare const layerSite: (config: Record<string, unknown>, defaults: ConfigDefaults) => Record<string, unknown>;
/**
 * Merges the schema file into the code part of a config, and returns the config `defineSite` checks like any other. The rule is that code adds to the file
 * and may override its environment-specific settings, but never silently replaces its data:
 *
 * - `collections`: the file's collections and the code's, side by side. The same name in both is an error.
 * - `locales` and `defaultLocale`: only in the file (setting them in code too is an error).
 * - `site` and `admin`: key by key, the code's value wins. A key set to `undefined` in code leaves the file's value.
 * - `timeZone`: the code's value wins.
 * - `seed.templates`: the file's templates, then the code's.
 * - everything else (`plugins`, `blocks`, `codeBlock`, `media`): from code, the file has none of it.
 */
export declare function resolveSchemaConfig(config: CodeConfig, defaults?: ConfigDefaults): Record<string, unknown>;
export {};
