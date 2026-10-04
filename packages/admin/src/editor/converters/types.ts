import type { CmsNode } from "@monti-cms/core/mdx";
import type { JSONContent } from "@tiptap/core";

/** 변환기가 재귀 변환·인라인 변환에 쓰는 함수. `tiptap-content.ts`가 넘긴다. */
export interface ConverterContext {
	blockToTiptap(node: CmsNode): JSONContent;
	tiptapBlockToCms(node: JSONContent): CmsNode[];
	isMappableBlock(node: CmsNode): boolean;
	isMappableInline(node: CmsNode): boolean;
	inlineToTiptap(nodes: CmsNode[]): JSONContent[];
	inlineToCms(nodes: JSONContent[] | undefined): CmsNode[];
}

/**
 * 블록 하나의 CmsNode ↔ Tiptap 변환(v2 C0).
 *
 * 새 블록의 편집 UI를 붙일 때 이 모양으로 모듈을 만들고 `converters/index.ts`의 `BLOCK_CONVERTERS`에 한 줄 더한다.
 * `isMappable`이 거짓이면 그 블록은 원문 보존 상자(`cmsOpaqueBlock`)로 간다.
 */
export interface BlockConverter {
	readonly name: string;
	/** 이 변환기가 받는 CmsNode `type`. */
	readonly cmsTypes: readonly string[];
	/** 이 변환기가 받는 Tiptap 노드 이름. */
	readonly tiptapTypes: readonly string[];
	/** 같은 cmsType 후보 중 특정 노드(예: 언어가 mermaid·chart인 codeBlock)를 가려낼 때 쓴다. */
	matches?(node: CmsNode): boolean;
	isMappable(node: CmsNode, ctx: ConverterContext): boolean;
	toTiptap(node: CmsNode, ctx: ConverterContext): JSONContent;
	toCms(node: JSONContent, ctx: ConverterContext): CmsNode[];
}
