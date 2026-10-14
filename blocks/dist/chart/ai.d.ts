import { type AiTextSite } from "../shared/diagram-ai.js";
export type { AiTextSite } from "../shared/diagram-ai.js";
/** Description of the chart syntax (`parseChartDsl`). Goes into the instructions. */
export declare const chartSyntaxGuide: (site: AiTextSite) => string;
/** Code validator: is the answer a single ```chart code fence that matches the chart syntax (`parseChartDsl`, `normalizeChartDsl`). */
export declare function validateChart(site: AiTextSite, value: string): string | undefined;
/** Result syntax check (code validator). Can also be added to other features through `checks`. */
export declare const chartSyntax: (site: AiTextSite) => import("@monti-cms/core/ai-contract").AiValidator;
export declare const chartAi: {
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
        readonly checks: readonly [import("@monti-cms/core/ai-contract").AiValidator];
        readonly fake: (input: Readonly<Record<string, string>>) => string;
        readonly attach: readonly [{
            readonly slot: "insert";
        }];
    };
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
        readonly checks: readonly [import("@monti-cms/core/ai-contract").AiValidator];
        readonly fake: (input: Readonly<Record<string, string>>) => string;
        readonly attach: readonly [{
            readonly slot: "block";
            readonly block: string;
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
            readonly checks: readonly [import("@monti-cms/core/ai-contract").AiValidator];
            readonly fake: (input: Readonly<Record<string, string>>) => string;
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
            readonly checks: readonly [import("@monti-cms/core/ai-contract").AiValidator];
            readonly fake: (input: Readonly<Record<string, string>>) => string;
            readonly attach: readonly [{
                readonly slot: "block";
                readonly block: string;
            }];
        };
    };
};
