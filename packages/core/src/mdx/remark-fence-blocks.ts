import type { Root, RootContent } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import { fenceBlockOf } from "../blocks/derive";

/**
 * Remark plugin that turns an added code fence block (e.g. ` ```mermaid `) into that block's public renderer (`component`).
 * The code is passed as the `source` attribute (`<Mermaid source="graph TD…" />`). It is the same value as the editor preview (`fencePreviews`).
 *
 * In the public render chain, place it after the syntax extensions' plugins. Fences the site already converted with its own plugin are left alone.
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
