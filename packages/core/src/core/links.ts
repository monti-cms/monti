import { cmsConfig } from "../config/resolved";
import { schemaOf } from "../schema/derive";
import { COLLECTIONS, type Collection } from "./collections";
import { LOCALES, localePrefix, localizePathWith } from "./locales";

/**
 * Internal body links. The public URL shape is the collection definition's `path` (e.g. `/posts/:slug`), and the body stores plain Markdown links
 * like `[title](/posts/post-slug)`. Pre-publish validation (link resolution) and the editor (link creation) use the same rules.
 */

interface PathRule {
	readonly collection: Collection;
	readonly prefix: string;
	readonly suffix: string;
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PATH_RULES: readonly PathRule[] = COLLECTIONS.flatMap((collection) => {
	const path = schemaOf(collection).path;
	if (!path) return [];
	const [prefix = "", suffix = ""] = path.split(":slug");
	return [{ collection, prefix, suffix }];
});

const PATH_PATTERNS = PATH_RULES.map((rule) => ({
	collection: rule.collection,
	pattern: new RegExp(`^${escapeRegExp(rule.prefix)}([^/]+)${escapeRegExp(rule.suffix.replace(/\/$/, ""))}\\/?$`),
}));

/** Collections a body link can point to (collections with `path`). */
export const LINKABLE_COLLECTIONS: readonly Collection[] = PATH_RULES.map((rule) => rule.collection);

/**
 * Public path of a content item (default locale). `null` if the collection has no path or there is no slug.
 * Hangul is left as is so it stays readable; only characters that break Markdown links are encoded.
 */
export function contentPath(collection: string, slug: string | null | undefined): string | null {
	const rule = PATH_RULES.find((candidate) => candidate.collection === collection);
	if (!rule || !slug) return null;
	return `${rule.prefix}${slug.replace(/[\s()<>]/g, (char) => encodeURIComponent(char))}${rule.suffix}`;
}

const matchPath = (pathname: string): { collection: Collection; slug: string } | null => {
	for (const { collection, pattern } of PATH_PATTERNS) {
		const match = pattern.exec(pathname);
		if (!match) continue;
		let slug: string;
		try {
			slug = decodeURIComponent(match[1] ?? "").normalize("NFC");
		} catch {
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
export function parseContentPath(pathname: string): { collection: Collection; slug: string; locale?: string } | null {
	const plain = matchPath(pathname);
	if (plain) return plain;
	for (const code of LOCALES) {
		const prefix = localePrefix(code);
		if (!prefix || !pathname.startsWith(`${prefix}/`)) continue;
		const found = matchPath(pathname.slice(prefix.length));
		if (found) return { ...found, locale: code };
	}
	return null;
}

const siteUrl = cmsConfig.site?.url;
const SITE_HOSTS = new Set(
	[siteUrl ? new URL(siteUrl).hostname : undefined, ...(cmsConfig.site?.aliases ?? [])].filter((host): host is string =>
		Boolean(host),
	),
);

/** The target if a body link address points to this site's content. Only links written as a path (`/...`) or with the site address are recognized. */
export function parseInternalLink(
	url: string,
): { collection: Collection; slug: string; locale?: string; url: string } | null {
	let parsed: URL;
	try {
		parsed = new URL(url, siteUrl ?? "http://localhost");
	} catch {
		return null;
	}
	const relative = url.startsWith("/") && !url.startsWith("//");
	const sameSite =
		(url.startsWith("//") || /^[a-z][a-z\d+.-]*:/i.test(url)) &&
		(parsed.protocol === "http:" || parsed.protocol === "https:") &&
		SITE_HOSTS.has(parsed.hostname);
	if (!relative && !sameSite) return null;
	const target = parseContentPath(parsed.pathname);
	return target ? { ...target, url } : null;
}

/** Site name shown in the admin screen (`site.name`, or the host name of `site.url` if absent). Empty string if neither exists. */
export const SITE_NAME = cmsConfig.site?.name ?? (siteUrl ? new URL(siteUrl).hostname : "");

/** Query name used to pass the locale in preview URLs (`site.previewLocaleParam`, default `locale`). If `false`, put it in the path. */
export const PREVIEW_LOCALE_PARAM: string | false = cmsConfig.site?.previewLocaleParam ?? "locale";

/**
 * Preview URL rules that do not read the config. The query style (`param` is the name) adds the locale only for non-default locales,
 * and the path style (`param: false`) puts `localePrefix` (that locale's public URL prefix) before the public path.
 */
export function previewHrefWith(options: {
	readonly previewPath: string;
	readonly path: string;
	readonly locale?: string;
	readonly defaultLocale: string;
	readonly param: string | false;
	readonly localePrefix: string;
}): string {
	const base = options.previewPath.replace(/\/$/, "");
	if (options.param === false) return `${base}${localizePathWith(options.localePrefix, options.path)}`;
	const { locale } = options;
	const query = locale && locale !== options.defaultLocale ? `?${options.param}=${encodeURIComponent(locale)}` : "";
	return `${base}${options.path}${query}`;
}

/** Draft preview URL. `null` if there is no preview path (`site.previewPath`) or collection public path. */
export function previewHref(collection: string, slug: string | null | undefined, locale?: string): string | null {
	const previewPath = cmsConfig.site?.previewPath;
	const path = slug ? contentPath(collection, encodeURIComponent(slug)) : null;
	if (!previewPath || !path) return null;
	return previewHrefWith({
		previewPath,
		path,
		locale,
		defaultLocale: cmsConfig.defaultLocale,
		param: PREVIEW_LOCALE_PARAM,
		localePrefix: localePrefix(locale ?? cmsConfig.defaultLocale),
	});
}
