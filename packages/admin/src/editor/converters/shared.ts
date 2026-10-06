import type { CmsNode } from "@monti-cms/core/document";

export const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
export const asNumber = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

/** The one node a line break is in the document (`to-document` reads every notation of a break into it; the serializer writes it as `<br />`). */
export const lineBreakNode = (): CmsNode => ({ type: "hardBreak" });
