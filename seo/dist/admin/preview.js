"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "@monti-cms/admin/kit";
import { MediaThumbnail } from "@monti-cms/admin/media";
import { useSite, useTranslator } from "@monti-cms/core/client";
import { SEO_ROLES } from "../fields.js";
import { seoMessages } from "../messages.js";
const text = (value) => (typeof value === "string" ? value : "");
/**
 * Current value of a role field. In a translation, fields that are not per-language read the source value (the same as the properties panel showing the source value).
 */
export function seoRoleValue(site, collection, role, form, entry) {
    const stored = site.roleField(collection, role);
    if (!stored)
        return "";
    const common = Boolean(entry?.source) && !stored.field.localized;
    return text(common ? entry?.source?.metadata[stored.name] : form[stored.name]);
}
/** Title and description for the search result and share preview. Falls back to the title and summary when empty. */
export function seoPreviewText(site, collection, form, entry) {
    const value = (role) => seoRoleValue(site, collection, role, form, entry).trim();
    return {
        title: value(SEO_ROLES.title) || (site.titleOfValues(collection, form) ?? "").trim(),
        description: value(SEO_ROLES.description) || value("summary"),
    };
}
/** Preview shaped like a search result and a share card. Values come from the field roles. */
export function SeoPreview({ collection, form, entry, }) {
    const site = useSite();
    const t = useTranslator(seoMessages);
    const { title, description } = seoPreviewText(site, collection, form, entry);
    const noindex = seoRoleValue(site, collection, SEO_ROLES.noindex, form, entry) === "noindex";
    const hasImageField = Boolean(site.roleField(collection, SEO_ROLES.image));
    const imageId = seoRoleValue(site, collection, SEO_ROLES.image, form, entry);
    const locale = entry?.locale && site.isLocale(entry.locale) ? entry.locale : site.DEFAULT_LOCALE;
    const path = site.localizePath(locale, site.contentPath(collection, form.slug || "slug") ?? `/${form.slug || "slug"}`);
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("section", { "aria-label": t("preview.search"), className: "space-y-1 rounded-lg border bg-cms-muted/30 p-3", children: [_jsxs("p", { className: "truncate text-[11px] text-cms-muted-foreground", children: [site.SITE_NAME, path
                                .split("/")
                                .filter(Boolean)
                                .map((part) => ` › ${decodeURIComponent(part)}`)] }), _jsx("p", { className: "line-clamp-2 font-medium cms-dark:text-[#8ab4f8] text-[#1a0dab] text-sm leading-snug", children: title || t("preview.noTitle") }), _jsx("p", { className: cn("line-clamp-2 text-xs leading-relaxed", !description && "text-cms-muted-foreground italic"), children: description || t("preview.noDescription") }), noindex && (_jsx("p", { className: "pt-1 font-medium cms-dark:text-amber-400 text-[11px] text-amber-700", children: t("preview.hidden") }))] }), hasImageField && (_jsxs("section", { "aria-label": t("preview.share"), className: "overflow-hidden rounded-lg border", children: [imageId && _jsx(MediaThumbnail, { mediaId: imageId, className: "aspect-[1.91/1] w-full border-b" }), _jsxs("div", { className: "space-y-0.5 p-3", children: [_jsx("p", { className: "truncate text-[11px] text-cms-muted-foreground", children: site.SITE_NAME }), _jsx("p", { className: "line-clamp-2 font-medium text-sm leading-snug", children: title || t("preview.noTitle") }), description && (_jsx("p", { className: "line-clamp-2 text-cms-muted-foreground text-xs leading-relaxed", children: description }))] })] }))] }));
}
/** The view of the `search` view field. */
export function SeoPreviewView({ collection, form, entry }) {
    const site = useSite();
    return site.isCollection(collection) ? _jsx(SeoPreview, { collection: collection, form: form, entry: entry }) : null;
}
