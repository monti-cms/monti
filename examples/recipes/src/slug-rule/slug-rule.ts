import type { WriteHooks } from "@monti-cms/core/server";

/** Lowercase ASCII letters and digits, with single hyphens between them: `hello-world`, `react-19`. */
const LOWERCASE_ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Write hook: a slug must be lowercase ASCII. Put it in `hooks` of `defineConfig` (or in the `hooks` of a plugin's server side).
 * `validate` runs on every create, save and publish, after core has prepared the data, and can only add failures, so the rule cannot be
 * bypassed by a format import, the AI plugin or a bulk change: they all go through the same pipeline.
 */
export const slugRule: WriteHooks = {
	validate: ({ collection, snapshot }) => {
		if (collection !== "post" || snapshot.slug === null || LOWERCASE_ASCII_SLUG.test(snapshot.slug)) return;
		return {
			issues: [
				{
					code: "slug_not_lowercase_ascii",
					path: "slug",
					message: `The slug "${snapshot.slug}" must use only lowercase a-z, digits and single hyphens (for example "hello-world").`,
				},
			],
		};
	},
};
