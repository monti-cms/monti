import { visit } from "unist-util-visit";
/**
 * A line break is written as `<br />` followed by a line ending (`line<br />` + newline + `next`) so a paragraph reads well in source.
 * The line ending after the element is not content, so it is removed: otherwise the document would hold a stray newline in the text after every break
 * (and a renderer that turns newlines into breaks would break the line twice).
 */
export const remarkBreakNewline = () => (tree) => {
    visit(tree, (node) => {
        if (!("children" in node))
            return;
        const children = node.children;
        for (let index = children.length - 1; index > 0; index -= 1) {
            const previous = children[index - 1];
            const current = children[index];
            if (previous?.type !== "mdxJsxTextElement" || previous.name !== "br" || current?.type !== "text")
                continue;
            const value = current.value ?? "";
            const stripped = value.replace(/^\r?\n/, "");
            if (stripped === value)
                continue;
            if (stripped.length === 0)
                children.splice(index, 1);
            else
                current.value = stripped;
        }
    });
};
