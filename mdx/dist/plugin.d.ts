import type { SyntaxExtension } from "./syntax/types.js";
export declare const MDX_PLUGIN_NAME = "mdx";
export interface MdxPluginOptions {
    /**
     * Syntax extensions, in precedence order for writing. Stored MDX is CommonMark + GFM + standard MDX JSX; an extension adds a notation (for example
     * `directiveSyntax()` from `@monti-cms/syntax-directive` for `:::callout`). Content written in an extension's notation is read only while the extension is listed.
     *
     * @experimental
     */
    readonly syntax?: readonly SyntaxExtension[];
}
/** Checks the options when the site config is created: every extension has a name, and no name is listed twice. */
export declare const validateMdxOptions: (options: MdxPluginOptions | undefined) => void;
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
export declare const mdx: (options?: MdxPluginOptions) => import("@monti-cms/core").CmsPlugin<"mdx", MdxPluginOptions, readonly import("@monti-cms/core").BlockDefinition[]> & {
    readonly contributes?: Readonly<Record<string, unknown>> | undefined;
};
