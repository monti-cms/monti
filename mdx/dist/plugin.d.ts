import { type ConfigIssue, type PluginId } from "@monti-cms/core";
import { MDX_PLUGIN_NAME } from "./name.js";
import type { SyntaxExtension } from "./syntax/types.js";
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
/** The MDX plugin with the type of its options (`site.pluginOptions(MDX_PLUGIN)`). */
export declare const MDX_PLUGIN: PluginId<typeof MDX_PLUGIN_NAME, MdxPluginOptions>;
/** The problems of the options: every extension has a name, and no name is listed twice. */
export declare const checkMdxOptions: (options: MdxPluginOptions | undefined) => ConfigIssue[];
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
export declare const mdx: (options?: MdxPluginOptions) => import("@monti-cms/core").Plugin<"mdx", MdxPluginOptions, readonly import("@monti-cms/core").BlockDefinition[]> & {
    readonly contributes?: import("@monti-cms/core").PluginContributions | undefined;
};
