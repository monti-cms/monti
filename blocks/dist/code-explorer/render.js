import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { readCodeBlock } from "@monti-cms/core/render";
import { Children, Fragment, isValidElement } from "react";
import { blockLabels } from "../shared/labels.js";
import { CodeExplorerView } from "./render.client.js";
import { buildTree, filesOf, parsePath } from "./tree.js";
/** A titled code block (the core code block copies the fence meta, so `title` and the original `code` are on its props). */
const asFile = (child) => {
    if (!isValidElement(child))
        return undefined;
    const { title, code } = child.props;
    if (typeof title !== "string" || parsePath(title).segments.length === 0)
        return undefined;
    return { path: title, code: typeof code === "string" ? code.trim() !== "" : true };
};
/**
 * What the explorer shows, from its children as a list: `files[i]` says what child `i` is (a file of the tree, or `undefined` for anything else) and
 * `items[i]` is that child as an element.
 *
 * - A code block with a path and no code is shown in the tree only; a path ending in `/` is a folder.
 * - Children that are not code blocks with a path are rendered after the explorer, unchanged. So are the code blocks with code that the tree cannot hold:
 *   a path that is a duplicate (the first one wins) or is both a file and a folder, and a folder entry with code. (One with no code holds nothing and is dropped.)
 * - With no code block that has a path, the children are rendered as they are.
 */
function Explorer({ open, labels, files, items, }) {
    const entries = files.flatMap((file, index) => (file ? [{ item: index, ...file }] : []));
    if (entries.length === 0)
        return _jsx(_Fragment, { children: items });
    const treeEntries = entries;
    const { nodes, rejected } = buildTree(treeEntries);
    // A rejected block with code is kept as content; one with no code holds nothing to lose.
    const keptItems = new Set(rejected.flatMap((index) => (entries[index]?.code ? [entries[index]?.item] : [])));
    const selectable = filesOf(nodes).filter((file) => file.selectable);
    // Only the code blocks that get a panel are sent to the client view; the others are in the tree or rendered after it.
    const panels = entries.map((entry, index) => selectable.some((file) => file.index === index) ? items[entry.item] : null);
    const wanted = open === undefined ? "" : parsePath(open).segments.join("/");
    const initial = (selectable.find((file) => file.path === wanted) ?? selectable[0])?.index ?? null;
    const rest = items.filter((_, index) => !files[index] || keptItems.has(index));
    return (_jsxs(_Fragment, { children: [_jsx(CodeExplorerView, { tree: nodes, panels: panels, initial: initial, labels: { files: labels.codeExplorerFiles, toggle: labels.codeExplorerToggle } }), rest] }));
}
/**
 * Code explorer. Builds a file tree from the paths in the code blocks' `title` and shows the code of one file at a time (`open`, the path of the file shown first,
 * or the first file that has code). Switching is done by a client component (`CodeExplorerView`); every file's code block is rendered here and only hidden there.
 */
export function CodeExplorer({ open, labels = blockLabels(), children, }) {
    const items = Children.toArray(children);
    return _jsx(Explorer, { open: open, labels: labels, files: items.map(asFile), items: items });
}
/** A child of the stored block: a code block with a path in its `title` is a file. The path and the code are read from the stored node, not from a rendered element. */
const fileOf = (node) => {
    if (node.type !== "codeBlock")
        return undefined;
    const { title, code } = readCodeBlock(node);
    if (typeof title !== "string" || parsePath(title).segments.length === 0)
        return undefined;
    return { path: title, code: code.trim() !== "" };
};
/** Public components for the code explorer in the JSON renderer (`renderDocument`): the block `code-explorer`, reading its files from the stored code blocks. */
export const documentComponents = ({ locale }) => {
    const labels = blockLabels(locale);
    return {
        blocks: {
            "code-explorer": ({ open, items }) => (_jsx(Explorer, { open: open, labels: labels, files: items.map((item) => fileOf(item.node)), items: items.map((item, index) => _jsx(Fragment, { children: item.element }, item.node.id ?? index)) })),
        },
    };
};
