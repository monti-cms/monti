import type { CmsNode } from "@monti-cms/core/mdx";
export declare const asString: (value: unknown) => string | undefined;
export declare const asNumber: (value: unknown) => number | undefined;
/** Same shape as the node `to-document` creates when reading `:br[]` (the canonical form of a line break). */
export declare const brDirectiveNode: () => CmsNode;
