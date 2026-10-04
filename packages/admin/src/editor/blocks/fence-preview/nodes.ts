import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MathNodeView } from "./math-node-view";

export const CmsMathNode = Node.create({
	name: "cmsMath",
	group: "block",
	atom: true,
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			value: {
				default: "",
			},
		};
	},

	parseHTML() {
		return [{ tag: "div[data-cms-math]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", mergeAttributes(HTMLAttributes, { "data-cms-math": "" })];
	},

	addNodeView() {
		return ReactNodeViewRenderer(MathNodeView);
	},
});
