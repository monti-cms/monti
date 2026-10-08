/** Mermaid diagram (` ```mermaid `). The extension draws the editor preview (a site can replace it), and the site draws the public page. */
export declare const mermaidBlock: {
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
};
