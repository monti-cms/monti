import { type Collection } from "./collections.js";
/** Collections a body link can point to (collections with `path`). */
export declare const LINKABLE_COLLECTIONS: readonly Collection[];
/**
 * Public path of a content item (default locale). `null` if the collection has no path or there is no slug.
 * Hangul is left as is so it stays readable; only characters that break Markdown links are encoded.
 */
export declare function contentPath(collection: string, slug: string | null | undefined): string | null;
/** The content a path (`URL.pathname`) points to. `null` for an unknown path. */
export declare function parseContentPath(pathname: string): {
    collection: Collection;
    slug: string;
} | null;
/** The target if a body link address points to this site's content. Only links written as a path (`/...`) or with the site address are recognized. */
export declare function parseInternalLink(url: string): {
    collection: Collection;
    slug: string;
    url: string;
} | null;
/** Site name shown in the admin screen (`site.name`, or the host name of `site.url` if absent). Empty string if neither exists. */
export declare const SITE_NAME: string;
/** Query name used to pass the locale in preview URLs (`site.previewLocaleParam`, default `locale`). If `false`, put it in the path. */
export declare const PREVIEW_LOCALE_PARAM: string | false;
/**
 * Preview URL rules that do not read the config. The query style (`param` is the name) adds the locale only for non-default locales,
 * and the path style (`param: false`) puts `localePrefix` (that locale's public URL prefix) before the public path.
 */
export declare function previewHrefWith(options: {
    readonly previewPath: string;
    readonly path: string;
    readonly locale?: string;
    readonly defaultLocale: string;
    readonly param: string | false;
    readonly localePrefix: string;
}): string;
/** Draft preview URL. `null` if there is no preview path (`site.previewPath`) or collection public path. */
export declare function previewHref(collection: string, slug: string | null | undefined, locale?: string): string | null;
