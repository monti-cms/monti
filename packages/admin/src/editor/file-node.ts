import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CmsFileNodeView } from "./file-node-view";

export const FILE_NODE_NAME = "cmsFile";

/**
 * 첨부 파일 카드(`::file{mediaId label}`, v3). 통째로 선택·이동·삭제하는 블록이고, 카드 안에서 보일 이름만 고친다.
 */
export const CmsFileNode = Node.create({
	name: FILE_NODE_NAME,
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			mediaId: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-media-id"),
				renderHTML: (attributes) => (attributes.mediaId ? { "data-media-id": attributes.mediaId } : {}),
			},
			// 비우면 올린 파일 이름을 보인다.
			label: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-label"),
				renderHTML: (attributes) => (attributes.label ? { "data-label": attributes.label } : {}),
			},
		};
	},

	parseHTML() {
		return [{ tag: "div[data-file-block]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-file-block": "" })];
	},

	addNodeView() {
		return ReactNodeViewRenderer(CmsFileNodeView);
	},
});
