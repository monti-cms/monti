import { localizePathWith } from "./locales.js";
import { fillPattern, matchPattern } from "./path-pattern.js";
/**
 * Preview URL rules that do not read the config. The query style (`param` is the name) adds the locale only for non-default locales,
 * and the path style (`param: false`) puts `localePrefix` (that locale's public URL prefix) before the public path.
 */
export function previewHrefWith(options) {
    const base = options.previewPath.replace(/\/$/, "");
    if (options.param === false)
        return `${base}${localizePathWith(options.localePrefix, options.path)}`;
    const { locale } = options;
    const query = locale && locale !== options.defaultLocale ? `?${options.param}=${encodeURIComponent(locale)}` : "";
    return `${base}${options.path}${query}`;
}
/** The link rules of a site config: the public paths of its collections, the site's own addresses and its preview URLs. */
export function createLinks(config, parts) {
    const { collections, schemas, locales } = parts;
    const PATH_RULES = collections.COLLECTIONS.flatMap((collection) => {
        const path = schemas.schemaOf(collection).path;
        if (!path)
            return [];
        return [{ collection, pattern: path }];
    });
    /** Collections a body link can point to (collections with `path`). */
    const LINKABLE_COLLECTIONS = PATH_RULES.map((rule) => rule.collection);
    /**
     * Public path of a content item (default locale). `null` if the collection has no path or there is no slug.
     * Hangul is left as is so it stays readable; only characters that break Markdown links are encoded.
     */
    function contentPath(collection, slug) {
        const rule = PATH_RULES.find((candidate) => candidate.collection === collection);
        if (!rule || !slug)
            return null;
        return fillPattern(rule.pattern, slug.replace(/[\s()<>]/g, (char) => encodeURIComponent(char)));
    }
    const matchPath = (pathname) => {
        for (const { collection, pattern } of PATH_RULES) {
            const encoded = matchPattern(pattern, pathname);
            if (encoded === null)
                continue;
            let slug;
            try {
                slug = decodeURIComponent(encoded).normalize("NFC");
            }
            catch {
                return null;
            }
            return slug && !slug.includes("/") ? { collection, slug } : null;
        }
        return null;
    };
    /**
     * The content a path (`URL.pathname`) points to. `null` for an unknown path. A path with the locale prefix of the site's URLs (`/en/posts/a`, as the public
     * page shows it) names the same content in that language: `locale` is then the language of the prefix. A path without one has no `locale` (the default language).
     */
    function parseContentPath(pathname) {
        const plain = matchPath(pathname);
        if (plain)
            return plain;
        for (const code of locales.LOCALES) {
            const prefix = locales.localePrefix(code);
            if (!prefix || !pathname.startsWith(`${prefix}/`))
                continue;
            const found = matchPath(pathname.slice(prefix.length));
            if (found)
                return { ...found, locale: code };
        }
        return null;
    }
    const siteUrl = config.site?.url;
    const SITE_HOSTS = new Set([siteUrl ? new URL(siteUrl).hostname : undefined, ...(config.site?.aliases ?? [])].filter((host) => Boolean(host)));
    /** The target if a body link address points to this site's content. Only links written as a path (`/...`) or with the site address are recognized. */
    function parseInternalLink(url) {
        let parsed;
        try {
            parsed = new URL(url, siteUrl ?? "http://localhost");
        }
        catch {
            return null;
        }
        const relative = url.startsWith("/") && !url.startsWith("//");
        const sameSite = (url.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(url)) &&
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            SITE_HOSTS.has(parsed.hostname);
        if (!relative && !sameSite)
            return null;
        const target = parseContentPath(parsed.pathname);
        return target ? { ...target, url } : null;
    }
    /** Site name shown in the admin screen (`site.name`, or the host name of `site.url` if absent). Empty string if neither exists. */
    const SITE_NAME = config.site?.name ?? (siteUrl ? new URL(siteUrl).hostname : "");
    /** Query name used to pass the locale in preview URLs (`site.previewLocaleParam`, default `locale`). If `false`, put it in the path. */
    const PREVIEW_LOCALE_PARAM = config.site?.previewLocaleParam ?? "locale";
    /** Draft preview URL. `null` if there is no preview path (`site.previewPath`) or collection public path. */
    function previewHref(collection, slug, locale) {
        const previewPath = config.site?.previewPath;
        const path = slug ? contentPath(collection, encodeURIComponent(slug)) : null;
        if (!previewPath || !path)
            return null;
        return previewHrefWith({
            previewPath,
            path,
            locale,
            defaultLocale: config.defaultLocale,
            param: PREVIEW_LOCALE_PARAM,
            localePrefix: locales.localePrefix(locale ?? config.defaultLocale),
        });
    }
    /** Why {@link previewHref} gives `null` (checked in the order the user fixes them): no `site.previewPath`, no public path for the collection, or no slug yet. `null` when the preview works. */
    function previewBlocker(collection, slug) {
        if (!config.site?.previewPath)
            return "no-preview-path";
        if (!PATH_RULES.some((rule) => rule.collection === collection))
            return "no-public-page";
        return slug ? null : "no-slug";
    }
    return {
        LINKABLE_COLLECTIONS,
        previewBlocker,
        contentPath,
        parseContentPath,
        parseInternalLink,
        SITE_NAME,
        PREVIEW_LOCALE_PARAM,
        previewHref,
    };
}
