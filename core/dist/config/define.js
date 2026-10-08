import { validateCodeBlockConfig } from "../annotation/code-block/line-effects.js";
import { createBlocks } from "../blocks/active.js";
import { resolveBlocks } from "../blocks/resolve.js";
import { validateMediaConfig } from "../core/media-types.js";
import { assertPluginNamesFree, assertPluginPagesFree } from "../plugin/collisions.js";
import { validateBodyAllowed } from "../schema/allowed.js";
import { normalizeCollection, validateListColumns } from "../schema/collection.js";
import { DEFAULT_TITLE_FIELD, RESERVED_METADATA_KEYS, SUMMARY_ROLE, TITLE_ROLE } from "../schema/fields.js";
import { findTitleField, valueFieldsOf } from "../schema/walk.js";
import { resolveSchemaConfig } from "../schema-file/merge.js";
import { SCHEMA_SOURCE } from "../schema-file/source.js";
import { DEFAULT_ADMIN_PATH, isAdminPath, isHomeHref, LOCALE_CODE, LOCALE_PREFIX_MODES, } from "./rules.js";
export { LOCALE_PREFIX_MODES };
const ROLE_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;
/**
 * Can two public URL rules (of the form `/posts/:slug`) produce the same URL? If so, a body link cannot tell which collection it points to.
 * A slug lives within a single `/`-free segment, so the rules collide when the segment counts match and every segment can match:
 * literal segments must be equal; a slug segment (`prefix:slugsuffix`) matches a literal segment if the literal starts and ends with that prefix and suffix (the slug needs at least one character);
 * two slug segments can match if one prefix starts with the other and one suffix ends with the other.
 */
export function pathsOverlap(a, b) {
    const segments = (path) => path.replace(/\/+$/, "").split("/");
    const left = segments(a);
    const right = segments(b);
    if (left.length !== right.length)
        return false;
    return left.every((x, index) => {
        const y = right[index] ?? "";
        const xs = x.split(":slug");
        const ys = y.split(":slug");
        if (xs.length === 1 && ys.length === 1)
            return x === y;
        if (xs.length === 1 || ys.length === 1) {
            const literal = xs.length === 1 ? x : y;
            const [prefix = "", suffix = ""] = xs.length === 1 ? ys : xs;
            return literal.length > prefix.length + suffix.length && literal.startsWith(prefix) && literal.endsWith(suffix);
        }
        const [xp = "", xsuf = ""] = xs;
        const [yp = "", ysuf = ""] = ys;
        return (xp.startsWith(yp) || yp.startsWith(xp)) && (xsuf.endsWith(ysuf) || ysuf.endsWith(xsuf));
    });
}
const checkTab = (at, tab) => {
    if (tab !== undefined && (!tab.trim() || tab.length > 20))
        throw new Error(`${at}.tab must be 1-20 characters`);
};
/**
 * Checks that field roles (`role`), tabs (`tab`), fill-from-body (`fillFromBody`) and URL source (`from`) are consistent. A role is unique per collection,
 * and only the roles the core knows (`summary`, `title`) get their type checked. The type of other roles is checked in `validate` by the plugin that uses the role.
 */
function validateFieldMeanings(collection, schema) {
    const roles = new Map();
    for (const { name, field } of valueFieldsOf(schema)) {
        const role = field.role;
        if (role !== undefined) {
            if (!ROLE_NAME.test(role))
                throw new Error(`cms.config: ${collection}.${name} has an invalid role "${role}"`);
            if ((role === SUMMARY_ROLE || role === TITLE_ROLE) && field.kind !== "text") {
                throw new Error(`cms.config: ${collection}.${name} role "${role}" needs a text field`);
            }
            if (role === TITLE_ROLE && !Object.hasOwn(schema.fields, name)) {
                throw new Error(`cms.config: ${collection}.${name} role "${role}" cannot be on a field of a conditional field`);
            }
            const other = roles.get(role);
            if (other)
                throw new Error(`cms.config: ${collection} has role "${role}" on both ${other} and ${name}`);
            roles.set(role, name);
        }
        if (RESERVED_METADATA_KEYS.includes(name)) {
            throw new Error(`cms.config: ${collection}.${name} uses a reserved name; rename the field`);
        }
        if (field.required !== undefined && field.required !== true) {
            throw new Error(`cms.config: ${collection}.${name} has required: ${JSON.stringify(field.required)}; only \`required: true\` exists (the old "publish" value was removed)`);
        }
        if (field.kind === "text" && field.fillFromBody && !schema.body) {
            throw new Error(`cms.config: ${collection}.${name} fillFromBody needs a collection with a body`);
        }
        if (field.kind === "text" && typeof field.fillFromBody === "object") {
            const { maxLength } = field.fillFromBody;
            if (maxLength !== undefined && (!Number.isInteger(maxLength) || maxLength < 1)) {
                throw new Error(`cms.config: ${collection}.${name} fillFromBody.maxLength must be a positive integer`);
            }
        }
        if (field.kind === "media" && field.accept !== undefined && field.accept !== "image" && field.accept !== "file") {
            throw new Error(`cms.config: ${collection}.${name} accept must be "image" or "file"`);
        }
    }
    // Every collection has one title text field: the field with role "title" or, without one, the field named `title` (its label is free).
    // The list, search, relation picker, body links and the editor's title input use it.
    const titleField = findTitleField(schema);
    if (!titleField) {
        throw new Error(`cms.config: ${collection} needs a title field: a text field with role "${TITLE_ROLE}" (or one named "${DEFAULT_TITLE_FIELD}")`);
    }
    // The name `title` is the list's title column and the sort of the API, so it cannot name another field once the title role is somewhere else.
    if (titleField.name !== DEFAULT_TITLE_FIELD && Object.hasOwn(schema.fields, DEFAULT_TITLE_FIELD)) {
        throw new Error(`cms.config: ${collection}.${DEFAULT_TITLE_FIELD} is not the title field (${titleField.name} has the role "${TITLE_ROLE}"); rename it`);
    }
    for (const [index, group] of (schema.layout ?? []).entries()) {
        checkTab(`cms.config: ${collection}.layout[${index}]`, group.tab);
    }
    for (const [name, field] of Object.entries(schema.fields)) {
        if (RESERVED_METADATA_KEYS.includes(name)) {
            throw new Error(`cms.config: ${collection}.${name} uses a reserved name; rename the field`);
        }
        checkTab(`cms.config: ${collection}.${name}`, field.tab);
        if (field.kind === "view" && !/^[a-z][a-z0-9-]*$/.test(field.view)) {
            throw new Error(`cms.config: ${collection}.${name} view must be a kebab-case name`);
        }
    }
    for (const [name, field] of Object.entries(schema.fields)) {
        if (field.kind !== "slug" || field.from === undefined)
            continue;
        if (schema.fields[field.from]?.kind !== "text") {
            throw new Error(`cms.config: ${collection}.${name} is made from "${field.from}", which is not a text field`);
        }
    }
}
export { DEFAULT_ADMIN_PATH, isAdminPath };
/** Checks that the config is consistent. Reports an error right away when the app starts if it is not. */
function validate(config) {
    const names = Object.keys(config.collections);
    if (names.length === 0)
        throw new Error("cms.config: `collections` is empty");
    const codes = config.locales.map((locale) => locale.code);
    if (codes.length === 0)
        throw new Error("cms.config: `locales` is empty");
    if (new Set(codes).size !== codes.length)
        throw new Error("cms.config: `locales` has duplicate codes");
    // Locale codes go straight into URLs and DB defaults (migrations). Only BCP 47 shapes (`ko`, `en`, `pt-BR`, `zh-Hant`) are accepted.
    for (const code of codes) {
        if (!LOCALE_CODE.test(code)) {
            throw new Error(`cms.config: locale code "${code}" must look like "en", "pt-BR" or "zh-Hant"`);
        }
    }
    if (!codes.includes(config.defaultLocale)) {
        throw new Error(`cms.config: defaultLocale "${config.defaultLocale}" is not in \`locales\``);
    }
    if (config.site?.url !== undefined) {
        let url;
        try {
            url = new URL(config.site.url);
        }
        catch { }
        if (url?.protocol !== "http:" && url?.protocol !== "https:") {
            throw new Error(`cms.config: site.url "${config.site.url}" is not an http(s) URL`);
        }
    }
    if (config.timeZone !== undefined) {
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: config.timeZone });
        }
        catch {
            throw new Error(`cms.config: timeZone "${config.timeZone}" is not an IANA time zone`);
        }
    }
    if (config.admin?.path !== undefined && !isAdminPath(config.admin.path)) {
        throw new Error(`cms.config: admin.path "${config.admin.path}" must be a path like "/admin" (not "/" and not under "/api")`);
    }
    if (config.site?.localePrefix !== undefined && !LOCALE_PREFIX_MODES.includes(config.site.localePrefix)) {
        throw new Error(`cms.config: site.localePrefix must be one of ${LOCALE_PREFIX_MODES.join(", ")}`);
    }
    const previewParam = config.site?.previewLocaleParam;
    if (previewParam !== undefined && previewParam !== false && !/^[A-Za-z][\w-]*$/.test(previewParam)) {
        throw new Error(`cms.config: site.previewLocaleParam "${previewParam}" is not a query name`);
    }
    if (config.site?.home !== undefined && !isHomeHref(config.site.home)) {
        throw new Error(`cms.config: site.home "${config.site.home}" must be a path ("/") or an http(s) URL`);
    }
    if (config.admin && "legacyBackupNames" in config.admin) {
        throw new Error("cms.config: admin.legacyBackupNames was removed; delete it (the admin UI only uses the `cms_backup` recovery database)");
    }
    for (const key of ["templates", "translations"]) {
        const value = config.admin?.[key];
        if (value !== undefined && typeof value !== "boolean") {
            throw new Error(`cms.config: admin.${key} must be true or false`);
        }
    }
    if (config.admin?.locale !== undefined) {
        try {
            new Intl.DateTimeFormat(config.admin.locale);
        }
        catch {
            throw new Error(`cms.config: admin.locale "${config.admin.locale}" is not a valid locale`);
        }
    }
    if (config.schemaVersion !== undefined && (!Number.isInteger(config.schemaVersion) || config.schemaVersion < 1)) {
        throw new Error(`cms.config: schemaVersion must be a whole number from 1 (got ${String(config.schemaVersion)})`);
    }
    const templateIds = new Set();
    for (const template of config.seed?.templates ?? []) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(template.id)) {
            throw new Error(`cms.config: seed template "${template.name}" needs a UUID id`);
        }
        if (templateIds.has(template.id.toLowerCase())) {
            throw new Error(`cms.config: seed template id "${template.id}" is duplicated`);
        }
        templateIds.add(template.id.toLowerCase());
        const asDocument = template.doc !== undefined;
        const asText = template.body !== undefined || template.format !== undefined;
        if (asDocument === asText ||
            (asText && (typeof template.body !== "string" || typeof template.format !== "string"))) {
            throw new Error(`cms.config: seed template "${template.name}" needs either \`doc\` or both \`body\` and \`format\``);
        }
    }
    const paths = new Map();
    for (const [collection, schema] of Object.entries(config.collections)) {
        // A content item has a single URL (the store has one URL column). A second URL field would go unused, so it is rejected as a config error.
        const slugFields = Object.entries(schema.fields).filter(([, field]) => field.kind === "slug");
        if (slugFields.length > 1) {
            throw new Error(`cms.config: ${collection} has more than one slug field (${slugFields.map(([name]) => name).join(", ")}); a collection can have only one`);
        }
        validateFieldMeanings(collection, schema);
        validateListColumns(collection, schema);
        if (schema.path !== undefined) {
            const { path } = schema;
            if (!path.startsWith("/") || path.split(":slug").length !== 2 || /:(?!slug)/.test(path) || /[?#]/.test(path)) {
                throw new Error(`cms.config: ${collection}.path "${path}" must start with "/" and contain ":slug" once`);
            }
            if (!Object.values(schema.fields).some((field) => field.kind === "slug")) {
                throw new Error(`cms.config: ${collection}.path needs a slug field`);
            }
            for (const [otherPath, other] of paths) {
                if (pathsOverlap(path, otherPath)) {
                    throw new Error(`cms.config: ${collection}.path "${path}" can make the same URL as ${other}.path "${otherPath}"`);
                }
            }
            paths.set(path, collection);
        }
        for (const { name, field } of valueFieldsOf(schema)) {
            if (field.kind === "relation" && !Object.hasOwn(config.collections, field.to)) {
                throw new Error(`cms.config: ${collection}.${name} relates to unknown collection "${field.to}"`);
            }
        }
        for (const [name, field] of Object.entries(schema.fields)) {
            if (field.kind !== "backlink")
                continue;
            const source = config.collections[field.from];
            if (!source)
                throw new Error(`cms.config: ${collection}.${name} links from unknown collection "${field.from}"`);
            const via = valueFieldsOf(source).find((stored) => stored.name === field.via)?.field;
            if (via?.kind !== "relation" || !via.many || via.to !== collection) {
                throw new Error(`cms.config: ${collection}.${name} needs ${field.from}.${field.via} to be a many relation to "${collection}"`);
            }
        }
    }
    const blockDefinitions = resolveBlocks(config);
    const blocks = blockDefinitions.map((block) => block.name);
    // The names in a body's allowed list must be blocks and marks of this site.
    const bodySite = createBlocks(config);
    for (const [collection, schema] of Object.entries(config.collections)) {
        validateBodyAllowed(collection, schema.allowed, bodySite);
    }
    validateCodeBlockConfig(config.codeBlock);
    validateMediaConfig(config.media);
    const plugins = config.plugins ?? [];
    const pluginNames = plugins.map((plugin) => plugin.name);
    if (new Set(pluginNames).size !== pluginNames.length)
        throw new Error("cms.config: `plugins` has duplicate names");
    assertPluginNamesFree(pluginNames);
    assertPluginPagesFree(plugins.flatMap((plugin) => (plugin.nav ?? []).map((item) => ({ plugin: plugin.name, path: item.path }))));
    for (const plugin of plugins) {
        plugin.validate?.({
            collections: config.collections,
            locales: config.locales,
            defaultLocale: config.defaultLocale,
            blocks,
            blockDefinitions,
            plugins,
        });
    }
}
export function defineSite(input) {
    const config = ("schema" in input && input.schema !== undefined ? resolveSchemaConfig(input) : input);
    // Also accepts definitions written without `defineCollection`. The core only reads the normalized `kind`.
    const collections = Object.fromEntries(Object.entries(config.collections).map(([name, schema]) => [name, normalizeCollection(schema)]));
    const normalized = { ...config, collections };
    validate(normalized);
    if ("schema" in input && input.schema !== undefined) {
        const schemaInput = input;
        // Hidden: lets an instance rebuild the config with another schema (see `schema-file/source.ts`).
        Object.defineProperty(normalized, SCHEMA_SOURCE, {
            value: {
                ...(typeof schemaInput.schema === "string" ? { file: schemaInput.schema } : {}),
                rebuild: (schema) => defineSite({ ...schemaInput, schema }),
            },
        });
    }
    return normalized;
}
