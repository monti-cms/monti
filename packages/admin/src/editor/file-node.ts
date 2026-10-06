import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockNodeView } from "./blocks/block-node-view";

export const FILE_NODE_NAME = "cmsFile";

/**
 * Attachment file card (`::file{mediaId label}`). A block that is selected, moved and deleted as a whole; only the name shown in the card is editable.
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
			// If empty, the uploaded file name is shown.
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
		return ReactNodeViewRenderer(BlockNodeView);
	},
});
