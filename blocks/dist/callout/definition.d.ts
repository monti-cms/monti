/** Callout (`:::callout{variant="tip" title="…"}`). A box that highlights content such as notes and warnings. */
export declare const calloutBlock: {
    readonly name: "callout";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "callout";
    };
    readonly component: "Callout";
    readonly attributes: {
        readonly variant: {
            readonly type: "string";
            readonly label: string;
            readonly options: {
                readonly note: string;
                readonly tip: string;
                readonly info: string;
                readonly warning: string;
                readonly danger: string;
            };
            readonly defaultValue: "note";
        };
        readonly title: {
            readonly type: "string";
            readonly label: string;
            readonly translatable: true;
        };
    };
    readonly children: {
        readonly min: 0;
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "message-square-warning";
        readonly insert: {
            values: {
                variant: string;
            };
            text: string;
        };
    };
};
