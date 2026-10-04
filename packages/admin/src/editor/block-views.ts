import type { Node } from "@tiptap/core";
import { CmsMathNode } from "./blocks/fence-preview";
import { CmsFileNode } from "./file-node";
import { CmsImageNode } from "./image-node";

/**
 * 본체 블록 정의(v2 B3)의 `editor.nodeView` 이름 → Tiptap 노드(NodeView 포함) 등록부.
 *
 * 정의는 서버와 함께 쓰므로 React·Tiptap 코드를 담지 않고 이름만 가진다. 블록 확장·사이트 설정이 더한 블록은
 * 정의에서 노드를 만든다(`blocks/added`). 둘 다 아닌 블록은 원문 보존 상자(`cmsOpaqueBlock`)로 보인다.
 */
export const BLOCK_NODE_VIEWS: Readonly<Record<string, Node>> = {
	image: CmsImageNode,
	file: CmsFileNode,
	math: CmsMathNode,
};
