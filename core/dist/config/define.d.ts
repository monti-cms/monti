import { type CodeBlockConfig } from "../annotation/code-block/line-effects.js";
import type { BlockDefinition } from "../blocks/define.js";
import { type MediaConfig } from "../core/media-types.js";
import type { StoredDocument } from "../doc/stored-document.js";
import type { MessageValue } from "../i18n/define.js";
import type { CmsPlugin } from "../plugin/define.js";
import { type CollectionSchema } from "../schema/collection.js";
import type { SchemaCollectionsOf, SchemaInput, SchemaLocalesOf } from "../schema-file/types.js";
import { DEFAULT_ADMIN_PATH, isAdminPath, LOCALE_PREFIX_MODES, type LocalePrefixMode } from "./rules.js";
/**
 * Site config (`cms.config.ts`) schema. Each site lists its collections and locales here, wraps them in `defineSite`, and exports the result as the default export.
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
/**
 * A body template of the seed: its fixed `id` and `name`, and the body as a stored document (`doc`) or as text in a format (`body` and the `format` that reads it;
 * the format must be one the instance has, so a plugin provides it). Text is read when the migration runs.
 */
export type SeedTemplate = {
    /** Fixed ID (UUID). Running the migration repeatedly still creates only one such template. */
    readonly id: string;
    readonly name: string;
} & ({
    readonly doc: StoredDocument;
    readonly body?: undefined;
    readonly format?: undefined;
} | {
    readonly body: string;
    readonly format: string;
    readonly doc?: undefined;
});
export interface SeedConfig {
    /**
     * Body template inserted only once, at the first migration of a new store. Templates added later are not inserted into a store that already has them,
     * and deleted templates are not revived.
     */
    readonly templates?: readonly SeedTemplate[];
}
export interface CmsConfig<Collections extends CollectionsConfig = CollectionsConfig, Locale extends string = string, Plugins extends readonly CmsPlugin[] = readonly CmsPlugin[], Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[]> {
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
/**
 * Can two public URL rules (of the form `/posts/:slug`) produce the same URL? If so, a body link cannot tell which collection it points to.
 * A slug lives within a single `/`-free segment, so the rules collide when the segment counts match and every segment can match:
 * literal segments must be equal; a slug segment (`prefix:slugsuffix`) matches a literal segment if the literal starts and ends with that prefix and suffix (the slug needs at least one character);
 * two slug segments can match if one prefix starts with the other and one suffix ends with the other.
 */
export declare function pathsOverlap(a: string, b: string): boolean;
export { DEFAULT_ADMIN_PATH, isAdminPath };
/**
 * The config of a site that keeps its plain data in a schema file (`monti.schema.json`): the same options as {@link CmsConfig}, plus `schema`, and without the
 * collections' and locales' own place (they come from the file; `collections` here adds collections written in code).
 */
export interface SchemaCmsConfig<Schema extends SchemaInput = SchemaInput, Collections extends CollectionsConfig = CollectionsConfig, Plugins extends readonly CmsPlugin[] = readonly CmsPlugin[], Blocks extends readonly BlockDefinition[] = readonly BlockDefinition[]> extends Omit<CmsConfig<Collections, string, Plugins, Blocks>, "collections" | "locales" | "defaultLocale"> {
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
export declare function defineSite<const Schema extends SchemaInput, const Collections extends CollectionsConfig = Record<never, never>, const Plugins extends readonly CmsPlugin[] = readonly [], const Blocks extends readonly BlockDefinition[] = readonly []>(config: SchemaCmsConfig<Schema, Collections, Plugins, Blocks>): CmsConfig<SchemaCollectionsOf<Schema> & Collections, SchemaLocalesOf<Schema>, Plugins, Blocks>;
export declare function defineSite<const Collections extends CollectionsConfig, const Locale extends string, const Plugins extends readonly CmsPlugin[] = readonly [], const Blocks extends readonly BlockDefinition[] = readonly []>(config: CmsConfig<Collections, Locale, Plugins, Blocks>): CmsConfig<Collections, Locale, Plugins, Blocks>;
