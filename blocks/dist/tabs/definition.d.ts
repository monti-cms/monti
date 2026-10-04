/** Tab group (2 to 8 `:::tab{label="…"}` inside `::::tabs`). */
export declare const tabsBlock: {
    readonly name: "tabs";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "tabs";
    };
    readonly component: "Tabs";
    readonly attributes: {
        readonly defaultValue: {
            readonly type: "string";
            readonly label: string;
            readonly description: string;
            readonly childValue: "label";
        };
    };
    readonly children: {
        readonly blocks: readonly ["tab"];
        readonly min: 2;
        readonly max: 8;
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "square-stack";
        readonly insert: {
            children: {
                values: {
                    label: string;
                };
                text: string;
            }[];
        };
    };
};
export declare const tabBlock: {
    readonly name: "tab";
    readonly label: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "tab";
    };
    readonly component: "Tab";
    readonly attributes: {
        readonly label: {
            readonly type: "string";
            readonly label: string;
            readonly required: true;
            readonly translatable: true;
        };
    };
    readonly parent: "tabs";
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
    };
};
