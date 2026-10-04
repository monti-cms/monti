import type { AnnotationConfig, AnnotationRegistry, AnnotationRegistryItem, AnnotationScope } from "./types.js";
declare const normalizeConfigItems: (annotationConfig: AnnotationConfig) => AnnotationRegistryItem[];
export declare const supportsAnnotationScope: (item: AnnotationRegistryItem, scope: AnnotationScope) => boolean;
export declare const createAnnotationRegistry: (annotationConfig?: AnnotationConfig) => AnnotationRegistry;
export declare const __testable__: {
    normalizeConfigItems: typeof normalizeConfigItems;
    supportsAnnotationScope: typeof supportsAnnotationScope;
    createAnnotationRegistry: typeof createAnnotationRegistry;
};
export {};
