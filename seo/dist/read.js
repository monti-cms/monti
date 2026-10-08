import { findTitleField, SUMMARY_ROLE, valueWithRole } from "@monti-cms/core";
import { SEO_ROLES } from "./fields.js";
const filled = (value) => value.trim() || undefined;
/**
 * Reads SEO values from a collection definition (the result of `defineCollection`) and stored metadata. Fields are found by role, not by name, so
 * renaming them with `seoFields({ keys })` changes nothing. An empty title or description is filled from the title or summary.
 *
 * ```ts
 * const seo = seoOf(post, entry.metadata);
 * ```
 */
export function seoOf(schema, metadata) {
    const role = (name) => filled(valueWithRole(schema, name, metadata));
    const titleName = findTitleField(schema)?.name;
    const titleValue = titleName === undefined ? undefined : metadata[titleName];
    const title = role(SEO_ROLES.title) ?? (typeof titleValue === "string" ? filled(titleValue) : undefined);
    const description = role(SEO_ROLES.description) ?? role(SUMMARY_ROLE);
    const imageId = role(SEO_ROLES.image);
    const canonical = role(SEO_ROLES.canonical);
    return {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(imageId ? { imageId } : {}),
        ...(canonical ? { canonical } : {}),
        noindex: role(SEO_ROLES.noindex) === "noindex",
    };
}
