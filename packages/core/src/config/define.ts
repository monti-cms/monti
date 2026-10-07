import { type CodeBlockConfig, validateCodeBlockConfig } from "../annotation/code-block/line-effects";
import { createBlocks } from "../blocks/active";
import type { BlockDefinition } from "../blocks/define";
import { resolveBlocks } from "../blocks/resolve";
import { type MediaConfig, validateMediaConfig } from "../core/media-types";
import type { StoredDocument } from "../doc/stored-document";
import type { MessageValue } from "../i18n/define";
import { assertPluginNamesFree, assertPluginPagesFree } from "../plugin/collisions";
import type { CmsPlugin } from "../plugin/define";
import { validateBodyAllowed } from "../schema/allowed";
import { type CollectionSchema, normalizeCollection, validateListColumns } from "../schema/collection";
import { RESERVED_METADATA_KEYS, SUMMARY_ROLE } from "../schema/fields";
import { valueFieldsOf } from "../schema/walk";
import { resolveSchemaConfig } from "../schema-file/merge";
import type { SchemaCollectionsOf, SchemaInput, SchemaLocalesOf } from "../schema-file/types";
import {
	DEFAULT_ADMIN_PATH,
	isAdminPath,
	isHomeHref,
	LOCALE_CODE,
	LOCALE_PREFIX_MODES,
	type LocalePrefixMode,
} from "./rules";

/**
 * Site config (`cms.config.ts`) schema. Each site lists its collections and locales here, wraps them in `defineConfig`, and exports the result as the default export.
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

export { LOCALE_PREFIX_MODES, type LocalePrefixMode };

export interface AdminConfig {
	/**
	 * Admin UI path. Default `/admin`. The app's admin route folder must use the same path
	 * (for `/studio`, `app/(admin)/studio/[[...path]]/page.tsx`). The admin API (`/api/cms/v1`) does not change.
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
	Plugins extends readonly CmsPlugin[] = readonly CmsPlugin[],
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
	/**
	 * The version of the schema (a whole number from 1, 1 if unset). Every entry written from now on records it (`entry_bodies.schema_version`), so a stored entry shows which
	 * schema it was written or transformed under. A site with a schema file keeps it there (`schemaVersion` of `monti.schema.json`), where `monti schema:apply` raises it
	 * when the schema changes. It is not part of an entry's content hash.
	 */
	readonly schemaVersion?: number;
	/** Admin UI settings. */
	readonly admin?: AdminConfig;
	/**
	 * Body blocks the site adds (`defineBlock`). Blocks such as callouts and tabs are added by putting the block extension (`@monti-cms/blocks`) in `plugins`.
	 * The public site renders them by the `component` name.
	 */
	readonly blocks?: Blocks;
	/** Plugins (e.g. `aiPlugin()`). Names must not collide. */
	readonly plugins?: Plugins;
	/** Code block settings. Adds line effects (`lineEffects`) or changes the core defaults (highlight, add, delete, warning, error). */
	readonly codeBlock?: CodeBlockConfig;
	/** Uploadable media formats and size limits. If unset, all supported formats, images up to 10MB and 40 megapixels, attachments up to 50MB. */
	readonly media?: MediaConfig;
}

const ROLE_NAME = /^[A-Za-z][A-Za-z0-9-]*$/;

/**
 * Can two public URL rules (of the form `/posts/:slug`) produce the same URL? If so, a body link cannot tell which collection it points to.
 * A slug lives within a single `/`-free segment, so the rules collide when the segment counts match and every segment can match:
 * literal segments must be equal; a slug segment (`prefix:slugsuffix`) matches a literal segment if the literal starts and ends with that prefix and suffix (the slug needs at least one character);
 * two slug segments can match if one prefix starts with the other and one suffix ends with the other.
 */
export function pathsOverlap(a: string, b: string): boolean {
	const segments = (path: string) => path.replace(/\/+$/, "").split("/");
	const left = segments(a);
	const right = segments(b);
	if (left.length !== right.length) return false;
	return left.every((x, index) => {
		const y = right[index] ?? "";
		const xs = x.split(":slug");
		const ys = y.split(":slug");
		if (xs.length === 1 && ys.length === 1) return x === y;
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
const checkTab = (at: string, tab: string | undefined) => {
	if (tab !== undefined && (!tab.trim() || tab.length > 20)) throw new Error(`${at}.tab must be 1-20 characters`);
};

/**
 * Checks that field roles (`role`), tabs (`tab`), fill-from-body (`fillFromBody`) and URL source (`from`) are consistent. A role is unique per collection,
 * and only the roles the core knows (`summary`) get their type checked. The type of other roles is checked in `validate` by the plugin that uses the role.
 */
function validateFieldMeanings(collection: string, schema: CollectionSchema): void {
	const roles = new Map<string, string>();
	for (const { name, field } of valueFieldsOf(schema)) {
		const role = field.role;
		if (role !== undefined) {
			if (!ROLE_NAME.test(role)) throw new Error(`cms.config: ${collection}.${name} has an invalid role "${role}"`);
			if (role === SUMMARY_ROLE && field.kind !== "text") {
				throw new Error(`cms.config: ${collection}.${name} role "${role}" needs a text field`);
			}
			const other = roles.get(role);
			if (other) throw new Error(`cms.config: ${collection} has role "${role}" on both ${other} and ${name}`);
			roles.set(role, name);
		}
		if (RESERVED_METADATA_KEYS.includes(name)) {
			throw new Error(`cms.config: ${collection}.${name} uses a reserved name; rename the field`);
		}
		if (field.required !== undefined && field.required !== true) {
			throw new Error(
				`cms.config: ${collection}.${name} has required: ${JSON.stringify(field.required)}; only \`required: true\` exists (the old "publish" value was removed)`,
			);
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
		if (field.kind !== "slug" || field.from === undefined) continue;
		if (schema.fields[field.from]?.kind !== "text") {
			throw new Error(`cms.config: ${collection}.${name} is made from "${field.from}", which is not a text field`);
		}
	}
}

export { DEFAULT_ADMIN_PATH, isAdminPath };

/** Checks that the config is consistent. Reports an error right away when the app starts if it is not. */
function validate(
	config: CmsConfig<CollectionsConfig, string, readonly CmsPlugin[], readonly BlockDefinition[]>,
): void {
	const names = Object.keys(config.collections);
	if (names.length === 0) throw new Error("cms.config: `collections` is empty");

	const codes = config.locales.map((locale) => locale.code);
	if (codes.length === 0) throw new Error("cms.config: `locales` is empty");
	if (new Set(codes).size !== codes.length) throw new Error("cms.config: `locales` has duplicate codes");
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
		let url: URL | undefined;
		try {
			url = new URL(config.site.url);
		} catch {}
		if (url?.protocol !== "http:" && url?.protocol !== "https:") {
			throw new Error(`cms.config: site.url "${config.site.url}" is not an http(s) URL`);
		}
	}

	if (config.timeZone !== undefined) {
		try {
			new Intl.DateTimeFormat("en-US", { timeZone: config.timeZone });
		} catch {
			throw new Error(`cms.config: timeZone "${config.timeZone}" is not an IANA time zone`);
		}
	}

	if (config.admin?.path !== undefined && !isAdminPath(config.admin.path)) {
		throw new Error(
			`cms.config: admin.path "${config.admin.path}" must be a path like "/admin" (not "/" and not under "/api")`,
		);
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
		throw new Error(
			"cms.config: admin.legacyBackupNames was removed; delete it (the admin UI only uses the `cms_backup` recovery database)",
		);
	}

	if (config.admin?.locale !== undefined) {
		try {
			new Intl.DateTimeFormat(config.admin.locale);
		} catch {
			throw new Error(`cms.config: admin.locale "${config.admin.locale}" is not a valid locale`);
		}
	}

	if (config.schemaVersion !== undefined && (!Number.isInteger(config.schemaVersion) || config.schemaVersion < 1)) {
		throw new Error(`cms.config: schemaVersion must be a whole number from 1 (got ${String(config.schemaVersion)})`);
	}

	const templateIds = new Set<string>();
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
		if (
			asDocument === asText ||
			(asText && (typeof template.body !== "string" || typeof template.format !== "string"))
		) {
			throw new Error(
				`cms.config: seed template "${template.name}" needs either \`doc\` or both \`body\` and \`format\``,
			);
		}
	}

	const paths = new Map<string, string>();
	for (const [collection, schema] of Object.entries(config.collections)) {
		// Library contract: the title field is named `title` (its label is free). The list, search, relation picker, body links and the editor's title input use it.
		if (schema.fields.title?.kind !== "text") {
			throw new Error(`cms.config: ${collection} needs a "title" text field (fields.text)`);
		}
		// A content item has a single URL (the store has one URL column). A second URL field would go unused, so it is rejected as a config error.
		const slugFields = Object.entries(schema.fields).filter(([, field]) => field.kind === "slug");
		if (slugFields.length > 1) {
			throw new Error(
				`cms.config: ${collection} has more than one slug field (${slugFields.map(([name]) => name).join(", ")}); a collection can have only one`,
			);
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
					throw new Error(
						`cms.config: ${collection}.path "${path}" can make the same URL as ${other}.path "${otherPath}"`,
					);
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
			if (field.kind !== "backlink") continue;
			const source = config.collections[field.from];
			if (!source) throw new Error(`cms.config: ${collection}.${name} links from unknown collection "${field.from}"`);
			const via = valueFieldsOf(source).find((stored) => stored.name === field.via)?.field;
			if (via?.kind !== "relation" || !via.many || via.to !== collection) {
				throw new Error(
					`cms.config: ${collection}.${name} needs ${field.from}.${field.via} to be a many relation to "${collection}"`,
				);
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
	if (new Set(pluginNames).size !== pluginNames.length) throw new Error("cms.config: `plugins` has duplicate names");
	assertPluginNamesFree(pluginNames);
	assertPluginPagesFree(
		plugins.flatMap((plugin) => (plugin.nav ?? []).map((item) => ({ plugin: plugin.name, path: item.path }))),
	);
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

/**
 * The config of a site that keeps its plain data in a schema file (`monti.schema.json`): the same options as {@link CmsConfig}, plus `schema`, and without the
 * collections' and locales' own place (they come from the file; `collections` here adds collections written in code).
 */
export interface SchemaCmsConfig<
	Schema extends SchemaInput = SchemaInput,
	Collections extends CollectionsConfig = CollectionsConfig,
	Plugins extends readonly CmsPlugin[] = readonly CmsPlugin[],
	Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[],
> extends Omit<CmsConfig<Collections, string, Plugins, Blocks>, "collections" | "locales" | "defaultLocale"> {
	/**
	 * The schema file: its parsed content (`import schema from "./monti.schema.json"`), or its path (read at run time, relative to the working directory).
	 * Collections, fields, layouts, locales, the default locale, the time zone, site and admin settings and seed templates come from it. The code config adds
	 * what needs code (`plugins`, `blocks`, `codeBlock`, `media`) and may override the environment-specific `site`, `admin` and `timeZone` values.
	 */
	readonly schema: Schema | string;
	/** Collections written in code, next to the file's. A name the file also has is an error. */
	readonly collections?: Collections;
	/** Set in the schema file only. */
	readonly locales?: never;
	/** Set in the schema file only. */
	readonly defaultLocale?: never;
	/** Set in the schema file only (`monti schema:apply` raises it there). */
	readonly schemaVersion?: never;
}

/**
 * Defines the site config. Preserves collection and locale names as types and reports inconsistent config right away.
 *
 * With a `schema` (the plain-data part of the config in `monti.schema.json`), the config is the file merged with what is written here; see {@link SchemaCmsConfig}.
 * The collection and locale names and the metadata types come from the generated types of the file (`monti schema:types`), or from the file's content when
 * it is written in code with literal types.
 */
export function defineConfig<
	const Schema extends SchemaInput,
	const Collections extends CollectionsConfig = Record<never, never>,
	const Plugins extends readonly CmsPlugin[] = readonly [],
	const Blocks extends readonly BlockDefinition[] = readonly [],
>(
	config: SchemaCmsConfig<Schema, Collections, Plugins, Blocks>,
): CmsConfig<SchemaCollectionsOf<Schema> & Collections, SchemaLocalesOf<Schema>, Plugins, Blocks>;
export function defineConfig<
	const Collections extends CollectionsConfig,
	const Locale extends string,
	const Plugins extends readonly CmsPlugin[] = readonly [],
	const Blocks extends readonly BlockDefinition[] = readonly [],
>(config: CmsConfig<Collections, Locale, Plugins, Blocks>): CmsConfig<Collections, Locale, Plugins, Blocks>;
export function defineConfig(
	input:
		| CmsConfig<CollectionsConfig, string, readonly CmsPlugin[], readonly BlockDefinition[]>
		| (SchemaCmsConfig & { readonly schema: unknown }),
): CmsConfig {
	const config = (
		"schema" in input && input.schema !== undefined ? resolveSchemaConfig(input as { readonly schema: unknown }) : input
	) as CmsConfig;
	// Also accepts definitions written without `defineCollection`. The core only reads the normalized `kind`.
	const collections = Object.fromEntries(
		Object.entries(config.collections).map(([name, schema]) => [name, normalizeCollection(schema)]),
	);
	const normalized = { ...config, collections };
	validate(normalized);
	return normalized;
}
