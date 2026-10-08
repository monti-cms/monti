/**
 * Block extensions (`@monti-cms/blocks`): one function per block, each a plugin that works with no arguments. List the ones the site uses in the `plugins` of
 * the config, one per line. Nothing is added by default, and there is no bundle that adds them all.
 *
 * ```ts
 * import { callout, tabs, tooltip } from "@monti-cms/blocks";
 * plugins: [callout(), tabs(), tooltip()]
 * ```
 *
 * The order of the inline marks (`tooltip()`, `codeRef()`, `color()`) is the order in which overlapping marks are stored (outermost first), so list them in the order you want.
 * Adding the same block twice is a config error.
 *
 * The two heavy blocks are not exported here, so an app that does not use them never loads (or needs) their libraries: `mermaid()` comes from
 * `@monti-cms/blocks/mermaid` (needs the `mermaid` package) and `chart()` from `@monti-cms/blocks/chart` (needs `recharts`). `ALL_BLOCKS` is in
 * `@monti-cms/blocks/definitions`.
 *
 * ```ts
 * import { chart } from "@monti-cms/blocks/chart";
 * import { mermaid } from "@monti-cms/blocks/mermaid";
 * ```
 */
export { callout, calloutBlock } from "./callout";
export { codeExplorer, codeExplorerBlock } from "./code-explorer";
export { codeRef, codeRefBlock } from "./code-ref";
export { collapsible, collapsibleBlock } from "./collapsible";
export {
	type ColorOptions,
	type ColorPair,
	color,
	colorBlock,
	defaultTextPalette,
	type PaletteColor,
	type PaletteText,
} from "./color";
export { columnBlock, columns, columnsBlock } from "./columns";
export { tabBlock, tabs, tabsBlock } from "./tabs";
export { tooltip, tooltipBlock } from "./tooltip";
