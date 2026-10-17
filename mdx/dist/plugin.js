import { definePlugin, IssueList, pathOf } from "@monti-cms/core";
import { MDX_PLUGIN_NAME } from "./name.js";
export { MDX_PLUGIN_NAME };
/** The MDX plugin with the type of its options (`site.pluginOptions(MDX_PLUGIN)`). */
export const MDX_PLUGIN = { name: MDX_PLUGIN_NAME };
/** The problems of the options: every extension has a name, and no name is listed twice. */
export const checkMdxOptions = (options) => {
    const list = new IssueList();
    const names = (options?.syntax ?? []).map((extension) => extension.name);
    for (const [index, name] of names.entries()) {
        const at = pathOf("plugins", MDX_PLUGIN_NAME, "options", "syntax", index);
        if (!name)
            list.add(at, "name", "every syntax extension needs a name");
        else if (names.indexOf(name) !== index)
            list.add(at, "duplicate", `"${name}" is listed twice`);
    }
    return list.issues;
};
/**
 * MDX as a format of the CMS (`@monti-cms/mdx`). Add it to the site config `plugins`.
 *
 * - the `mdx` format: `format: "mdx"` on the read and write APIs, `?format=mdx` on the export and the HTTP API, and the text the AI plugin's model reads and writes;
 * - the source panel of the admin: edit a body as MDX text, checked as it is typed.
 *
 * ```ts
 * plugins: [mdx({ syntax: [directiveSyntax()] })]
 * ```
 */
export const mdx = (options = {}) => {
    return definePlugin({
        name: MDX_PLUGIN_NAME,
        options,
        checkConfig: () => checkMdxOptions(options),
        // The format is read on the server only: the parser stays out of the browser bundle (`@monti-cms/mdx/server` is empty there).
        server: () => import("@monti-cms/mdx/server"),
        admin: () => import("@monti-cms/mdx/admin"),
    });
};
