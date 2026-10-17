import type { WriteHooks } from "@monti-cms/core/server";

const LOWERCASE_ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugRule: WriteHooks = {
	validate: [
		({ collection, slug }) => {
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
		},
	],
};

// Fix instead of refusing: `transform` runs first and returns the data to prepare (leave `slug` out to keep it).
export const lowercaseSlugs: WriteHooks = {
	transform: [
		({ collection, slug, metadata, doc }) =>
			collection === "post" && slug !== null ? { metadata, doc, slug: slug.toLowerCase() } : undefined,
	],
};
