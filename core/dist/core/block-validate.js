/** Attributes of a stored code block that are the code itself, not settings of the block. */
const CODE_ATTRIBUTES = new Set(["code", "annotations"]);
const markKey = (mark) => `${mark.type}|${JSON.stringify(mark.attrs ?? null)}`;
/** The nodes of the document that belong to a block with a `validate`, in body order. A mark split over several text nodes counts once. */
function nodesToValidate(site, doc) {
    const found = [];
    const withCheck = (name) => {
        const block = site.BLOCK_BY_NAME.get(name);
        return block?.validate ? block : undefined;
    };
    const addMarks = (children, blockId) => {
        const open = new Set();
        for (const child of children) {
            if (child.text === undefined) {
                if (child.type === "hardBreak" || child.type === "footnoteReference")
                    continue;
                open.clear();
                continue;
            }
            const marks = new Map((child.marks ?? []).map((mark) => [markKey(mark), mark]));
            for (const key of open)
                if (!marks.has(key))
                    open.delete(key);
            for (const [key, mark] of marks) {
                if (open.has(key))
                    continue;
                open.add(key);
                const block = withCheck(mark.type);
                if (block)
                    found.push({
                        block,
                        node: { name: block.name, id: blockId, attributes: { ...mark.attrs }, source: undefined },
                    });
            }
        }
    };
    const visit = (node, parentId) => {
        if (node.text !== undefined)
            return;
        const blockId = node.id ?? parentId;
        const attrs = node.attrs ?? {};
        if (node.type === "codeBlock") {
            const language = attrs.language;
            const fence = site.fenceBlockOf(language);
            if (fence?.validate) {
                const settings = Object.fromEntries(Object.entries(attrs).filter(([key]) => !CODE_ATTRIBUTES.has(key)));
                const code = attrs.code;
                found.push({
                    block: fence,
                    node: { name: fence.name, id: blockId, attributes: settings, source: typeof code === "string" ? code : "" },
                });
            }
        }
        else if (node.type !== "unparsed") {
            const block = withCheck(node.type === "tableRow" ? "row" : node.type === "tableCell" ? "cell" : node.type);
            if (block)
                found.push({ block, node: { name: block.name, id: blockId, attributes: { ...attrs }, source: undefined } });
        }
        const children = node.content ?? [];
        addMarks(children, blockId);
        for (const child of children)
            visit(child, blockId);
    };
    for (const node of doc.content)
        visit(node, undefined);
    return found;
}
/** Warnings from the `validate` of every block in the document. Empty when no block of the site has one. */
export async function validateBlocks(site, doc, request) {
    const warnings = [];
    for (const { block, node } of nodesToValidate(site, doc)) {
        const position = node.id === undefined ? {} : { blockId: node.id };
        try {
            const issues = await block.validate?.(node, { site, locale: request.locale, operation: request.operation });
            for (const issue of issues ?? []) {
                warnings.push({
                    code: issue.code,
                    ...(issue.message === undefined ? {} : { message: issue.message }),
                    params: { ...issue.params, block: block.name },
                    path: "body",
                    position,
                });
            }
        }
        catch (error) {
            console.error(`[cms] validate of block ${block.name} failed`, error);
            warnings.push({
                code: "block_validate_failed",
                message: block.name,
                params: { block: block.name },
                path: "body",
                position,
            });
        }
    }
    return warnings;
}
