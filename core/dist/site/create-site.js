import { createCodeBlock } from "../annotation/code-block/active.js";
import { createBlocks } from "../blocks/active.js";
import { createAdminFeatures } from "../core/admin-features.js";
import { createAdminPaths } from "../core/admin-paths.js";
import { createApi } from "../core/api.js";
import { createCollections } from "../core/collections.js";
import { createLinks } from "../core/links.js";
import { createLocales } from "../core/locales.js";
import { createTime } from "../core/time.js";
import { createI18n } from "../i18n/index.js";
import { resolveLabels, withActiveLocale } from "../i18n/active.js";
import { createSchemas } from "../schema/derive.js";
/** Drops what JSON cannot hold (functions, `undefined`), and reads getters. */
const asData = (value) => value === undefined
    ? value
    : JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === "function" ? undefined : item)));
function snapshotOf(config, blocks) {
    const stringMessages = config.admin?.messages
        ? Object.fromEntries(Object.entries(config.admin.messages).map(([namespace, dict]) => [
            namespace,
            Object.fromEntries(Object.entries(dict).filter(([, value]) => typeof value === "string")),
        ]))
        : undefined;
    return {
        collections: asData(config.collections),
        locales: config.locales,
        defaultLocale: config.defaultLocale,
        ...(config.site ? { site: config.site } : {}),
        ...(config.timeZone !== undefined ? { timeZone: config.timeZone } : {}),
        ...(config.admin ? { admin: { ...config.admin, ...(stringMessages ? { messages: stringMessages } : {}) } } : {}),
        ...(config.media ? { media: config.media } : {}),
        ...(config.codeBlock
            ? {
                codeBlock: {
                    ...config.codeBlock,
                    ...(config.codeBlock.lineEffects ? { lineEffects: resolveLabels(config.codeBlock.lineEffects) } : {}),
                },
            }
            : {}),
        blocks: asData(blocks.ADDED_BLOCKS),
        plugins: (config.plugins ?? []).map((plugin) => ({
            name: plugin.name,
            options: asData(plugin.options),
            ...(plugin.nav ? { nav: asData(plugin.nav) } : {}),
            ...(plugin.contributes ? { contributes: asData(plugin.contributes) } : {}),
        })),
    };
}
/**
 * Resolves a site config into a `Site`: its locales, collections and schema rules, links and admin addresses, time zone, blocks, code block settings, admin language and
 * request schemas. Nothing is read from a module or the environment, and nothing is shared between sites, so any number of sites live in one process (a CMS instance
 * per `createCms`, the admin in the browser per `<SiteProvider>`). It throws if the config is inconsistent in a way `defineSite` would also reject.
 *
 * The labels of block and line effect definitions (getters, because the language is not known when the config file imports them) are read here, in the admin language.
 */
export function createSite(config) {
    const i18n = createI18n(config);
    return withActiveLocale(i18n.ADMIN_LANGUAGE, config.admin?.messages, () => {
        const locales = createLocales(config);
        const schemas = createSchemas(resolveLabels(config.collections));
        const collections = createCollections(config.collections, schemas);
        const links = createLinks(config, { collections, schemas, locales });
        const blocks = createBlocks(config);
        const plugins = config.plugins ?? [];
        const api = createApi({ COLLECTIONS: collections.COLLECTIONS, LOCALES: locales.LOCALES, media: config.media });
        let snapshot;
        return {
            ...i18n,
            ...locales,
            ...schemas,
            ...collections,
            ...links,
            ...createAdminPaths(config),
            ...createAdminFeatures(config),
            ...createTime(config),
            ...blocks,
            ...createCodeBlock(config.codeBlock),
            config,
            plugins,
            getPluginOptions: (name) => plugins.find((plugin) => plugin.name === name)?.options,
            api,
            snapshot: () => {
                snapshot ??= withActiveLocale(i18n.ADMIN_LANGUAGE, config.admin?.messages, () => snapshotOf(config, blocks));
                return snapshot;
            },
        };
    });
}
