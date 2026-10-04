/**
 * Tooltip (`:tooltip[text]{content="description"}`). Hovering the text shows the description. On the public page the site draws it with a `Tooltip`
 * component (`content` attribute, the text is the child).
 */
export declare const tooltipBlock: {
    readonly name: "tooltip";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "tooltip";
    };
    readonly component: "Tooltip";
    readonly attributes: {
        readonly content: {
            readonly type: "string";
            readonly label: string;
            readonly required: true;
            readonly translatable: true;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
};
