import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlockNodeView } from "./blocks/block-node-view.js";
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
            // The default is null — an image with no explicit width must be told apart from `width="100%"`.
            // With `100%` as the default, an explicit value and the default could not be distinguished on save, which changes the meaning.
            width: {
                default: null,
            },
            align: {
                default: "center",
            },
            caption: {
                default: "",
            },
            // Decorative marker (`decorative`). Saved only when true.
            decorative: {
                default: null,
            },
            // For preserving a Markdown image title (`![alt](src "title")`). Not used on screen.
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
        return ReactNodeViewRenderer(BlockNodeView);
    },
});
