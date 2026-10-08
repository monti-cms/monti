export { mermaidBlock } from "./definition.js";
/**
 * Mermaid diagram block (` ```mermaid `). Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [mermaid()]
 * ```
 *
 * The editor edits with a code input and a preview. This extension draws the preview (install the optional dependency `mermaid`). A site can
 * replace it with `fencePreviews.mermaid`. The public page is drawn by this extension's default `Mermaid` component, which a site can override (the code is the `source` attribute,
 * `remarkFenceBlocksToMdx`).
 */
export declare const mermaid: () => import("@monti-cms/core").CmsPlugin<"mermaid", {}, readonly [{
    readonly name: "mermaid";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "fence";
        readonly lang: "mermaid";
    };
    readonly component: "Mermaid";
    readonly attributes: {};
    readonly validate: import("@monti-cms/core").BlockValidate;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "workflow";
        readonly placeholder: string;
        readonly insert: {
            readonly code: "graph TD\n  A --> B";
        };
    };
}]> & {
    readonly contributes?: {
        readonly ai: {
            actions: {
                diagramDraft: (site: import("./ai.js").AiTextSite) => {
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
                diagramEdit: (site: import("./ai.js").AiTextSite) => {
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
                        readonly block: "mermaid";
                    }];
                };
            };
        };
    } | undefined;
};
