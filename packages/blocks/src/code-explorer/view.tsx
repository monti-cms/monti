"use client";

import {
	AttributeInput,
	BlockSettings,
	BlockSettingsField,
	ContainerToolbar,
	formatMeta,
	ToolbarButton,
} from "@monti-cms/admin/blocks";
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";
import { cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { File, FilePlus, Folder, FolderPlus, FolderTree, Trash2 } from "lucide-react";
import { useId } from "react";
import { filesOf, uniquePath } from "./editor-files";
import { codeExplorerMessages } from "./messages";

const t = createTranslator(codeExplorerMessages);

/** Placeholder paths of new entries. They are made unique against the paths already in the explorer. */
const NEW_FILE = { stem: "src/new-file", suffix: ".ts", language: "ts" } as const;
const NEW_FOLDER = { stem: "src/new-folder", suffix: "/", language: "text" } as const;

/**
 * Code explorer editing view (theme colors). The header lists the files (the code blocks' titles) and clicking one moves the cursor into
 * that file; the file holding the cursor is marked. Below it every file is an ordinary code block, edited in place (the path in its title field).
 * The toolbar adds files and folders, picks the file shown first, and deletes the block.
 */
export function CodeExplorerNodeView() {
	const block = useBlockEditor<{ open: string }>();
	// `editable` follows lock changes (trash, source mode).
	const { editable, focusedChild: selectedIndex } = block;
	const openId = useId();
	const files = filesOf(block.children);
	const paths = files.filter((file) => !file.folder && file.path).map((file) => file.path);
	const open = typeof block.values.open === "string" ? block.values.open : "";

	const addEntry = ({ stem, suffix, language }: typeof NEW_FILE | typeof NEW_FOLDER) => {
		const title = uniquePath(
			files.map((file) => file.path),
			stem,
			suffix,
		);
		// At the end of the container, after the last child.
		block.addChild({ name: "codeBlock", values: { language, meta: formatMeta({ title }) }, focus: true });
	};

	const removeBlock = () => {
		block.remove();
	};

	// A stale `open` (a renamed or deleted file) stays selectable so the setting is visible and can be changed.
	const openItems = [
		{ value: "", label: t("open.first") },
		...[...new Set(open && !paths.includes(open) ? [...paths, open] : paths)].map((path) => ({
			value: path,
			label: path,
		})),
	];

	return (
		<BlockFrame className="my-6 rounded-md border bg-cms-background">
			<div contentEditable={false} className="not-prose flex flex-col gap-2 rounded-t-md bg-cms-muted px-3 py-2">
				<div className="flex items-center gap-2 font-medium text-cms-foreground text-sm">
					<FolderTree aria-hidden className="size-4 shrink-0 text-cms-muted-foreground" />
					{t("label")}
				</div>
				{files.length > 0 ? (
					<ul aria-label={t("files")} className="m-0 flex list-none flex-wrap gap-1 p-0">
						{files.map((file) => {
							const Icon = file.folder ? Folder : File;
							const current = file.index === selectedIndex;
							return (
								<li key={file.index}>
									<button
										type="button"
										aria-current={current ? "true" : undefined}
										onClick={() => block.focus({ child: file.index })}
										className={cn(
											"inline-flex max-w-full items-center gap-1 rounded border border-transparent px-1.5 py-0.5 font-mono text-cms-muted-foreground text-xs hover:bg-cms-accent hover:text-cms-foreground",
											current && "border-cms-border bg-cms-background text-cms-foreground shadow-xs",
										)}
									>
										<Icon aria-hidden className="size-3 shrink-0" />
										<span className="truncate">{file.path || t("untitled")}</span>
									</button>
								</li>
							);
						})}
					</ul>
				) : null}
			</div>
			<Content
				className={cn(
					"px-3 pt-2 pb-3 text-cms-foreground",
					// Set the first and last inner block prose margins to 0 so they do not add to the box padding (for nested custom blocks, the wrapper inside react-renderer holds the margin).
					"[&>*>:first-child]:mt-0 [&>*>:last-child]:mb-0",
					"[&>*>:first-child>[data-node-view-wrapper]]:mt-0 [&>*>:last-child>[data-node-view-wrapper]]:mb-0",
				)}
			/>
			{editable ? (
				<ContainerToolbar label={t("toolbar")}>
					<ToolbarButton label={t("add.file")} onClick={() => addEntry(NEW_FILE)}>
						<FilePlus aria-hidden />
					</ToolbarButton>
					<ToolbarButton label={t("add.folder")} onClick={() => addEntry(NEW_FOLDER)}>
						<FolderPlus aria-hidden />
					</ToolbarButton>
					<BlockSettings>
						<BlockSettingsField label={t("open.label")} htmlFor={openId}>
							{paths.length > 0 ? (
								<Select
									value={open}
									items={openItems}
									onValueChange={(next) => next !== null && block.setValue("open", String(next))}
								>
									<SelectTrigger id={openId} size="sm" className="h-7 w-full text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{openItems.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : (
								<AttributeInput
									id={openId}
									value={open}
									placeholder={t("open.first")}
									onCommit={(next) => block.setValue("open", next)}
									className="h-7 w-full rounded-md border border-cms-input cms-dark:bg-cms-input/30 px-2 text-xs shadow-xs placeholder:text-cms-muted-foreground placeholder:opacity-100 focus-visible:border-cms-ring focus-visible:ring-3 focus-visible:ring-cms-ring/50"
								/>
							)}
							<p className="text-cms-muted-foreground text-xs">{t("open.hint")}</p>
						</BlockSettingsField>
					</BlockSettings>
					<ToolbarButton label={t("delete")} destructive onClick={removeBlock}>
						<Trash2 aria-hidden />
					</ToolbarButton>
				</ContainerToolbar>
			) : null}
		</BlockFrame>
	);
}
