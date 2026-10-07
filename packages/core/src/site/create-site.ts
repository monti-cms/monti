import { createCodeBlock, type SiteCodeBlock } from "../annotation/code-block/active";
import { createBlocks, type SiteBlocks } from "../blocks/active";
import type { CmsConfig } from "../config/define";
import { createAdminPaths, type SiteAdminPaths } from "../core/admin-paths";
import { createApi, type SiteApi } from "../core/api";
import { createCollections, type SiteCollections } from "../core/collections";
import { createLinks, type SiteLinks } from "../core/links";
import { createLocales, type SiteLocales } from "../core/locales";
import { createTime, type SiteTime } from "../core/time";
import { createI18n, type SiteI18n } from "../i18n";
import { resolveLabels, withActiveLocale } from "../i18n/active";
import type { CmsPlugin } from "../plugin/define";
import { createSchemas, type SiteSchemas } from "../schema/derive";

/**
 * A site config that is any config: what code that works on a site without knowing which one it is accepts. The config a site writes (`defineConfig(...)`) is
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
export type Site<Config extends AnyCmsConfig = AnyCmsConfig> = SiteI18n &
	SiteLocales &
	SiteSchemas &
	SiteCollections &
	SiteLinks &
	SiteAdminPaths &
	SiteTime &
	SiteBlocks &
	SiteCodeBlock & {
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

/** Drops what JSON cannot hold (functions, `undefined`), and reads getters. */
const asData = <T>(value: T): T =>
	value === undefined
		? value
		: (JSON.parse(
				JSON.stringify(value, (_key, item: unknown) => (typeof item === "function" ? undefined : item)),
			) as T);

function snapshotOf(config: AnyCmsConfig, blocks: SiteBlocks): SiteSnapshot {
	const stringMessages = config.admin?.messages
		? Object.fromEntries(
				Object.entries(config.admin.messages).map(([namespace, dict]) => [
					namespace,
					Object.fromEntries(Object.entries(dict).filter(([, value]) => typeof value === "string")),
				]),
			)
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
 * per `createCms`, the admin in the browser per `<SiteProvider>`). It throws if the config is inconsistent in a way `defineConfig` would also reject.
 *
 * The labels of block and line effect definitions (getters, because the language is not known when the config file imports them) are read here, in the admin language.
 */
export function createSite<const Config extends AnyCmsConfig>(config: Config): Site<Config> {
	const i18n = createI18n(config);
	return withActiveLocale(i18n.ADMIN_LANGUAGE, config.admin?.messages, () => {
		const locales = createLocales(config);
		const schemas = createSchemas(resolveLabels(config.collections));
		const collections = createCollections(config.collections, schemas);
		const links = createLinks(config, { collections, schemas, locales });
		const blocks = createBlocks(config);
		const plugins: readonly CmsPlugin[] = config.plugins ?? [];
		const api = createApi({ COLLECTIONS: collections.COLLECTIONS, LOCALES: locales.LOCALES, media: config.media });
		let snapshot: SiteSnapshot | undefined;
		return {
			...i18n,
			...locales,
			...schemas,
			...collections,
			...links,
			...createAdminPaths(config),
			...createTime(config),
			...blocks,
			...createCodeBlock(config.codeBlock),
			config,
			plugins,
			getPluginOptions: <Options = unknown>(name: string) =>
				plugins.find((plugin) => plugin.name === name)?.options as Options | undefined,
			api,
			snapshot: () => {
				snapshot ??= withActiveLocale(i18n.ADMIN_LANGUAGE, config.admin?.messages, () => snapshotOf(config, blocks));
				return snapshot;
			},
		};
	});
}
