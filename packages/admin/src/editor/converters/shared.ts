import type { CmsNode } from "@monti-cms/core/mdx";

export const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
export const asNumber = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

/** Same shape as the node `to-document` creates when reading `:br[]` (the canonical form of a line break). */
export const brDirectiveNode = (): CmsNode => ({ type: "mdxJsx", attrs: { name: "br", attributes: [] } });
