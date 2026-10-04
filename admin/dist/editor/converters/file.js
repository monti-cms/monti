/** Attachment file card (`::file{mediaId label}`). An empty `label` is not saved. */
export const fileConverter = {
    name: "file",
    cmsTypes: ["File"],
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
        const record = {};
        if (typeof node.attrs?.mediaId === "string")
            record.mediaId = node.attrs.mediaId;
        if (typeof node.attrs?.label === "string" && node.attrs.label.trim())
            record.label = node.attrs.label;
        const attributes = Object.entries(record).map(([name, value]) => ({ name, value }));
        return [{ type: "File", attrs: { ...record, name: "File", attributes } }];
    },
};
