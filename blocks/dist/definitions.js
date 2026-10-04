/** Block definitions (data) only. For putting directly into the site config's `blocks` without plugins. */
export { calloutBlock } from "./callout/definition.js";
export { chartBlock } from "./chart/definition.js";
export { codeRefBlock } from "./code-ref/definition.js";
export { collapsibleBlock } from "./collapsible/definition.js";
export { colorBlock } from "./color/definition.js";
export { columnBlock, columnsBlock } from "./columns/definition.js";
export { mermaidBlock } from "./mermaid/definition.js";
export { tabBlock, tabsBlock } from "./tabs/definition.js";
export { tooltipBlock } from "./tooltip/definition.js";
import { calloutBlock } from "./callout/definition.js";
import { chartBlock } from "./chart/definition.js";
import { codeRefBlock } from "./code-ref/definition.js";
import { collapsibleBlock } from "./collapsible/definition.js";
import { colorBlock } from "./color/definition.js";
import { columnBlock, columnsBlock } from "./columns/definition.js";
import { mermaidBlock } from "./mermaid/definition.js";
import { tabBlock, tabsBlock } from "./tabs/definition.js";
import { tooltipBlock } from "./tooltip/definition.js";
/**
 * All block definitions of this package (callout, collapsible, tabs, columns, Mermaid, chart, then the inline marks tooltip, code-ref, color, in that order).
 * The order of the inline marks is the order in which overlapping marks are stored.
 */
export const ALL_BLOCKS = [
    calloutBlock,
    collapsibleBlock,
    tabsBlock,
    tabBlock,
    columnsBlock,
    columnBlock,
    mermaidBlock,
    chartBlock,
    tooltipBlock,
    codeRefBlock,
    colorBlock,
];
