/** Collapsible (`:::collapsible{title="…"}`). An area that expands when its title is clicked. */
export declare const collapsibleBlock: {
    readonly name: "collapsible";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "collapsible";
    };
    readonly component: "Collapsible";
    readonly attributes: {
        readonly title: {
            readonly type: "string";
            readonly label: string;
            readonly translatable: true;
        };
        readonly defaultOpen: {
            readonly type: "boolean";
            readonly label: string;
            readonly defaultValue: false;
        };
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "chevrons-up-down";
        readonly insert: {
            values: {
                title: string;
            };
            text: string;
        };
    };
};
