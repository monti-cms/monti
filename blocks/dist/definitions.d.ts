/** Block definitions (data) only. For putting directly into the site config's `blocks` without plugins. */
export { calloutBlock } from "./callout/definition.js";
export { chartBlock } from "./chart/definition.js";
export { codeExplorerBlock } from "./code-explorer/definition.js";
export { codeRefBlock } from "./code-ref/definition.js";
export { collapsibleBlock } from "./collapsible/definition.js";
export { colorBlock } from "./color/definition.js";
export { columnBlock, columnsBlock } from "./columns/definition.js";
export { mermaidBlock } from "./mermaid/definition.js";
export { tabBlock, tabsBlock } from "./tabs/definition.js";
export { tooltipBlock } from "./tooltip/definition.js";
/**
 * All block definitions of this package (callout, collapsible, tabs, columns, code explorer, Mermaid, chart, then the inline marks tooltip, code-ref, color, in that order).
 * The order of the inline marks is the order in which overlapping marks are stored.
 */
export declare const ALL_BLOCKS: readonly [{
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
}, {
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
}, {
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
}, {
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
}, {
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
}, {
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
}, {
    readonly name: "code-explorer";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "container";
        readonly directive: "code-explorer";
    };
    readonly component: "CodeExplorer";
    readonly attributes: {
        readonly open: {
            readonly type: "string";
            readonly label: string;
        };
    };
    readonly children: {
        readonly min: 0;
    };
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "folder-tree";
        readonly insert: {
            readonly codeBlocks: readonly [{
                readonly language: "ts";
                readonly title: "src/index.ts";
            }];
        };
    };
}, {
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
}, {
    readonly name: "chart";
    readonly label: string;
    readonly description: string;
    readonly syntax: {
        readonly kind: "fence";
        readonly lang: "chart";
    };
    readonly component: "Chart";
    readonly attributes: {};
    readonly validate: import("@monti-cms/core").BlockValidate;
    readonly editor: {
        readonly view: "node";
        readonly insertable: true;
        readonly keywords: string[];
        readonly icon: "chart-column";
        readonly placeholder: string;
        readonly insert: {
            code: string;
        };
    };
}, {
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
}, {
    readonly name: "code-ref";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "code-ref";
    };
    readonly component: "CodeRef";
    readonly attributes: {
        readonly to: {
            readonly type: "string";
            readonly label: string;
            readonly required: true;
            readonly codeAnchor: true;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
}, {
    readonly name: "color";
    readonly label: string;
    readonly syntax: {
        readonly kind: "text";
        readonly directive: "color";
    };
    readonly component: "Color";
    readonly attributes: {
        readonly fg: {
            readonly type: "string";
            readonly label: string;
        };
        readonly fgDark: {
            readonly type: "string";
            readonly label: string;
        };
        readonly bg: {
            readonly type: "string";
            readonly label: string;
        };
        readonly bgDark: {
            readonly type: "string";
            readonly label: string;
        };
    };
    readonly editor: {
        readonly view: "mark";
    };
}];
