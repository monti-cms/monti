import type { BeforeSave, BeforeValidate } from "@monti-cms/core/server";

const LOWERCASE_ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `entry.beforeSave` may block the write: it adds a failure for a slug that is not lowercase ASCII. */
export const refuseBadSlug: BeforeSave = ({ collection, slug }) => {
	if (collection !== "post" || slug === null || LOWERCASE_ASCII_SLUG.test(slug)) return;
	return {
		issues: [
			{
				code: "slug_not_lowercase_ascii",
				path: "slug", // the field the editor shows the message under
				message: `The slug "${slug}" must use only lowercase a-z, digits and single hyphens (for example "hello-world").`,
			},
		],
	};
};

/** `entry.beforeValidate` may change the data: it lowercases the slug first, so only what lowercasing cannot fix is refused. Leave `slug` out of the result to keep it. */
export const lowercaseSlug: BeforeValidate = ({ collection, slug, metadata, doc }) =>
	collection === "post" && slug !== null ? { metadata, doc, slug: slug.toLowerCase() } : undefined;
