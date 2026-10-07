import { type CollectionSchema, findTitleField, SUMMARY_ROLE, valueWithRole } from "@monti-cms/core";
import { SEO_ROLES } from "./fields";

/** SEO values for the public page. Empty values are `undefined`. */
export interface SeoValues {
	/** Search title. Falls back to the title (the field with the `title` role) when empty. */
	readonly title?: string;
	/** Search description. Falls back to the summary role (`summary`) value when empty. */
	readonly description?: string;
	/** Share image (media ID). The site builds the public URL from the media storage. */
	readonly imageId?: string;
	/** Canonical URL. */
	readonly canonical?: string;
	/** Hide from search engines. */
	readonly noindex: boolean;
}

const filled = (value: string) => value.trim() || undefined;

/**
 * Reads SEO values from a collection definition (the result of `defineCollection`) and stored metadata. Fields are found by role, not by name, so
 * renaming them with `seoFields({ keys })` changes nothing. An empty title or description is filled from the title or summary.
 *
 * ```ts
 * const seo = seoOf(post, entry.metadata);
 * ```
 */
export function seoOf(
	schema: Pick<CollectionSchema, "fields">,
	metadata: { readonly [key: string]: unknown },
): SeoValues {
	const role = (name: string) => filled(valueWithRole(schema, name, metadata));
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
