/**
 * Code validation (same shape as `AiValidator` and `defineValidator` of `@monti-cms/ai`). The shape is written out here so the published type declarations do not
 * reference the AI plugin (sites without the AI plugin still pass type checking). The `satisfies` below checks that the shape matches.
 */
export interface CodeCheck {
    readonly kind: "code";
    readonly name: string;
    readonly label: string;
    readonly run: (value: string) => string | undefined;
}
/**
 * Code validation: is the answer a single ```mermaid code fence whose first line is a diagram type Mermaid knows?
 * Actually rendering the diagram is checked by the browser (the preview).
 */
export declare function validateMermaid(value: string): string | undefined;
/** Result syntax validation (code validation). It can also be added to other features through `checks`. */
export declare const mermaidSyntax: CodeCheck;
/** Answer of the fake connection (development only): a diagram that passes syntax validation. If there is a diagram to fix, one node line is added. */
declare function fakeMermaid(input: Readonly<Record<string, string>>): string;
export declare const mermaidAi: {
    /** Create a diagram. Takes a request from the slash menu and inserts a Mermaid block at the cursor. */
    draft: (options?: {
        readonly prompt?: string;
    }) => {
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
        readonly fake: typeof fakeMermaid;
        readonly attach: readonly [{
            readonly slot: "insert";
        }];
    };
    /** Edit a diagram. Edits as requested from next to the block handle, shows what changed, and then replaces the block. */
    edit: (options?: {
        readonly prompt?: string;
    }) => {
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
        readonly fake: typeof fakeMermaid;
        readonly attach: readonly [{
            readonly slot: "block";
            readonly block: "mermaid";
        }];
    };
};
/** What `mermaid()` adds to the AI plugin. The feature names are the keys of the values edited in the admin AI screen. */
export declare const mermaidAiContribution: {
    actions: {
        diagramDraft: {
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
            readonly fake: typeof fakeMermaid;
            readonly attach: readonly [{
                readonly slot: "insert";
            }];
        };
        diagramEdit: {
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
            readonly fake: typeof fakeMermaid;
            readonly attach: readonly [{
                readonly slot: "block";
                readonly block: "mermaid";
            }];
        };
    };
};
export {};
