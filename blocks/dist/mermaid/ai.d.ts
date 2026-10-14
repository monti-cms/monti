import { type AiTextSite } from "../shared/diagram-ai.js";
export type { AiTextSite } from "../shared/diagram-ai.js";
/**
 * Code validation: is the answer a single ```mermaid code fence whose first line is a diagram type Mermaid knows?
 * Actually rendering the diagram is checked by the browser (the preview).
 */
export declare function validateMermaid(site: AiTextSite, value: string): string | undefined;
/** Result syntax validation (code validation). It can also be added to other features through `checks`. */
export declare const mermaidSyntax: (site: AiTextSite) => import("@monti-cms/core/ai-contract").AiValidator;
export declare const mermaidAi: {
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
/** What `mermaid()` adds to the AI plugin. The feature names are the keys of the values edited in the admin AI screen. */
export declare const mermaidAiContribution: {
    actions: {
        diagramDraft: (site: AiTextSite) => {
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
        diagramEdit: (site: AiTextSite) => {
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
