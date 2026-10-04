/**
 * Block extensions (`@monti-cms/blocks`). Add them to the site config's `plugins`. Use `blocks()` to add them all at once, or each function to add them one by one.
 *
 * ```ts
 * import { blocks } from "@monti-cms/blocks";
 * plugins: [...blocks({ omit: ["chart"] })]
 * ```
 */
export { blocks } from "./blocks.js";
export { callout, calloutBlock } from "./callout/index.js";
export { chart, chartBlock } from "./chart/index.js";
export { codeRef, codeRefBlock } from "./code-ref/index.js";
export { collapsible, collapsibleBlock } from "./collapsible/index.js";
export { color, colorBlock, DEFAULT_TEXT_PALETTE, } from "./color/index.js";
export { columnBlock, columns, columnsBlock } from "./columns/index.js";
export { ALL_BLOCKS } from "./definitions.js";
export { mermaid, mermaidBlock } from "./mermaid/index.js";
export { tabBlock, tabs, tabsBlock } from "./tabs/index.js";
export { tooltip, tooltipBlock } from "./tooltip/index.js";
