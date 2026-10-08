/**
 * GFM footnote definition (`[^label]: content`). The content is ordinary block content, and a definition with none is given an empty paragraph so the editor has
 * somewhere to type (saving an empty paragraph writes `[^label]:` again).
 */
export const footnoteDefinitionConverter = {
    name: "footnoteDefinition",
    cmsTypes: ["footnoteDefinition"],
    tiptapTypes: ["footnoteDefinition"],
    isMappable: (node, ctx) => (node.content ?? []).every(ctx.isMappableBlock),
    toTiptap(node, ctx) {
        const blocks = (node.content ?? []).map(ctx.blockToTiptap);
        return {
            type: "footnoteDefinition",
            attrs: { label: typeof node.attrs?.label === "string" ? node.attrs.label : "" },
            content: blocks.length > 0 ? blocks : [{ type: "paragraph", content: [] }],
        };
    },
    toCms(node, ctx) {
        const children = (node.content ?? []).flatMap(ctx.tiptapBlockToCms);
        // A definition cannot hold another one in the stored form, so one that got nested (pasted, dragged) is moved out after its parent.
        const nested = children.filter((child) => child.type === "footnoteDefinition");
        const content = children.filter((child) => child.type !== "footnoteDefinition");
        return [
            {
                type: "footnoteDefinition",
                attrs: { label: typeof node.attrs?.label === "string" ? node.attrs.label : "" },
                content,
            },
            ...nested,
        ];
    },
};
