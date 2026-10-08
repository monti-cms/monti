export { chartBlock } from "./definition.js";
export { chartMessages } from "./messages.js";
/**
 * Chart block (` ```chart `). Add it to `plugins` in the site config.
 *
 * ```ts
 * plugins: [chart()]
 * ```
 *
 * The editor edits with a code input and a preview. The preview is drawn by this extension with recharts (install the optional dependency `recharts`).
 * A site can replace it via `fencePreviews.chart`. The public page is drawn by this extension's default `Chart` component, which a site can override (the code is the `source` attribute,
 * `remarkFenceBlocksToMdx`). Chart colors are the CSS variables `--chart-1` to `--chart-5` (defaults from this package's `render.css` if unset).
 */
export declare const chart: () => import("@monti-cms/core").CmsPlugin<"chart", {}, readonly [{
    readonly name: "chart";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "fence";
        readonly lang: "chart";
    };
    readonly component: "Chart";
    readonly attributes: {};
    readonly validate: import("@monti-cms/core").BlockValidate;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "chart-column";
        readonly placeholder: string;
        readonly insert: {
            code: string;
        };
    };
}]> & {
    readonly contributes?: {
        readonly ai: {
            actions: {
                chartDraft: (site: import("./ai.js").AiTextSite) => {
                    readonly label: string;
                    readonly input: {
                        readonly title: {
                            readonly kind: "text";
                            readonly label: string;
                        };
                        readonly body: {
                            readonly kind: "mdx";
                            readonly label: string;
                        };
                    };
                    readonly result: "mdx";
                    readonly stream: true;
                    readonly askInstruction: true;
                    readonly prompt: string;
                    readonly checks: readonly [import("./ai.js").CodeCheck];
                    readonly fake: (input: Readonly<Record<string, string>>) => string;
                    readonly attach: readonly [{
                        readonly slot: "insert";
                    }];
                };
                chartEdit: (site: import("./ai.js").AiTextSite) => {
                    readonly label: string;
                    readonly input: {
                        readonly block: {
                            readonly kind: "mdx";
                            readonly label: string;
                            readonly required: true;
                        };
                        readonly title: {
                            readonly kind: "text";
                            readonly label: string;
                        };
                    };
                    readonly result: "mdx";
                    readonly stream: true;
                    readonly askInstruction: true;
                    readonly prompt: string;
                    readonly checks: readonly [import("./ai.js").CodeCheck];
                    readonly fake: (input: Readonly<Record<string, string>>) => string;
                    readonly attach: readonly [{
                        readonly slot: "block";
                        readonly block: "chart";
                    }];
                };
            };
        };
    } | undefined;
};
export * from "./dsl.js";
export { type ChartMessageKey, type ChartText, chartErrorLine, chartErrorMessage } from "./errors.js";
export * from "./layout.js";
export * from "./types.js";
