export declare const SEO_PLUGIN_NAME = "seo";
export interface SeoPluginOptions {
    /** Adds search title and description suggestions when the AI plugin is present. Default `true`. */
    readonly ai?: boolean;
}
/**
 * SEO extension. Add it to the site config `plugins`. Spread the fields into a collection with `seoFields()`.
 *
 * - Admin UI: search result and share preview (view field `search`), character counts for search title and description with a hint for the fallback value, and a hide switch
 * - Config validation: SEO roles are attached to fields of the right kind
 * - With the AI plugin, search title and description suggestions (`seoTitle`, `seoDescription`)
 *
 * ```ts
 * plugins: [seo(), aiPlugin()]
 * ```
 */
export declare const seo: (options?: SeoPluginOptions) => import("@monti-cms/core").CmsPlugin<"seo", SeoPluginOptions, readonly import("@monti-cms/core").BlockDefinition[]> & {
    readonly contributes?: {
        readonly ai: {
            actions: {
                seoTitle: (site: import("./ai.js").SeoSiteView) => {
                    label: string;
                    input: {
                        readonly title: {
                            readonly kind: "text";
                            readonly label: string;
                        };
                        readonly summary: {
                            readonly kind: "text";
                            readonly label: string;
                        };
                        readonly body: {
                            readonly kind: "mdx";
                            readonly label: string;
                        };
                        readonly current: {
                            readonly kind: "value";
                            readonly label: string;
                        };
                    };
                    send: string[];
                    result: "candidates";
                    askInstruction: true;
                    checks: {
                        kind: "maxLength";
                        max: number;
                    }[];
                    prompt: string;
                    attach: import("./ai.js").FieldAttach[];
                } | undefined;
                seoDescription: (site: import("./ai.js").SeoSiteView) => {
                    label: string;
                    input: {
                        readonly title: {
                            readonly kind: "text";
                            readonly label: string;
                        };
                        readonly summary: {
                            readonly kind: "text";
                            readonly label: string;
                        };
                        readonly body: {
                            readonly kind: "mdx";
                            readonly label: string;
                        };
                        readonly current: {
                            readonly kind: "value";
                            readonly label: string;
                        };
                    };
                    send: string[];
                    result: "text";
                    askInstruction: true;
                    checks: {
                        kind: "maxLength";
                        max: number;
                    }[];
                    prompt: string;
                    attach: import("./ai.js").FieldAttach[];
                } | undefined;
            };
        };
    } | undefined;
};
