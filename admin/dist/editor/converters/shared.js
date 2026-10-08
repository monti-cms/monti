export const asString = (value) => (typeof value === "string" ? value : undefined);
export const asNumber = (value) => (typeof value === "number" ? value : undefined);
/** The one node a line break is in the document (`to-document` reads every notation of a break into it; the serializer writes it as `<br />`). */
export const lineBreakNode = () => ({ type: "hardBreak" });
