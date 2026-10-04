/** Columns (2 to 4 `:::column` inside `::::columns{widths="60,40"}`). */
export declare const columnsBlock: {
    readonly name: "columns";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "columns";
    };
    readonly component: "Columns";
    readonly attributes: {
        readonly widths: {
            readonly type: "string";
            readonly label: string;
            readonly description: string;
        };
    };
    readonly children: {
        readonly blocks: readonly ["column"];
        readonly min: 2;
        readonly max: 4;
    };
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "columns-2";
        readonly insert: {
            children: {
                text: string;
            }[];
        };
    };
};
export declare const columnBlock: {
    readonly name: "column";
    readonly label: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "column";
    };
    readonly component: "Column";
    readonly attributes: {};
    readonly parent: "columns";
    readonly translateInside: true;
    readonly editor: {
        readonly view: "node";
    };
};
