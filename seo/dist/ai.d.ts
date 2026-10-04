import { type CollectionsConfig } from "@monti-cms/core";
/**
 * The part of the site view (`AiSiteView`) passed by the AI plugin that this file reads, and the shape of the attach target (`AiAttach`). Written here so the published type declarations
 * do not reference the AI plugin (sites without the AI plugin still pass type checking). `satisfies` checks that the shape matches.
 */
export interface SeoSiteView {
    readonly collections: CollectionsConfig;
}
export interface FieldAttach {
    readonly slot: "field";
    readonly field: string;
    readonly collections: readonly string[];
}
export declare const seoAi: {
    /** Title candidates shown in search results. Attaches to the search title role (`seoTitle`) field. */
    title: (options?: {
        readonly prompt?: string;
        readonly maxLength?: number;
    }) => (site: SeoSiteView) => {
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
        attach: FieldAttach[];
    } | undefined;
    /** Description shown in search results. Attaches to the search description role (`seoDescription`) field. */
    description: (options?: {
        readonly prompt?: string;
        readonly maxLength?: number;
    }) => (site: SeoSiteView) => {
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
        attach: FieldAttach[];
    } | undefined;
};
/** What `seo()` adds to the AI plugin. The feature names (`seoTitle`, `seoDescription`) are the keys of values edited in the admin AI screen. */
export declare const seoAiContribution: {
    actions: {
        seoTitle: (site: SeoSiteView) => {
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
            attach: FieldAttach[];
        } | undefined;
        seoDescription: (site: SeoSiteView) => {
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
            attach: FieldAttach[];
        } | undefined;
    };
};
