import type { Site } from "@monti-cms/core/client";
/**
 * AI features of the chart block (only for sites using `@monti-cms/ai`). The `chart()` plugin adds them via `contributes.ai`, so they
 * attach automatically on sites that use the AI plugin (`chartDraft`, `chartEdit`). To change the instructions, set the same name; to turn one off, give `false`.
 *
 * ```ts
 * aiPlugin({ actions: { chartDraft: chartAi.draft({ prompt: "…" }), chartEdit: false } })
 * ```
 *
 * The actions are factories (`AiActionFactory`): the AI plugin calls them with the site, so the text is in that site's admin language.
 */
/** What the actions read from the site: its admin-language translator (the actions are created per site). */
export type AiTextSite = Pick<Site, "createTranslator">;
/**
 * Code validator (same shape as `AiValidator` / `defineValidator` of `@monti-cms/ai`). The shape is written out here so the published type
 * declarations do not point at the AI plugin (sites without the AI plugin still pass type checking). The `satisfies` below checks the shape matches.
 */
export interface CodeCheck {
    readonly kind: "code";
    readonly name: string;
    readonly label: string;
    readonly run: (value: string) => string | undefined;
}
/** Description of the chart syntax (`parseChartDsl`). Goes into the instructions. */
export declare const chartSyntaxGuide: (site: AiTextSite) => string;
/** Code validator: is the answer a single ```chart code fence that matches the chart syntax (`parseChartDsl`, `normalizeChartDsl`). */
export declare function validateChart(site: AiTextSite, value: string): string | undefined;
/** Result syntax check (code validator). Can also be added to other features via `checks`. */
export declare const chartSyntax: (site: AiTextSite) => CodeCheck;
/** Answer from the fake connection (dev only): a chart that passes the syntax check. If there is a chart to edit, repeats its last value row once. */
declare function fakeChart(input: Readonly<Record<string, string>>): string;
export declare const chartAi: {
    /** Create chart. Takes a request from the slash menu and inserts a chart block at the cursor. */
    draft: (options?: {
        readonly prompt?: string;
    }) => (site: AiTextSite) => {
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
        readonly checks: readonly [CodeCheck];
        readonly fake: typeof fakeChart;
        readonly attach: readonly [{
            readonly slot: "insert";
        }];
    };
    /** Edit chart. Edits as requested from beside the block handle, shows what changed, then replaces the block. */
    edit: (options?: {
        readonly prompt?: string;
    }) => (site: AiTextSite) => {
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
        readonly checks: readonly [CodeCheck];
        readonly fake: typeof fakeChart;
        readonly attach: readonly [{
            readonly slot: "block";
            readonly block: "chart";
        }];
    };
};
/** What `chart()` adds to the AI plugin. The feature name is the key of the value edited in the admin AI screen. */
export declare const chartAiContribution: {
    actions: {
        chartDraft: (site: AiTextSite) => {
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
            readonly checks: readonly [CodeCheck];
            readonly fake: typeof fakeChart;
            readonly attach: readonly [{
                readonly slot: "insert";
            }];
        };
        chartEdit: (site: AiTextSite) => {
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
            readonly checks: readonly [CodeCheck];
            readonly fake: typeof fakeChart;
            readonly attach: readonly [{
                readonly slot: "block";
                readonly block: "chart";
            }];
        };
    };
};
export {};
