import { type SiteCodeBlock } from "../annotation/code-block/active.js";
import { type SiteBlocks } from "../blocks/active.js";
import type { CmsConfig } from "../config/define.js";
import { type SiteAdminFeatures } from "../core/admin-features.js";
import { type SiteAdminPaths } from "../core/admin-paths.js";
import { type SiteApi } from "../core/api.js";
import { type SiteCollections } from "../core/collections.js";
import { type SiteLinks } from "../core/links.js";
import { type SiteLocales } from "../core/locales.js";
import { type SiteTime } from "../core/time.js";
import { type SiteI18n } from "../i18n/index.js";
import type { CmsPlugin } from "../plugin/define.js";
import { type SiteSchemas } from "../schema/derive.js";
/**
 * A site config that is any config: what code that works on a site without knowing which one it is accepts. The config a site writes (`defineSite(...)`) is
 * assignable to it and keeps its own, narrower type in `Site<typeof config>`.
 */
export type AnyCmsConfig = CmsConfig;
/**
 * The config a site's browser code works from: the same shape as the site config, with nothing that cannot cross from the server to the browser as data. It is
 * what `site.snapshot()` returns and what `createSite` and `<SiteProvider config={...}>` accept.
 *
 * Collections, locales, `site`, `admin`, `timeZone`, `media` and `codeBlock` are the config's own (with the labels written as text). `blocks` holds every block of the site
 * (the blocks the plugins add included) and each plugin keeps its `name`, `nav`, `options` and `contributes` as JSON: a function inside `options` or `contributes`
 * does not reach the browser, and neither do the plugin's `server`, `admin`, `render`, `formats`, `validate` loaders.
 * Text overrides of `admin.messages` that are functions are left out the same way (strings stay).
 */
export type SiteSnapshot = CmsConfig;
/** One site, resolved from its config: everything that used to be a module-level constant derived from the config file. */
export type Site<Config extends AnyCmsConfig = AnyCmsConfig> = SiteI18n & SiteLocales & SiteSchemas & SiteCollections & SiteLinks & SiteAdminPaths & SiteAdminFeatures & SiteTime & SiteBlocks & SiteCodeBlock & {
    /** The config the site was created from. */
    readonly config: Config;
    /** The plugins of the config (an empty list if it has none). */
    readonly plugins: readonly CmsPlugin[];
    /**
     * The `options` of a plugin picked by name from `plugins` in the site config. This is the official way for an extension to read its own config. `undefined`
     * if that plugin is not in the config.
     */
    getPluginOptions<Options = unknown>(name: string): Options | undefined;
    /** The request schemas and upload rules that depend on the site's collections, locales and `media`. */
    readonly api: SiteApi;
    /** The config as data, for the browser (see {@link SiteSnapshot}). The same object every call. */
    snapshot(): SiteSnapshot;
};
/**
 * Resolves a site config into a `Site`: its locales, collections and schema rules, links and admin addresses, time zone, blocks, code block settings, admin language and
 * request schemas. Nothing is read from a module or the environment, and nothing is shared between sites, so any number of sites live in one process (a CMS instance
 * per `createCms`, the admin in the browser per `<SiteProvider>`). It throws if the config is inconsistent in a way `defineSite` would also reject.
 *
 * The labels of block and line effect definitions (getters, because the language is not known when the config file imports them) are read here, in the admin language.
 */
export declare function createSite<const Config extends AnyCmsConfig>(config: Config): Site<Config>;
