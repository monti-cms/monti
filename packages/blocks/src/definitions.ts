/** Block definitions (data) only. For putting directly into the site config's `blocks` without plugins. */
export { calloutBlock } from "./callout/definition";
export { chartBlock } from "./chart/definition";
export { codeExplorerBlock } from "./code-explorer/definition";
export { codeRefBlock } from "./code-ref/definition";
export { collapsibleBlock } from "./collapsible/definition";
export { colorBlock } from "./color/definition";
export { columnBlock, columnsBlock } from "./columns/definition";
export { mermaidBlock } from "./mermaid/definition";
export { tabBlock, tabsBlock } from "./tabs/definition";
export { tooltipBlock } from "./tooltip/definition";

import { calloutBlock } from "./callout/definition";
import { chartBlock } from "./chart/definition";
import { codeExplorerBlock } from "./code-explorer/definition";
import { codeRefBlock } from "./code-ref/definition";
import { collapsibleBlock } from "./collapsible/definition";
import { colorBlock } from "./color/definition";
import { columnBlock, columnsBlock } from "./columns/definition";
import { mermaidBlock } from "./mermaid/definition";
import { tabBlock, tabsBlock } from "./tabs/definition";
import { tooltipBlock } from "./tooltip/definition";

/**
 * All block definitions of this package (callout, collapsible, tabs, columns, code explorer, Mermaid, chart, then the inline marks tooltip, code-ref, color, in that order).
 * The order of the inline marks is the order in which overlapping marks are stored.
 */
export const ALL_BLOCKS = [
	calloutBlock,
	collapsibleBlock,
	tabsBlock,
	tabBlock,
	columnsBlock,
	columnBlock,
	codeExplorerBlock,
	mermaidBlock,
	chartBlock,
	tooltipBlock,
	codeRefBlock,
	colorBlock,
] as const;
