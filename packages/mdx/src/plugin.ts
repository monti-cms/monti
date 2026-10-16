import { type ConfigIssue, definePlugin, IssueList, pathOf } from "@monti-cms/core";
import { MDX_PLUGIN_NAME } from "./name";
import type { SyntaxExtension } from "./syntax/types";

export { MDX_PLUGIN_NAME };

export interface MdxPluginOptions {
	/**
	 * Syntax extensions, in precedence order for writing. Stored MDX is CommonMark + GFM + standard MDX JSX; an extension adds a notation (for example
	 * `directiveSyntax()` from `@monti-cms/syntax-directive` for `:::callout`). Content written in an extension's notation is read only while the extension is listed.
	 *
	 * @experimental
	 */
	readonly syntax?: readonly SyntaxExtension[];
}

/** The problems of the options: every extension has a name, and no name is listed twice. */
export const checkMdxOptions = (options: MdxPluginOptions | undefined): ConfigIssue[] => {
	const list = new IssueList();
	const names = (options?.syntax ?? []).map((extension) => extension.name);
	for (const [index, name] of names.entries()) {
		const at = pathOf("plugins", MDX_PLUGIN_NAME, "options", "syntax", index);
		if (!name) list.add(at, "name", "every syntax extension needs a name");
		else if (names.indexOf(name) !== index) list.add(at, "duplicate", `"${name}" is listed twice`);
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
export const mdx = (options: MdxPluginOptions = {}) => {
	return definePlugin({
		name: MDX_PLUGIN_NAME,
		options,
		checkConfig: () => checkMdxOptions(options),
		// The format is read on the server only: the parser stays out of the browser bundle (`@monti-cms/mdx/server` is empty there).
		server: {
			formats: async () => (await import("@monti-cms/mdx/server")).createServerMdxFormat(options),
		},
		admin: () => import("@monti-cms/mdx/admin"),
	});
};
