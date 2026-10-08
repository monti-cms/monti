import { definePlugin } from "@monti-cms/core";
import type { WriteHooks } from "@monti-cms/core/server";

/** Lowercase ASCII letters and digits, with single hyphens between them: `hello-world`, `react-19`. */
const LOWERCASE_ASCII_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Write hook: a slug must be lowercase ASCII. Put it in `hooks` of `defineConfig`, or in a plugin ({@link slugRulePlugin}).
 * `validate` runs on every create, save and publish, after core has prepared the data, and can only add failures, so the rule cannot be
 * bypassed by a format import, the AI plugin or a bulk change: they all go through the same pipeline.
 */
export const slugRule: WriteHooks = {
	validate: ({ collection, slug }) => {
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
};

/**
 * The other choice: fix the slug instead of refusing it. `transform` runs first, before core prepares the data, and returns the data to prepare
 * (leave `slug` out to keep it). Use both hooks together to fix what can be fixed and refuse the rest.
 */
export const lowercaseSlugs: WriteHooks = {
	transform: ({ collection, slug, metadata, doc }) =>
		collection === "post" && slug !== null ? { metadata, doc, slug: slug.toLowerCase() } : undefined,
};

/**
 * The same rules as a plugin, which is how a package ships them: `plugins: [slugRulePlugin()]`. The hooks are written inline, with no `server` module,
 * because they are light (no network client, no heavy import): inline hooks load with every server start, the CLI and cold starts included.
 * A plugin whose hooks are heavy, or that has routes, migrations, commands or checks, puts them in a lazy `server` module instead (see the Slack recipe).
 */
export const slugRulePlugin = () => definePlugin({ name: "slug-rule", hooks: { ...lowercaseSlugs, ...slugRule } });
