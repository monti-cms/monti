import type { Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { fenceBlockOf } from "../blocks/derive";

/**
 * 더한 코드 펜스 블록(예: ` ```mermaid `)을 그 블록의 공개 렌더러(`component`)로 바꾸는 remark 플러그인.
 * 코드는 `source` 속성으로 넘긴다(`<Mermaid source="graph TD…" />`). 편집기 미리보기(`fencePreviews`)와 같은 값이다.
 *
 * 공개 렌더 체인에서 `remarkDirectivesToMdx` 뒤에 둔다. 사이트가 자기 플러그인으로 먼저 바꾼 펜스는 건드리지 않는다.
 */
export const remarkFenceBlocksToMdx =
	() =>
	(tree: Root): undefined => {
		visit(tree, "code", (node, index, parent) => {
			const block = fenceBlockOf(node.lang);
			if (!block || !parent || index == null) return;
			const replacement = {
				...(node.position ? { position: node.position } : {}),
				type: "mdxJsxFlowElement",
				name: block.component,
				attributes: [{ type: "mdxJsxAttribute", name: "source", value: node.value }],
				children: [],
			} as unknown as RootContent;
			(parent.children as RootContent[]).splice(index, 1, replacement);
			return [SKIP, index];
		});
	};
