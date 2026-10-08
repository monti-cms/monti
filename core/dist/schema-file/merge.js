import { parseSchemaFile } from "./format.js";
import { readSchemaFile } from "./read.js";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** The keys of `over` that are set (not `undefined`) laid over `base`: `site: { url: process.env.X || undefined }` keeps the file's `url`. */
const overlay = (base, over) => {
    if (over === undefined)
        return base;
    if (!isRecord(over))
        return over;
    const set = Object.fromEntries(Object.entries(over).filter(([, value]) => value !== undefined));
    return { ...base, ...set };
};
/** Reads the schema of a config's `schema` option: the parsed JSON, or the path of the file (relative to the working directory). */
export function loadSchemaOption(schema) {
    if (typeof schema === "string")
        return parseSchemaFile(readSchemaFile(schema), schema);
    return parseSchemaFile(schema);
}
/**
 * Merges the schema file into the code part of a config, and returns the config `defineSite` checks like any other. The rule is that code adds to the file
 * and may override its environment-specific settings, but never silently replaces its data:
 *
 * - `collections`: the file's collections and the code's, side by side. The same name in both is an error.
 * - `locales`, `defaultLocale` and `schemaVersion`: only in the file (setting them in code too is an error).
 * - `site` and `admin`: key by key, the code's value wins. A key set to `undefined` in code leaves the file's value.
 * - `timeZone`: the code's value wins.
 * - `seed.templates`: the file's templates, then the code's.
 * - everything else (`plugins`, `blocks`, `codeBlock`, `media`): from code, the file has none of it.
 */
export function resolveSchemaConfig(config) {
    const { schema: option, ...code } = config;
    const file = loadSchemaOption(option);
    const source = typeof option === "string" ? option : "monti.schema.json";
    for (const key of ["locales", "defaultLocale", "schemaVersion"]) {
        if (code[key] !== undefined) {
            throw new Error(`cms.config: \`${key}\` is set in the config and in ${source}; keep it in the schema file (a site's locales, default locale and schema version have one place)`);
        }
    }
    const codeCollections = isRecord(code.collections) ? code.collections : {};
    for (const name of Object.keys(codeCollections)) {
        if (Object.hasOwn(file.collections, name)) {
            throw new Error(`cms.config: collection "${name}" is defined in ${source} and in the config; define it in one place`);
        }
    }
    const codeSeed = isRecord(code.seed) ? code.seed : undefined;
    const templates = [
        ...(file.seed?.templates ?? []),
        ...(Array.isArray(codeSeed?.templates) ? codeSeed.templates : []),
    ];
    const merged = {
        ...code,
        collections: { ...file.collections, ...codeCollections },
        locales: file.locales,
        defaultLocale: file.defaultLocale,
    };
    if (file.schemaVersion !== undefined)
        merged.schemaVersion = file.schemaVersion;
    const timeZone = code.timeZone ?? file.timeZone;
    if (timeZone !== undefined)
        merged.timeZone = timeZone;
    const site = overlay(file.site, code.site);
    if (site)
        merged.site = site;
    const admin = overlay(file.admin, code.admin);
    if (admin)
        merged.admin = admin;
    if (templates.length > 0 || file.seed || codeSeed)
        merged.seed = { ...file.seed, ...codeSeed, templates };
    return merged;
}
