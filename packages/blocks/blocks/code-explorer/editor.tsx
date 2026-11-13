"use client";

import {
	BlockBar,
	BlockBarMenu,
	BlockContent,
	BlockFrame,
	BlockTitle,
	Button,
	FileTree,
	FileTreeRow,
	IconButton,
	useBlock,
} from "@monti-cms/admin/blocks";
import { Add, Star, TrashCan } from "@monti-cms/admin/icons";
import { Fragment, type ReactNode, useEffect, useState } from "react";
import { style } from "./style";
import { buildTree, parsePath, type TreeNode } from "./tree";
import { words } from "./words";

const fill = (text: string, name: string) => text.replace("{name}", name);

/**
 * The code explorer in the editor (doc 18): the tree made from its files' paths, the picked file's path and code beside it (each file is an ordinary code
 * block of doc 17). "+ File" and "+ Folder" under the tree add one; a file's row deletes it; the tool row's ★ menu says which file shows first (✓).
 */
export default function CodeExplorerEditor() {
	const block = useBlock();
	const say = (label: { ko: string; en: string }) => label[block.language];
	const paths = block.children.map((child) => (typeof child.attrs.title === "string" ? child.attrs.title : ""));
	const entries = paths.map((path, index) => ({ path, code: !block.children[index]?.empty }));
	const { nodes } = buildTree(entries.map((entry) => ({ ...entry, path: entry.path || " " })));
	const wanted = typeof block.attrs.open === "string" ? parsePath(block.attrs.open).segments.join("/") : "";
	const first = Math.max(
		0,
		paths.findIndex((path) => parsePath(path).segments.join("/") === wanted && wanted !== ""),
	);
	const [current, setCurrent] = useState(first);
	const shown = Math.min(current, paths.length - 1);
	useEffect(() => {
		if (block.childAt !== null) setCurrent(block.childAt);
	}, [block.childAt]);
	const files = paths.flatMap((path, index) => (path && !parsePath(path).folder ? [{ path, index }] : []));

	const row = (node: TreeNode, depth: number): ReactNode => {
		const index =
			node.kind === "file" ? node.index : paths.findIndex((path) => parsePath(path).segments.join("/") === node.path);
		return (
			<Fragment key={node.path}>
				<FileTreeRow
					name={node.name}
					folder={node.kind === "folder"}
					depth={Math.min(depth, 2) as 0 | 1 | 2}
					current={node.kind === "file" && index === shown}
					onClick={() => {
						if (index < 0) return;
						setCurrent(index);
						block.focusChild(index);
					}}
					more={
						block.editable && index >= 0 && paths.length > 1 ? (
							<IconButton
								size="xs"
								tone="danger"
								label={fill(say(words.remove), node.name)}
								onClick={() => {
									const opened = parsePath(paths[index] ?? "").segments.join("/") === wanted && wanted !== "";
									block.removeChild(index, opened ? { open: undefined } : undefined);
									setCurrent(index < shown ? shown - 1 : Math.max(0, Math.min(shown, paths.length - 2)));
								}}
							>
								<TrashCan aria-hidden />
							</IconButton>
						) : undefined
					}
				/>
				{node.kind === "folder" && node.children.map((child) => row(child, depth + 1))}
			</Fragment>
		);
	};

	return (
		<BlockFrame
			bar={
				files.length > 0 ? (
					<BlockBar label={say(words.tools)}>
						<BlockBarMenu
							label={say(words.first)}
							icon={<Star aria-hidden />}
							named
							title={say(words.first)}
							value={typeof block.attrs.open === "string" ? block.attrs.open : ""}
							options={[
								{ value: "", label: say(words.firstFile), icon: <Star aria-hidden /> },
								...files.map((file) => ({ value: file.path, label: file.path })),
							]}
							onChange={(open) => block.setAttrs({ open: open === "" ? undefined : open })}
						/>
					</BlockBar>
				) : undefined
			}
		>
			<style href="monti-block-code-explorer" precedence="monti-blocks">
				{style}
			</style>
			<div className="monti-block-code-explorer-editor">
				<div className="monti-block-code-explorer-side" contentEditable={false}>
					<FileTree>{nodes.map((node) => row(node, 0))}</FileTree>
					{block.editable && (
						<div className="monti-block-code-explorer-add">
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									block.insertChild({ type: "codeBlock", attrs: { title: say(words.newFile), language: "ts" } })
								}
							>
								<Add aria-hidden />
								{say(words.addFile)}
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => block.insertChild({ type: "codeBlock", attrs: { title: say(words.newFolder) } })}
							>
								<Add aria-hidden />
								{say(words.addFolder)}
							</Button>
						</div>
					)}
				</div>
				<div className="monti-block-code-explorer-main">
					{paths[shown] !== undefined && (
						<div className="monti-block-code-explorer-path" contentEditable={false}>
							<BlockTitle
								label={say(words.path)}
								value={paths[shown] ?? ""}
								onChange={(title) =>
									block.setChildAttrs(
										shown,
										{ title },
										// The file shown first is named by its path: moved, it stays the one.
										shown === first && wanted !== "" ? { open: title } : undefined,
									)
								}
								onDone={() => block.focusChild(shown)}
							/>
						</div>
					)}
					{/* Only the picked file's code shows, however many files there are. */}
					<style>{`[data-explorer-files="${shown}"] > [data-node-view-content] > div > :not(:nth-child(${shown + 1})) { display: none; }`}</style>
					<div className="monti-block-code-explorer-files" data-explorer-files={shown}>
						<BlockContent />
					</div>
				</div>
			</div>
		</BlockFrame>
	);
}
