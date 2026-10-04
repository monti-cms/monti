import type { CmsJsonValue, CmsJsxAttribute, CmsMdxPosition } from "./types.js";
type PositionLike = {
    start?: {
        line?: number;
        column?: number;
    };
};
export declare const positionOf: (node: {
    position?: PositionLike;
} | undefined) => CmsMdxPosition;
export declare const readJsxAttributes: (attributes: unknown[] | undefined) => CmsJsxAttribute[];
export declare const attributeRecord: (attributes: CmsJsxAttribute[]) => Record<string, CmsJsonValue>;
export {};
