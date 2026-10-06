import type { BlockProps, DocumentComponentsContext, LooseDocumentComponents } from "@monti-cms/core/render";
import { readCodeBlock } from "@monti-cms/core/render";
import { Children, Fragment, isValidElement, type PropsWithChildren, type ReactNode } from "react";
import { type BlockLabels, blockLabels } from "../shared/labels";
import type { codeExplorerBlock } from "./definition";
import { CodeExplorerView } from "./render.client";
import { buildTree, filesOf, parsePath, type TreeEntry } from "./tree";

interface FileInfo {
	readonly path: string;
	readonly code: boolean;
}

/** A titled code block (the core code block copies the fence meta, so `title` and the original `code` are on its props). */
const asFile = (child: ReactNode): FileInfo | undefined => {
	if (!isValidElement(child)) return undefined;
	const { title, code } = child.props as { title?: unknown; code?: unknown };
	if (typeof title !== "string" || parsePath(title).segments.length === 0) return undefined;
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
function Explorer({
	open,
	labels,
	files,
	items,
}: {
	readonly open?: string;
	readonly labels: BlockLabels;
	readonly files: readonly (FileInfo | undefined)[];
	readonly items: readonly ReactNode[];
}) {
	const entries = files.flatMap((file, index) => (file ? [{ item: index, ...file }] : []));
	if (entries.length === 0) return <>{items}</>;

	const treeEntries: TreeEntry[] = entries;
	const { nodes, rejected } = buildTree(treeEntries);
	// A rejected block with code is kept as content; one with no code holds nothing to lose.
	const keptItems = new Set(rejected.flatMap((index) => (entries[index]?.code ? [entries[index]?.item] : [])));

	const selectable = filesOf(nodes).filter((file) => file.selectable);
	// Only the code blocks that get a panel are sent to the client view; the others are in the tree or rendered after it.
	const panels = entries.map((entry, index) =>
		selectable.some((file) => file.index === index) ? items[entry.item] : null,
	);
	const wanted = open === undefined ? "" : parsePath(open).segments.join("/");
	const initial = (selectable.find((file) => file.path === wanted) ?? selectable[0])?.index ?? null;

	const rest = items.filter((_, index) => !files[index] || keptItems.has(index));
	return (
		<>
			<CodeExplorerView
				tree={nodes}
				panels={panels}
				initial={initial}
				labels={{ files: labels.codeExplorerFiles, toggle: labels.codeExplorerToggle }}
			/>
			{rest}
		</>
	);
}

/**
 * Code explorer. Builds a file tree from the paths in the code blocks' `title` and shows the code of one file at a time (`open`, the path of the file shown first,
 * or the first file that has code). Switching is done by a client component (`CodeExplorerView`); every file's code block is rendered here and only hidden there.
 */
export function CodeExplorer({
	open,
	labels = blockLabels(),
	children,
}: PropsWithChildren<{ open?: string; labels?: BlockLabels }>) {
	const items = Children.toArray(children);
	return <Explorer open={open} labels={labels} files={items.map(asFile)} items={items} />;
}

/** A child of the stored block: a code block with a path in its `title` is a file. The path and the code are read from the stored node, not from a rendered element. */
const fileOf = (node: BlockProps<typeof codeExplorerBlock>["items"][number]["node"]): FileInfo | undefined => {
	if (node.type !== "codeBlock") return undefined;
	const { title, code } = readCodeBlock(node);
	if (typeof title !== "string" || parsePath(title).segments.length === 0) return undefined;
	return { path: title, code: code.trim() !== "" };
};

/** Public components for the code explorer in the JSON renderer (`renderDocument`): the block `code-explorer`, reading its files from the stored code blocks. */
export const documentComponents = ({ locale }: DocumentComponentsContext): LooseDocumentComponents => {
	const labels = blockLabels(locale);
	return {
		blocks: {
			"code-explorer": ({ open, items }: BlockProps<typeof codeExplorerBlock>) => (
				<Explorer
					open={open}
					labels={labels}
					files={items.map((item) => fileOf(item.node))}
					items={items.map((item, index) => <Fragment key={item.node.id ?? index}>{item.element}</Fragment>)}
				/>
			),
		},
	};
};
