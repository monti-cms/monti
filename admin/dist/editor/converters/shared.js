export const asString = (value) => (typeof value === "string" ? value : undefined);
export const asNumber = (value) => (typeof value === "number" ? value : undefined);
/** Same shape as the node `to-document` creates when reading `:br[]` (the canonical form of a line break). */
export const brDirectiveNode = () => ({ type: "mdxJsx", attrs: { name: "br", attributes: [] } });
