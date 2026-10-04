/**
 * 블록 확장(`@monti-cms/blocks`). 사이트 설정의 `plugins`에 넣는다. 한 번에 넣으려면 `blocks()`, 하나씩 넣으려면 각 함수를 쓴다.
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
