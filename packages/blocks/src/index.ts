/**
 * Block extensions (`@monti-cms/blocks`). Add them to the site config's `plugins`. Use `blocks()` to add them all at once, or each function to add them one by one.
 *
 * ```ts
 * import { blocks } from "@monti-cms/blocks";
 * plugins: [...blocks({ omit: ["chart"] })]
 * ```
 */
export { type BlockExtensionName, type BlocksOptions, blocks } from "./blocks";
export { callout, calloutBlock } from "./callout";
export { chart, chartBlock } from "./chart";
export { codeRef, codeRefBlock } from "./code-ref";
export { collapsible, collapsibleBlock } from "./collapsible";
export {
	type ColorOptions,
	type ColorPair,
	color,
	colorBlock,
	DEFAULT_TEXT_PALETTE,
	type PaletteColor,
} from "./color";
export { columnBlock, columns, columnsBlock } from "./columns";
export { ALL_BLOCKS } from "./definitions";
export { mermaid, mermaidBlock } from "./mermaid";
export { tabBlock, tabs, tabsBlock } from "./tabs";
export { tooltip, tooltipBlock } from "./tooltip";
