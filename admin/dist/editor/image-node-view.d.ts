import { type NodeViewProps } from "@tiptap/react";
import type React from "react";
/** Width input: 1 to 100%, or a positive integer px of at most 4096. Empty means fit to the body. */
export declare const isValidImageWidth: (value: string) => boolean;
export declare function CmsImageNodeView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps): React.JSX.Element;
