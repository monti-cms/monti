import type { CmsNode } from "@monti-cms/core/document";
export declare const asString: (value: unknown) => string | undefined;
export declare const asNumber: (value: unknown) => number | undefined;
/** The one node a line break is in the document (`to-document` reads every notation of a break into it; the serializer writes it as `<br />`). */
export declare const lineBreakNode: () => CmsNode;
