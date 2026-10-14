import { type PluginFieldSet, type PluginPlacement } from "@monti-cms/core";
export { SEO_PLUGIN_NAME } from "./name.js";
export interface SeoPluginOptions {
    /** Adds search title and description suggestions when the AI plugin is present. Default `true`. */
    readonly ai?: boolean;
    /** Name of the tab of the edit screen's properties panel the SEO fields are placed in (1 to 20 characters). Default `SEO`. */
    readonly tab?: string;
}
/**
 * SEO extension. Add it to the site config `plugins`. Add the fields with the "Add SEO fields" action on the Fields tab of the settings screen (they are written into
 * `monti.schema.ts` as plain fields), or spread `seoFields()` into a collection defined in code; the plugin places them in their own tab (`tab`, default `SEO`) of the
 * properties panel.
 *
 * - Admin UI: search result and share preview (view field `search`), character counts for search title and description with a hint for the fallback value, and a hide switch
 * - Config validation: SEO roles are attached to fields of the right kind
 * - With the AI plugin, search title and description suggestions (`seoTitle`, `seoDescription`)
 *
 * ```ts
 * plugins: [seo(), ai()]
 * ```
 */
export declare const seo: (options?: SeoPluginOptions) => import("@monti-cms/core").CmsPlugin<"seo", SeoPluginOptions, readonly import("@monti-cms/core").BlockDefinition[]> & {
    readonly contributes?: {
        readonly layout: readonly PluginPlacement[];
        readonly fieldSets: readonly PluginFieldSet[];
        readonly ai?: {
            actions: {
                seoTitle: (site: {
                    readonly collections: import("@monti-cms/core").CollectionsConfig;
                    readonly createTranslator: import("@monti-cms/core/client").Site["createTranslator"];
                }) => {
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
                    attach: {
                        readonly slot: "field";
                        readonly field: string;
                        readonly collections?: readonly string[];
                    }[];
                } | undefined;
                seoDescription: (site: {
                    readonly collections: import("@monti-cms/core").CollectionsConfig;
                    readonly createTranslator: import("@monti-cms/core/client").Site["createTranslator"];
                }) => {
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
                    attach: {
                        readonly slot: "field";
                        readonly field: string;
                        readonly collections?: readonly string[];
                    }[];
                } | undefined;
            };
        } | undefined;
    } | undefined;
};
