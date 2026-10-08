import { definePlugin } from "@monti-cms/core";
export const MDX_PLUGIN_NAME = "mdx";
/** Checks the options when the site config is created: every extension has a name, and no name is listed twice. */
export const validateMdxOptions = (options) => {
    const names = (options?.syntax ?? []).map((extension) => extension.name);
    if (names.some((name) => !name))
        throw new Error("cms.config: every `mdx({ syntax })` extension needs a name");
    if (new Set(names).size !== names.length)
        throw new Error("cms.config: `mdx({ syntax })` has duplicate names");
};
/**
 * MDX as a format of the CMS (`@monti-cms/mdx`). Add it to the site config `plugins`.
 *
 * - the `mdx` format: `format: "mdx"` on the read and write APIs, `?format=mdx` on the export and the HTTP API, and the text the AI plugin's model reads and writes;
 * - the source panel of the admin: edit a body as MDX text, checked as it is typed;
 * - the implementation of the store migrations that predate stored documents (`0012` to `0015`), which core only calls when an old store needs them.
 *
 * ```ts
 * plugins: [mdx({ syntax: [directiveSyntax()] })]
 * ```
 */
export const mdx = (options = {}) => {
    validateMdxOptions(options);
    return definePlugin({
        name: MDX_PLUGIN_NAME,
        options,
        validate: () => validateMdxOptions(options),
        formats: async () => {
            const { createServerMdxFormat } = await import("@monti-cms/mdx/server");
            return { default: createServerMdxFormat(options) };
        },
        admin: () => import("@monti-cms/mdx/admin"),
    });
};
