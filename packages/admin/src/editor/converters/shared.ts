import type { CmsNode } from "@monti-cms/core/mdx";

export const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
export const asNumber = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);

/** `:br[]`를 읽으면 `to-document`가 만드는 노드와 같은 모양이다(줄바꿈의 정본). */
export const brDirectiveNode = (): CmsNode => ({ type: "mdxJsx", attrs: { name: "br", attributes: [] } });
