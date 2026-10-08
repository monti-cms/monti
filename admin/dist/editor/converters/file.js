/** Attachment file card (the `file` node: `mediaId` and `label`). An empty `label` is not saved. */
export const fileConverter = {
    name: "file",
    cmsTypes: ["file"],
    tiptapTypes: ["cmsFile"],
    isMappable: (node) => typeof node.attrs?.mediaId === "string" && node.attrs.mediaId !== "",
    toTiptap(node) {
        const label = node.attrs?.label;
        return {
            type: "cmsFile",
            attrs: { mediaId: node.attrs?.mediaId ?? null, label: typeof label === "string" && label ? label : null },
        };
    },
    toCms(node) {
        const attrs = {};
        if (typeof node.attrs?.mediaId === "string")
            attrs.mediaId = node.attrs.mediaId;
        if (typeof node.attrs?.label === "string" && node.attrs.label.trim())
            attrs.label = node.attrs.label;
        return [{ type: "file", attrs }];
    },
};
