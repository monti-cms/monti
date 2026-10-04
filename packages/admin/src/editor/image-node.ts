import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CmsImageNodeView } from "./image-node-view";

export interface CmsImageAttributes {
	mediaId?: string;
	src?: string;
	alt?: string;
	width?: string;
	align?: "left" | "center" | "right";
	caption?: string;
	decorative?: boolean;
	crop?: string;
	rotate?: string | number;
}

export const CmsImageNode = Node.create({
	name: "image",
	group: "block",
	draggable: true,
	selectable: true,

	addAttributes() {
		return {
			mediaId: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-media-id"),
				renderHTML: (attributes) => (attributes.mediaId ? { "data-media-id": attributes.mediaId } : {}),
			},
			src: {
				default: null,
			},
			alt: {
				default: "",
			},
			// 기본값은 null이다 — 명시하지 않은 이미지와 `width="100%"`을 구분해야 한다.
			// `100%`를 기본값으로 두면 저장할 때 명시와 기본값을 가릴 수 없어 의미가 바뀐다(O2).
			width: {
				default: null,
			},
			align: {
				default: "center",
			},
			caption: {
				default: "",
			},
			// 장식 표시(`decorative`). 참일 때만 저장한다.
			decorative: {
				default: null,
			},
			// Markdown 이미지의 타이틀(`![alt](src "title")`) 보존용. 화면에는 쓰지 않는다.
			title: {
				default: null,
			},
			crop: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-crop"),
				renderHTML: (attributes) => (attributes.crop ? { "data-crop": attributes.crop } : {}),
			},
			rotate: {
				default: null,
				parseHTML: (element) => element.getAttribute("data-rotate"),
				renderHTML: (attributes) => (attributes.rotate ? { "data-rotate": String(attributes.rotate) } : {}),
			},
		};
	},

	parseHTML() {
		return [
			{
				tag: "img[src]",
			},
			{
				tag: "figure[data-image-block]",
			},
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ["figure", mergeAttributes(HTMLAttributes, { "data-image-block": "" })];
	},

	addNodeView() {
		return ReactNodeViewRenderer(CmsImageNodeView);
	},
});
