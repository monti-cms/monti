import type { CmsConfig } from "../config/define.js";
import type { SiteSchemas } from "../schema/derive.js";
import type { Collection, SiteCollections } from "./collections.js";
import { type SiteLocales } from "./locales.js";
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
/** The body links and URLs of one site. */
export type SiteLinks = ReturnType<typeof createLinks>;
/** The link rules of a site config: the public paths of its collections, the site's own addresses and its preview URLs. */
export declare function createLinks(config: Pick<CmsConfig, "site" | "defaultLocale">, parts: {
    readonly collections: Pick<SiteCollections, "COLLECTIONS">;
    readonly schemas: Pick<SiteSchemas, "schemaOf">;
    readonly locales: Pick<SiteLocales, "LOCALES" | "localePrefix">;
}): {
    LINKABLE_COLLECTIONS: readonly string[];
    contentPath: (collection: string, slug: string | null | undefined) => string | null;
    parseContentPath: (pathname: string) => {
        collection: Collection;
        slug: string;
        locale?: string;
    } | null;
    parseInternalLink: (url: string) => {
        collection: Collection;
        slug: string;
        locale?: string;
        url: string;
    } | null;
    SITE_NAME: string;
    PREVIEW_LOCALE_PARAM: string | false;
    previewHref: (collection: string, slug: string | null | undefined, locale?: string) => string | null;
};
