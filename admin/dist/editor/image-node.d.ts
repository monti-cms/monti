import { Node } from "@tiptap/core";
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
export declare const CmsImageNode: Node<any, any>;
