import type { BlockDefinition } from "@monti-cms/core/client";
import type { CodeBlockDocument } from "@monti-cms/core/code-block";
import { annotationConfig, fromCodeBlockDocumentToCodeFence } from "@monti-cms/core/code-block";
import type { CmsNode } from "@monti-cms/core/mdx";
import { asString } from "./shared";
import type { BlockConverter } from "./types";

const extractCodeValue = (node: CmsNode): string => {
	const value = asString(node.attrs?.value);
	if (value != null) return value;
	const document = node.attrs?.codeDocument;
	if (document && typeof document === "object" && !Array.isArray(document)) {
		return fromCodeBlockDocumentToCodeFence(document as unknown as CodeBlockDocument, annotationConfig).value;
	}
	return "";
};

/**
 * 더한 코드 펜스 블록(예: ` ```mermaid `)의 변환기. 그 언어의 코드 블록을 블록 노드로 바꾸고, 저장할 때 언어·메타를
 * 그대로 되살린다. 블록을 설치하지 않은 사이트에서는 일반 코드 블록으로 남는다.
 */
export function fenceBlockConverter(block: BlockDefinition, nodeName: string): BlockConverter {
	const lang = block.syntax.kind === "fence" ? block.syntax.lang : block.name;
	return {
		name: block.name,
		cmsTypes: ["codeBlock"],
		tiptapTypes: [nodeName],
		matches: (node) => asString(node.attrs?.language)?.toLowerCase() === lang,
		isMappable: () => true,
		toTiptap(node) {
			const language = asString(node.attrs?.language) ?? lang;
			const meta = asString(node.attrs?.meta) ?? "";
			return { type: nodeName, attrs: { value: extractCodeValue(node), language, ...(meta ? { meta } : {}) } };
		},
		toCms(node) {
			const value = asString(node.attrs?.value) ?? "";
			const language = asString(node.attrs?.language) || lang;
			const meta = asString(node.attrs?.meta);
			return [{ type: "codeBlock", attrs: { language, ...(meta ? { meta } : {}), value } }];
		},
	};
}

export const mathConverter: BlockConverter = {
	name: "math",
	cmsTypes: ["math"],
	tiptapTypes: ["cmsMath"],
	isMappable: () => true,
	toTiptap(node) {
		const value = asString(node.attrs?.value) ?? "";
		return {
			type: "cmsMath",
			attrs: {
				value,
			},
		};
	},
	toCms(node) {
		const value = asString(node.attrs?.value) ?? "";
		return [
			{
				type: "math",
				attrs: {
					value,
				},
			},
		];
	},
};
