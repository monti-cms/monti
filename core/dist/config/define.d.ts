import { type CodeBlockConfig } from "../annotation/code-block/line-effects.js";
import type { BlockDefinition } from "../blocks/define.js";
import { type MediaConfig } from "../core/media-types.js";
import type { MessageValue } from "../i18n/define.js";
import type { CmsPlugin } from "../plugin/define.js";
import { type CollectionSchema } from "../schema/collection.js";
/**
 * Site config (`cms.config.ts`) schema. Each site lists its collections and locales here, wraps them in `defineConfig`, and exports the result as the default export.
 *
 * The config is read by both the server and the admin UI (browser), so it holds **only JSON-serializable values**.
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
/** How public URLs get a locale prefix (`site.localePrefix`). */
export type LocalePrefixMode = "except-default" | "always" | "never";
export declare const LOCALE_PREFIX_MODES: readonly LocalePrefixMode[];
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
     * Name of the legacy browser recovery DB (IndexedDB). The admin UI still reads and deletes recovery copies left under this name but never creates new ones.
     * The current name is `cms_backup`. Only sites that used the old name need to set this.
     */
    readonly legacyBackupNames?: readonly string[];
}
export interface SeedTemplate {
    /** Fixed ID (UUID). Running the migration repeatedly still creates only one such template. */
    readonly id: string;
    readonly name: string;
    readonly mdx: string;
}
export interface SeedConfig {
    /**
     * Body template inserted only once, at the first migration of a new store. Templates added later are not inserted into a store that already has them,
     * and deleted templates are not revived.
     */
    readonly templates?: readonly SeedTemplate[];
}
export interface CmsConfig<Collections extends CollectionsConfig = CollectionsConfig, Locale extends string = string, Plugins extends readonly CmsPlugin[] = readonly CmsPlugin[]> {
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
    /**
     * Body blocks the site adds (`defineBlock`). Blocks such as callouts and tabs are added by putting the block extension (`@monti-cms/blocks`) in `plugins`.
     * The public site renders them by the `component` name.
     */
    readonly blocks?: readonly BlockDefinition[];
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
/** Default admin UI path (when `admin.path` is unset). */
export declare const DEFAULT_ADMIN_PATH = "/admin";
/** Admin path shape: a path of one or more segments starting with `/` (no trailing `/`), and not under `/api`. */
export declare const isAdminPath: (path: string) => boolean;
/** Defines the site config. Preserves collection and locale names as types and reports inconsistent config right away. */
export declare function defineConfig<const Collections extends CollectionsConfig, const Locale extends string, const Plugins extends readonly CmsPlugin[] = readonly []>(config: CmsConfig<Collections, Locale, Plugins>): CmsConfig<Collections, Locale, Plugins>;
