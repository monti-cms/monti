"use client";

import {
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { flushSync } from "react-dom";
import { REVEAL_EVENT } from "../code-ref/dom";
import { ancestorsOf, filesOf, type TreeFile, type TreeNode } from "./tree";

/** Fixed text of the public component. The site language picks it in `render.tsx` (`shared/labels.messages.ts`). */
export interface CodeExplorerLabels {
	/** Accessible name of the file tree. */
	readonly files: string;
	/** Hint of the button that opens and closes the file list on a narrow screen. */
	readonly toggle: string;
}

const DEFAULT_LABELS: CodeExplorerLabels = { files: "Files", toggle: "Show or hide the file list" };

/** The nodes that can be reached with the arrow keys: every folder and file whose folders above it are open, in display order. */
function visibleNodes(nodes: readonly TreeNode[], collapsed: ReadonlySet<string>): TreeNode[] {
	return nodes.flatMap((node) =>
		node.kind === "folder" && !collapsed.has(node.path) ? [node, ...visibleNodes(node.children, collapsed)] : [node],
	);
}

const indexNodes = (nodes: readonly TreeNode[], into = new Map<string, TreeNode>()) => {
	for (const node of nodes) {
		into.set(node.path, node);
		if (node.kind === "folder") indexNodes(node.children, into);
	}
	return into;
};

interface BranchProps {
	readonly nodes: readonly TreeNode[];
	readonly level: number;
	readonly current: number | null;
	readonly collapsed: ReadonlySet<string>;
	readonly tabStop: string | undefined;
}

/** One level of the tree (`group`, or the `tree` itself at level 1). Click and key handling is on the tree root, which finds the item by `data-path`. */
function Branch({ nodes, level, current, collapsed, tabStop }: BranchProps) {
	return nodes.map((node, position) => {
		const folder = node.kind === "folder";
		const open = folder && !collapsed.has(node.path);
		return (
			<div
				key={node.path}
				role="treeitem"
				className="cms-block-code-explorer-item"
				data-path={node.path}
				data-kind={node.kind}
				// A folder's own name, not the names of everything inside it.
				aria-label={folder ? node.name : undefined}
				aria-level={level}
				aria-setsize={nodes.length}
				aria-posinset={position + 1}
				aria-expanded={folder ? open : undefined}
				aria-selected={node.kind === "file" && node.selectable ? node.index === current : undefined}
				aria-disabled={node.kind === "file" && !node.selectable ? true : undefined}
				tabIndex={node.path === tabStop ? 0 : -1}
			>
				<span className="cms-block-code-explorer-label">{node.name}</span>
				{folder && open && node.children.length > 0 ? (
					// biome-ignore lint/a11y/useSemanticElements: the WAI-ARIA tree pattern needs `role="group"` for the children of an item, and a fieldset is not one
					<div role="group" className="cms-block-code-explorer-group">
						<Branch nodes={node.children} level={level + 1} current={current} collapsed={collapsed} tabStop={tabStop} />
					</div>
				) : null}
			</div>
		);
	});
}

/**
 * The switching part of the code explorer. Renders the file tree (WAI-ARIA tree: arrow keys, Home, End, Enter and Space, one tab stop) and one panel per file that has
 * code. The server renders and passes the panels (the original code blocks), so here only the shown file is switched (the rest are `hidden`) and folders opened and closed.
 * A `cms:reveal` event from inside a hidden panel (a code link to a line of that file) shows that file first, so the scroll that follows lands on visible lines.
 * On a narrow screen the tree sits above the code behind a button that shows the current path.
 */
export function CodeExplorerView({
	tree,
	panels,
	initial,
	labels = DEFAULT_LABELS,
}: {
	/** The tree built from the paths (`buildTree`). */
	readonly tree: readonly TreeNode[];
	/** Code block of each entry, by `TreeFile.index`. `null` for entries with no panel. */
	readonly panels: readonly ReactNode[];
	/** `index` of the file shown first, or `null` when no file has code (only the tree is shown). */
	readonly initial: number | null;
	readonly labels?: CodeExplorerLabels;
}) {
	const treeId = useId();
	const root = useRef<HTMLDivElement>(null);
	const nodes = useMemo(() => indexNodes(tree), [tree]);
	const files = useMemo(() => filesOf(tree), [tree]);
	const [current, setCurrent] = useState(initial);
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
	const [navOpen, setNavOpen] = useState(false);
	const currentFile = files.find((file) => file.index === current);
	const [focusPath, setFocusPath] = useState<string | undefined>(currentFile?.path ?? tree[0]?.path);

	const visible = visibleNodes(tree, collapsed);
	// The one item reachable with the Tab key: the last focused one, or the first when it is hidden by a closed folder.
	const tabStop = visible.some((node) => node.path === focusPath) ? focusPath : visible[0]?.path;

	/** Shows a file and opens the folders above it. */
	const show = useCallback((file: TreeFile) => {
		setCurrent(file.index);
		setCollapsed((previous) => {
			const parents = ancestorsOf(file.path).filter((path) => previous.has(path));
			if (parents.length === 0) return previous;
			const next = new Set(previous);
			for (const path of parents) next.delete(path);
			return next;
		});
	}, []);

	useEffect(() => {
		const element = root.current;
		if (!element) return;
		const onReveal = (event: Event) => {
			const panel = (event.target as Element | null)?.closest?.("[data-code-explorer-panel]");
			if (!panel || !element.contains(panel)) return;
			const file = files.find((item) => item.index === Number(panel.getAttribute("data-code-explorer-panel")));
			if (file) flushSync(() => show(file));
		};
		element.addEventListener(REVEAL_EVENT, onReveal);
		return () => element.removeEventListener(REVEAL_EVENT, onReveal);
	}, [files, show]);

	const toggle = (path: string) =>
		setCollapsed((previous) => {
			const next = new Set(previous);
			if (!next.delete(path)) next.add(path);
			return next;
		});

	/** Folder: open or close it. Selectable file: show it (and close the list on a narrow screen). A file with no code does nothing. */
	const activate = (node: TreeNode) => {
		if (node.kind === "folder") toggle(node.path);
		else if (node.selectable) {
			show(node);
			setNavOpen(false);
		}
	};

	const focusItem = (path: string) => {
		setFocusPath(path);
		const items = root.current?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? [];
		for (const item of items) if (item.getAttribute("data-path") === path) item.focus();
	};

	const nodeOf = (target: EventTarget | null) => {
		const path = (target as Element | null)?.closest?.('[role="treeitem"]')?.getAttribute("data-path");
		return path === null || path === undefined ? undefined : nodes.get(path);
	};

	const onClick = (event: MouseEvent) => {
		const node = nodeOf(event.target);
		if (!node) return;
		setFocusPath(node.path);
		activate(node);
	};

	const onKeyDown = (event: KeyboardEvent) => {
		const node = nodeOf(event.target);
		if (!node || event.altKey || event.ctrlKey || event.metaKey) return;
		const position = visible.findIndex((item) => item.path === node.path);
		const parent = nodes.get(ancestorsOf(node.path).at(-1) ?? "");
		const isOpen = node.kind === "folder" && !collapsed.has(node.path);
		let target: string | undefined;
		switch (event.key) {
			case "ArrowDown":
				target = visible[position + 1]?.path;
				break;
			case "ArrowUp":
				target = visible[position - 1]?.path;
				break;
			case "Home":
				target = visible[0]?.path;
				break;
			case "End":
				target = visible.at(-1)?.path;
				break;
			case "ArrowRight":
				if (node.kind === "folder") {
					if (!isOpen) toggle(node.path);
					else target = node.children[0]?.path;
				}
				break;
			case "ArrowLeft":
				if (isOpen) toggle(node.path);
				else target = parent?.path;
				break;
			case "Enter":
			case " ":
				activate(node);
				break;
			default:
				return;
		}
		event.preventDefault();
		if (target) focusItem(target);
	};

	return (
		<div
			ref={root}
			className="cms-block-code-explorer"
			data-nav-open={navOpen || undefined}
			data-tree-only={currentFile ? undefined : ""}
		>
			<div className="cms-block-code-explorer-layout">
				<div className="cms-block-code-explorer-nav">
					{currentFile ? (
						<button
							type="button"
							className="cms-block-code-explorer-toggle"
							title={labels.toggle}
							aria-expanded={navOpen}
							aria-controls={treeId}
							onClick={() => setNavOpen(!navOpen)}
						>
							{currentFile.path}
						</button>
					) : null}
					{/* The tree root handles clicks and keys for its items, which are the focusable elements (roving tabindex). */}
					<div
						id={treeId}
						role="tree"
						className="cms-block-code-explorer-tree"
						aria-label={labels.files}
						onClick={onClick}
						onKeyDown={onKeyDown}
					>
						<Branch nodes={tree} level={1} current={current} collapsed={collapsed} tabStop={tabStop} />
					</div>
				</div>
				{currentFile ? (
					<div className="cms-block-code-explorer-code">
						{files.map((file) =>
							file.selectable ? (
								<div
									key={file.path}
									className="cms-block-code-explorer-panel"
									data-code-explorer-panel={file.index}
									hidden={file.index !== current}
								>
									{panels[file.index]}
								</div>
							) : null,
						)}
					</div>
				) : null}
			</div>
		</div>
	);
}
