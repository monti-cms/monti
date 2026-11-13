"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { Add, DocumentBlank, Folder, FolderOpen } from "./icons";

/**
 * A code explorer's file tree in the editor (editor-tools.md, the code explorer): the files of the block, by their paths, one row each, folders
 * first where their first file is. Rows are `FileTreeRow`; `FileTreeAdd` ends it.
 */
function FileTree({ className, ...props }: ComponentProps<"div">) {
	return <div data-slot="file-tree" role="tree" className={cn("flex flex-col gap-px", className)} {...props} />;
}

/** Each step in is this much further in (16px), past the row's own 8px. */
const DEPTH = ["pl-monti-8", "pl-monti-24", "pl-monti-40"] as const;

/**
 * One file or folder of a `FileTree`: its icon and name (mono), stepped in by `depth`. `current` is the file whose code shows beside the tree, on the
 * current ground. `more` is the row's own control at its end (the file's ⋯ menu): it shows while the row is pointed at, holds the focus or is
 * current, and keeps its place otherwise, so the name does not move.
 */
function FileTreeRow({
	name,
	folder = false,
	open = true,
	depth = 0,
	current = false,
	more,
	className,
	...props
}: Omit<ButtonPrimitive.Props, "children"> & {
	name: string;
	folder?: boolean;
	/** A folder whose files show under it. */
	open?: boolean;
	depth?: 0 | 1 | 2;
	current?: boolean;
	more?: ReactNode;
}) {
	const Icon = folder ? (open ? FolderOpen : Folder) : DocumentBlank;
	return (
		<div
			data-slot="file-tree-row"
			role="treeitem"
			aria-selected={folder ? undefined : current}
			aria-expanded={folder ? open : undefined}
			data-current={current || undefined}
			className="group/file-row relative flex items-center rounded-monti-md text-monti-subtle transition-colors hover:bg-monti-selected hover:text-monti-default data-current:bg-monti-current data-current:text-monti-default"
		>
			<ButtonPrimitive
				type="button"
				className={cn(
					"flex h-monti-control-sm min-w-0 grow cursor-pointer items-center gap-monti-6 rounded-monti-md border-0 bg-transparent pr-monti-4 font-mono text-inherit text-monti-code outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50 focus-visible:ring-inset",
					DEPTH[depth],
					className,
				)}
				{...props}
			>
				<Icon aria-hidden className="size-monti-icon-sm shrink-0" />
				<span className="truncate">{name}</span>
			</ButtonPrimitive>
			{more ? (
				<span className="flex shrink-0 pr-monti-2 opacity-0 transition-opacity group-focus-within/file-row:opacity-100 group-hover/file-row:opacity-100 has-aria-expanded:opacity-100 group-data-current/file-row:opacity-100">
					{more}
				</span>
			) : null}
		</div>
	);
}

/** The row at the end of a `FileTree` that adds a file: a + and its words, quiet until pointed at. */
function FileTreeAdd({ children, className, ...props }: ButtonPrimitive.Props) {
	return (
		<div role="none" className="flex">
			<ButtonPrimitive
				data-slot="file-tree-add"
				type="button"
				className={cn(
					"flex h-monti-control-sm grow cursor-pointer items-center gap-monti-6 rounded-monti-md border-0 bg-transparent pl-monti-8 text-monti-caption text-monti-subtle outline-none transition-colors hover:bg-monti-selected hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/50 focus-visible:ring-inset",
					className,
				)}
				{...props}
			>
				<Add aria-hidden className="size-monti-icon-sm shrink-0" />
				{children}
			</ButtonPrimitive>
		</div>
	);
}

export { FileTree, FileTreeAdd, FileTreeRow };
