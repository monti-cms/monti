/** 블록 정의(데이터)만. 플러그인 없이 사이트 설정의 `blocks`에 바로 넣을 때 쓴다. */
export { calloutBlock } from "./callout/definition";
export { chartBlock } from "./chart/definition";
export { codeRefBlock } from "./code-ref/definition";
export { collapsibleBlock } from "./collapsible/definition";
export { colorBlock } from "./color/definition";
export { columnBlock, columnsBlock } from "./columns/definition";
export { mermaidBlock } from "./mermaid/definition";
export { tabBlock, tabsBlock } from "./tabs/definition";
export { tooltipBlock } from "./tooltip/definition";

import { calloutBlock } from "./callout/definition";
import { chartBlock } from "./chart/definition";
import { codeRefBlock } from "./code-ref/definition";
import { collapsibleBlock } from "./collapsible/definition";
import { colorBlock } from "./color/definition";
import { columnBlock, columnsBlock } from "./columns/definition";
import { mermaidBlock } from "./mermaid/definition";
import { tabBlock, tabsBlock } from "./tabs/definition";
import { tooltipBlock } from "./tooltip/definition";

/**
 * 이 패키지의 블록 정의 전부(콜아웃·접기·탭·단·Mermaid·차트, 글자 꾸밈 툴팁·코드 연결·글자색 순서).
 * 글자 꾸밈의 순서는 겹친 꾸밈을 저장하는 순서다.
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
] as const;
