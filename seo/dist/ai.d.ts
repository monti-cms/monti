import type { AiSiteView } from "@monti-cms/core/ai-contract";
type SeoSiteView = Pick<AiSiteView, "collections" | "createTranslator">;
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
        attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
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
        attach: {
            readonly slot: "field";
            readonly field: string;
            readonly collections?: readonly string[];
        }[];
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
            attach: {
                readonly slot: "field";
                readonly field: string;
                readonly collections?: readonly string[];
            }[];
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
            attach: {
                readonly slot: "field";
                readonly field: string;
                readonly collections?: readonly string[];
            }[];
        } | undefined;
    };
};
export {};
