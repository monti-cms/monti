import type { Site } from "@monti-cms/core/client";
/**
 * AI features of the Mermaid block (only for sites using `@monti-cms/ai`). The `mermaid()` plugin adds them via `contributes.ai`, so they attach automatically
 * on sites that use the AI plugin (`diagramDraft`, `diagramEdit`). To change the instructions, write an entry with the same name; to turn one off, give `false`.
 *
 * ```ts
 * aiPlugin({ actions: { diagramDraft: mermaidAi.draft({ prompt: "…" }), diagramEdit: false } })
 * ```
 *
 * The actions are factories (`AiActionFactory`): the AI plugin calls them with the site, so the text is in that site's admin language.
 */
/** What the actions read from the site: its admin-language translator (the actions are created per site). */
export type AiTextSite = Pick<Site, "createTranslator">;
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
export declare function validateMermaid(site: AiTextSite, value: string): string | undefined;
/** Result syntax validation (code validation). It can also be added to other features through `checks`. */
export declare const mermaidSyntax: (site: AiTextSite) => CodeCheck;
export declare const mermaidAi: {
    /** Create a diagram. Takes a request from the slash menu and inserts a Mermaid block at the cursor. */
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
        readonly fake: (input: Readonly<Record<string, string>>) => string;
        readonly attach: readonly [{
            readonly slot: "insert";
        }];
    };
    /** Edit a diagram. Edits as requested from next to the block handle, shows what changed, and then replaces the block. */
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
        readonly fake: (input: Readonly<Record<string, string>>) => string;
        readonly attach: readonly [{
            readonly slot: "block";
            readonly block: "mermaid";
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
            readonly checks: readonly [CodeCheck];
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
            readonly checks: readonly [CodeCheck];
            readonly fake: (input: Readonly<Record<string, string>>) => string;
            readonly attach: readonly [{
                readonly slot: "block";
                readonly block: "mermaid";
            }];
        };
    };
};
