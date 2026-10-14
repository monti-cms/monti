import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseSchemaFile } from "../schema-file/format.js";
import { printSchemaFile } from "../schema-file/print.js";
import { createSite } from "../site/index.js";
import { locateExtractConfig, SCHEMA_FILE_CANDIDATES } from "./locate.js";
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Paths of the functions inside a value (what a schema file cannot hold: it is data only). */
function functionPaths(value, at) {
    if (typeof value === "function")
        return [at];
    if (Array.isArray(value))
        return value.flatMap((item, index) => functionPaths(item, `${at}[${index}]`));
    if (isRecord(value))
        return Object.entries(value).flatMap(([key, item]) => functionPaths(item, at ? `${at}.${key}` : key));
    return [];
}
/**
 * Takes the plain-data part of a config: collections (with the labels the admin shows, in the admin language), locales, default locale, time zone, site settings
 * (except `url`, which differs per environment), admin path, language and text overrides, and seed templates. Everything that needs code is left out and listed in `stays`.
 * A plugin's fields are already in the collections (`seoFields()` made them), so they are data like the rest; the plugin itself stays in code.
 */
export function extractSchemaData(config, options = {}) {
    const stays = [];
    // The site resolves the labels (they can be getters that follow the admin language) the way the admin shows them, or in the language asked for.
    const resolved = createSite(options.locale ? { ...config, admin: { ...config.admin, locale: options.locale } } : config).snapshot();
    const collections = Object.fromEntries(Object.entries(resolved.collections).map(([name, collection]) => {
        const { body, allowed, ...rest } = collection;
        // The object form of `body` carries the allowed blocks and marks (and means the collection has a body).
        if (allowed)
            return [name, { ...rest, body: allowed }];
        // The default is left out: documents have a body, items do not.
        return [name, body === (collection.kind === "document") ? rest : { ...rest, body }];
    }));
    const lost = functionPaths(config.collections, "collections");
    if (lost.length > 0) {
        stays.push({
            what: "collection options that are functions",
            detail: `${lost.join(", ")} (a schema file is data only, so it cannot hold a function; the value is left out of the schema)`,
        });
    }
    const { url: _url, ...site } = (config.site ?? {});
    if (config.site && "url" in config.site) {
        stays.push({
            what: "site.url",
            detail: "differs per environment, so it is read from the SITE_URL environment variable (`site.url` in code overrides it)",
        });
    }
    let admin;
    if (config.admin) {
        const { messages, ...rest } = config.admin;
        const strings = {};
        const functions = [];
        for (const [namespace, dict] of Object.entries(messages ?? {})) {
            for (const [key, value] of Object.entries(dict)) {
                if (typeof value === "string")
                    strings[namespace] = { ...strings[namespace], [key]: value };
                else
                    functions.push(`${namespace}.${key}`);
            }
        }
        if (functions.length > 0) {
            stays.push({ what: "admin.messages", detail: `${functions.join(", ")} (text built by a function needs code)` });
        }
        admin = { ...rest, ...(Object.keys(strings).length > 0 ? { messages: strings } : {}) };
    }
    if (config.plugins?.length) {
        stays.push({
            what: "plugins",
            detail: `${config.plugins.map((plugin) => plugin.name).join(", ")} (code; the fields they add to collections are in the schema)`,
        });
    }
    if (config.blocks?.length) {
        stays.push({
            what: "blocks",
            detail: `${config.blocks.map((block) => block.name).join(", ")} (block components are code)`,
        });
    }
    if (config.codeBlock)
        stays.push({ what: "codeBlock", detail: "line effects and themes can hold labels and functions" });
    if (config.media)
        stays.push({ what: "media", detail: "upload limits and formats" });
    const schema = {
        // The first version of the file: `monti schema:apply` raises it when the schema changes.
        schemaVersion: config.schemaVersion ?? 1,
        collections,
        locales: config.locales,
        defaultLocale: config.defaultLocale,
        ...(config.timeZone !== undefined ? { timeZone: config.timeZone } : {}),
        ...(Object.keys(site).length > 0 ? { site } : {}),
        ...(admin && Object.keys(admin).length > 0 ? { admin } : {}),
        ...(config.seed?.templates?.length ? { seed: { templates: config.seed.templates } } : {}),
    };
    // JSON drops `undefined` (and the printer does too); reading it back through the format check also proves the result is a valid schema file.
    return { schema: parseSchemaFile(JSON.parse(JSON.stringify(schema))), stays };
}
/** The text of a schema file: the `defineSchema` import, then the data, indented with tabs. */
export const schemaFileText = (schema) => printSchemaFile(schema);
/**
 * `monti schema:extract`: loads the site's config file (TypeScript is read by tsx, which `bin/monti.mjs` registers), writes its data part to `monti.schema.ts`
 * and reports what stays in code. It reads the site config as the default export (`defineSite` of `@monti-cms/core`) or, for
 * `monti.config.ts`, from the `cms` it exports. It never changes the config file; the report shows how to load the schema from it.
 */
export async function extractSchema(options) {
    const { cwd } = options;
    const configFile = locateExtractConfig(cwd, options.config);
    const out = options.out ?? path.join(path.dirname(configFile), SCHEMA_FILE_CANDIDATES[0]).split(path.sep).join("/");
    if (existsSync(path.resolve(cwd, out)) && !options.overwrite) {
        throw new Error(`${out} already exists; pass --overwrite to replace it`);
    }
    const file = path.resolve(cwd, configFile);
    const loaded = await (options.load ?? ((target) => import(pathToFileURL(target).href)))(file);
    const cms = loaded.cms;
    const config = (cms?.site?.config ?? loaded.default ?? loaded.config);
    if (!config || !isRecord(config.collections) || !Array.isArray(config.locales)) {
        throw new Error(`${configFile} must export the site config (\`export default defineSite({ ... })\`) or the CMS instance (\`export const cms = defineConfig({ ... })\`)`);
    }
    const { schema, stays } = extractSchemaData(config, { locale: options.locale });
    const target = path.resolve(cwd, out);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, schemaFileText(schema));
    return {
        config: configFile,
        schema: out,
        collections: Object.keys(schema.collections).length,
        locales: schema.locales.length,
        templates: schema.seed?.templates?.length ?? 0,
        stays,
    };
}
/** Turns the report into human-readable text, ending with the slim config to put in the config file. */
export function formatExtractReport(report) {
    const relative = path.posix.relative(path.posix.dirname(report.config), report.schema).replace(/\.ts$/, "");
    const schemaImport = relative.startsWith(".") ? relative : `./${relative}`;
    const plugins = report.stays.some((item) => item.what === "plugins");
    const lines = [
        `Wrote ${report.schema} (${report.collections} collections, ${report.locales} locales, ${report.templates} seed templates).`,
        "",
        report.stays.length > 0 ? `Stays in code (${report.config}):` : `Nothing needs to stay in code (${report.config}).`,
        ...report.stays.map((item) => `  - ${item.what}: ${item.detail}`),
        "",
        `${report.config} is unchanged. To use the schema, replace its collections, locales, default locale, time zone, seed and admin path with the file:`,
        "",
        `  import schema from "${schemaImport}";`,
        report.config.endsWith("monti.config.ts") ? "  export const cms = defineConfig({" : "  export default defineSite({",
        "    schema,",
        ...(plugins ? ["    plugins: [/* the plugins above */],"] : []),
        ...report.stays.flatMap((item) => {
            if (item.what === "site.url")
                return ["    // site.url: set the SITE_URL environment variable"];
            return item.what === "blocks" || item.what === "codeBlock" || item.what === "media"
                ? [`    ${item.what}: /* as before */,`]
                : [];
        }),
        ...(report.config.endsWith("monti.config.ts") ? ["    /* database, auth and the rest as before */"] : []),
        "  });",
    ];
    return lines.join("\n");
}
