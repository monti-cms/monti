import { type CodeBlockConfig, checkCodeBlockConfig } from "../annotation/code-block/line-effects";
import { createBlocks } from "../blocks/active";
import type { BlockDefinition } from "../blocks/define";
import { resolveBlocksChecked } from "../blocks/resolve";
import { checkMediaConfig, type MediaConfig } from "../core/media-types";
import type { StoredDocument } from "../doc/stored-document";
import type { MessageValue } from "../i18n/define";
import { checkPluginNames, checkPluginPages } from "../plugin/collisions";
import type { Plugin } from "../plugin/define";
import { checkBodyAllowed } from "../schema/allowed";
import { type CollectionSchema, normalizeCollection } from "../schema/collection";
import { checkPlacements } from "../schema/layout";
import { configShapeIssues } from "../schema-file/format";
import { type ConfigDefaults, isRecord, layerSite, resolveSchemaConfig } from "../schema-file/merge";
import { SCHEMA_SOURCE } from "../schema-file/source";
import type { SchemaCollectionsOf, SchemaLocalesOf, SchemaTypes } from "../schema-file/types";
import { checkCollections } from "./check/collections";
import { CONFIG_SOURCE, type ConfigIssue, IssueList, throwIssues } from "./check/issue";
import { checkSite } from "./check/site";
import type { LocalePrefixMode } from "./rules";

/**
 * Site config (`monti.config.ts`) schema. Each site lists its collections and locales here, wraps them in `defineSite`, and exports the result as the default export.
 *
 * The config is read by both the server and the admin UI (browser), so it holds **only JSON-serializable values** (plugins also hold functions).
 * Secrets (DB URL, API keys) do not go here; keep them in environment variables.
 */

export interface LocaleConfig<Code extends string = string> {
	/** Locale code (leading part of BCP 47, e.g. `ko`). Used for stored values and public URL prefixes. */
	readonly code: Code;
	/** The language's name written in that language (e.g. `English`). Included in AI translation prompts. */
	readonly name: string;
	/** Name shown in the admin UI. Falls back to `name`. */
	readonly label?: string;
}

export type CollectionsConfig = Readonly<Record<string, CollectionSchema>>;

export interface SiteConfig {
	/**
	 * Public site URL (e.g. `https://example.com`). Links in the body written as full URLs are also recognized as internal links.
	 * If it differs per environment, read it from an environment variable. Without it, only links written as paths such as `/posts/...` are recognized.
	 */
	readonly url?: string;
	/** Other host names to treat as the same site (e.g. `www.example.com`). */
	readonly aliases?: readonly string[];
	/** Site name shown in the admin UI (sidebar, search preview, window title). Falls back to the host name of `url`. */
	readonly name?: string;
	/**
	 * Start of the draft preview URL (e.g. `/preview`). The `Preview` button in the editor appends the public path (collection `path`) to it.
	 * For a non-default locale, the locale is passed in the `previewLocaleParam` query. Without it there is no preview button.
	 */
	readonly previewPath?: string;
	/**
	 * Query name that carries the locale in the preview URL. Default `locale` (`/preview/posts/a?locale=en`).
	 * If `false`, the locale goes into the path following the `localePrefix` rule instead of a query (`/preview/en/posts/a`).
	 */
	readonly previewLocaleParam?: string | false;
	/**
	 * How the locale is added to public URLs. Search preview, draft preview and `localizePath` follow it.
	 * - `except-default` (default): no prefix for the default locale (`/posts/a`), `/{code}` for the others (`/en/posts/a`)
	 * - `always`: `/{code}` for every locale
	 * - `never`: no prefix for any locale (when each locale has its own domain or there is only one locale)
	 */
	readonly localePrefix?: LocalePrefixMode;
	/**
	 * URL opened by the admin sidebar's `View site`. A path (`/`) or a full URL (`https://example.com`). Default `/`
	 * (the site's home page when the admin lives inside the site app).
	 */
	readonly home?: string;
}

export type { LocalePrefixMode };

export interface AdminConfig {
	/**
	 * Admin UI path. Default `/admin`. The app's admin route folder must use the same path
	 * (for `/studio`, `app/(admin)/studio/[[...path]]/page.tsx`). The admin API (`/api/monti/v1`) does not change.
	 */
	readonly path?: string;
	/**
	 * Admin UI locale (BCP 47, e.g. `en`, `ko-KR`). UI text and date/number formatting follow it. Falls back to the site default locale (`defaultLocale`).
	 * A locale without a dictionary shows English. Times are shown in `timeZone`.
	 */
	readonly locale?: string;
	/**
	 * Admin UI text overrides: namespace -> key -> text (`{name}` placeholders are allowed). Find namespaces and keys in each package's dictionary
	 * (`defineMessages`). Example: `{ "cms-admin.entries": { publish: "Ship it" } }`.
	 */
	readonly messages?: Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;
	/**
	 * Whether the admin offers body templates: the template menu of the editor, the sidebar link and the Templates screen. Default `true`. `false` hides all three
	 * (the templates already stored stay in the database).
	 */
	readonly templates?: boolean;
	/**
	 * Whether the admin shows the translation UI: the language tabs of the editor, the locale column, filter and badges of the list, and the language tabs of the
	 * item panel. Default `true`. A site with one locale never shows it, whatever this says; `false` also hides it on a site with several locales.
	 */
	readonly translations?: boolean;
}

/** One width step of the editor: a label for the menu and the widest the editor body gets at that step. */
export interface EditorWidthStep {
	/** Name shown in the editor's width menu. Not empty, and unique among the steps. */
	readonly label: string;
	/** A CSS length (`720px`, `48rem`, `min(100%, 60ch)`): the widest the body is while editing. */
	readonly width: string;
}

export interface EditorConfig {
	/**
	 * The width steps of the editor's width menu, in the order they are listed; the first is the one the editor starts at. Set them to the width of your public
	 * pages, and add a phone width to check how a post wraps. The admin always adds a last "Full" step with no limit. Without `widths` the menu has "Normal"
	 * (`48rem`) and "Full". The editor remembers the step a person picked, per browser.
	 */
	readonly widths?: readonly EditorWidthStep[];
}

/**
 * A body template of the seed: its fixed `id` and `name`, and the body as a stored document (`doc`) or as text in a format (`body` and the `format` that reads it;
 * the format must be one the instance has, so a plugin provides it). Text is read when the migration runs.
 */
export type SeedTemplate = {
	/** Fixed ID (UUID). Running the migration repeatedly still creates only one such template. */
	readonly id: string;
	readonly name: string;
} & (
	| { readonly doc: StoredDocument; readonly body?: undefined; readonly format?: undefined }
	| { readonly body: string; readonly format: string; readonly doc?: undefined }
);

export interface SeedConfig {
	/**
	 * Body template inserted only once, at the first migration of a new store. Templates added later are not inserted into a store that already has them,
	 * and deleted templates are not revived.
	 */
	readonly templates?: readonly SeedTemplate[];
}

export interface CmsConfig<
	Collections extends CollectionsConfig = CollectionsConfig,
	Locale extends string = string,
	Plugins extends readonly Plugin[] = readonly Plugin[],
	Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
> {
	/** Collection name -> definition. The name is a stored value (`entries.collection`), so do not change it in production. */
	readonly collections: Collections;
	/** Content locales. The declaration order is the order shown in the UI. */
	readonly locales: readonly LocaleConfig<Locale>[];
	/** Default locale. Public URLs get no locale prefix for it. */
	readonly defaultLocale: NoInfer<Locale>;
	readonly site?: SiteConfig;
	/**
	 * Time zone (IANA, e.g. `Asia/Seoul`) in which dates and times are entered and shown. The publish date input is wall-clock time in this zone.
	 * `UTC` if unset.
	 */
	readonly timeZone?: string;
	/** Data to seed a new store with. */
	readonly seed?: SeedConfig;
	/** Admin UI settings. */
	readonly admin?: AdminConfig;
	/** The editor: the width steps of its width menu. */
	readonly editor?: EditorConfig;
	/**
	 * Body blocks the site adds (`defineBlock`). Blocks such as callouts and tabs are added by putting the block extension (`@monti-cms/blocks`) in `plugins`.
	 * The public site renders them by the `component` name.
	 */
	readonly blocks?: Blocks;
	/** Plugins (e.g. `ai()`). Names must not collide. */
	readonly plugins?: Plugins;
	/** Code block settings. Adds line effects (`lineEffects`) or changes the core defaults (highlight, add, delete, warning, error). */
	readonly codeBlock?: CodeBlockConfig;
	/** Uploadable media formats and size limits. If unset, all supported formats, images up to 10MB and 40 megapixels, attachments up to 50MB. */
	readonly media?: MediaConfig;
}

/**
 * Every problem of a config, as issues. Runs the shape of the plain data first (types, enums, unknown keys), then the rules about what the values mean
 * (`check/`), then the parts other modules own: the body lists, blocks, code blocks, media and what the plugins say about the config.
 */
function checkConfig(
	config: CmsConfig<CollectionsConfig, string, readonly Plugin[], readonly BlockDefinition[]>,
	alsoKnown: readonly string[] = [],
): ConfigIssue[] {
	const shape = configShapeIssues(config);
	if (shape.length > 0) return shape;
	const list = new IssueList();
	checkSite(list, config, alsoKnown);
	checkCollections(list, config.collections);
	list.addAll(checkCodeBlockConfig(config.codeBlock));
	list.addAll(checkMediaConfig(config.media));

	const { blocks: blockDefinitions, issues: blockIssues } = resolveBlocksChecked(config);
	list.addAll(blockIssues);
	if (blockIssues.length === 0) {
		// The names in a body's allowed list must be blocks and marks of this site.
		const bodySite = createBlocks(config);
		for (const [collection, schema] of Object.entries(config.collections)) {
			list.addAll(checkBodyAllowed(collection, schema.allowed, bodySite));
		}
	}

	const plugins = config.plugins ?? [];
	list.addAll(checkPluginNames(plugins.map((plugin) => plugin.name)));
	list.addAll(
		checkPluginPages(
			plugins.flatMap((plugin) => (plugin.nav ?? []).map((item) => ({ plugin: plugin.name, path: item.path }))),
		),
	);
	list.addAll(checkPlacements(plugins));
	const blocks = blockDefinitions.map((block) => block.name);
	for (const plugin of plugins) {
		list.addAll(
			plugin.checkConfig?.({
				collections: config.collections,
				locales: config.locales,
				defaultLocale: config.defaultLocale,
				blocks,
				blockDefinitions,
				plugins,
			}),
		);
	}
	return list.issues;
}

/**
 * The config of a site that keeps its plain data in a schema file (`monti.schema.ts`): the same options as {@link CmsConfig}, plus `schema`, and without the
 * collections' and locales' own place (they come from the file; `collections` here adds collections written in code).
 */
export interface SchemaCmsConfig<
	Schema extends SchemaTypes = SchemaTypes,
	Collections extends CollectionsConfig = CollectionsConfig,
	Plugins extends readonly Plugin[] = readonly Plugin[],
	Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
> extends Omit<CmsConfig<Collections, string, Plugins, Blocks>, "collections" | "locales" | "defaultLocale"> {
	/**
	 * The schema file's default export (`import schema from "./monti.schema"`, made with `defineSchema`).
	 * Collections, fields, layouts, locales, the default locale, the time zone, site and admin settings and seed templates come from it. The code config adds
	 * what needs code (`plugins`, `blocks`, `codeBlock`, `media`) and may override the environment-specific `site`, `admin` and `timeZone` values.
	 */
	readonly schema: Schema;
	/** Collections written in code, next to the file's. A name the file also has is an error. */
	readonly collections?: Collections;
	/** Set in the schema file only. */
	readonly locales?: never;
	/** Set in the schema file only. */
	readonly defaultLocale?: never;
}

/**
 * Defines the site config. Preserves collection and locale names as types and reports inconsistent config right away.
 *
 * With a `schema` (the plain-data part of the config in `monti.schema.ts`, made with `defineSchema`), the config is the file merged with what is written here; see
 * {@link SchemaCmsConfig}. The collection and locale names and the metadata types come from the types of the schema.
 */
export function defineSite<
	const Schema extends SchemaTypes,
	const Collections extends CollectionsConfig = Record<never, never>,
	const Plugins extends readonly Plugin[] = readonly [],
	const Blocks extends readonly BlockDefinition[] = readonly [],
>(
	config: SchemaCmsConfig<Schema, Collections, Plugins, Blocks>,
): CmsConfig<SchemaCollectionsOf<Schema> & Collections, SchemaLocalesOf<Schema>, Plugins, Blocks>;
export function defineSite<
	const Collections extends CollectionsConfig,
	const Locale extends string,
	const Plugins extends readonly Plugin[] = readonly [],
	const Blocks extends readonly BlockDefinition[] = readonly [],
>(config: CmsConfig<Collections, Locale, Plugins, Blocks>): CmsConfig<Collections, Locale, Plugins, Blocks>;
export function defineSite(
	input:
		| CmsConfig<CollectionsConfig, string, readonly Plugin[], readonly BlockDefinition[]>
		| (SchemaCmsConfig & { readonly schema: unknown }),
): CmsConfig {
	return buildSite(input);
}

/**
 * `defineSite` with a lowest layer under the config: `defaults.site` is what the file's and the code's `site` settings are laid over (the server's `defineConfig` passes
 * the `SITE_URL` variable this way, so the environment is the weakest source of the site URL).
 */
export function buildSite(input: object, defaults: ConfigDefaults = {}): CmsConfig {
	const withSchema = "schema" in input && (input as { schema?: unknown }).schema !== undefined;
	const config = (withSchema
		? resolveSchemaConfig(input as { readonly schema: unknown }, defaults)
		: layerSite(input as Record<string, unknown>, defaults)) as unknown as CmsConfig;
	// Also accepts definitions written without `defineCollection`. The core only reads the normalized `kind`.
	const collections = isRecord(config.collections)
		? Object.fromEntries(
				Object.entries(config.collections).map(([name, schema]) => [name, normalizeCollection(schema)]),
			)
		: config.collections;
	const normalized = { ...config, collections } as CmsConfig;
	throwIssues(CONFIG_SOURCE, checkConfig(normalized, defaults.alsoKnown));
	if (withSchema) {
		const schemaInput = input as SchemaCmsConfig & { readonly schema: unknown };
		// Hidden: lets an instance rebuild the config with another schema (see `schema-file/source.ts`).
		Object.defineProperty(normalized, SCHEMA_SOURCE, {
			value: {
				rebuild: (schema: unknown) => buildSite({ ...schemaInput, schema }, defaults),
			},
		});
	}
	return normalized;
}
