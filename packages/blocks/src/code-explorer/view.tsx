"use client";

import {
	AttributeInput,
	BlockFrame,
	BlockSettings,
	BlockSettingsField,
	ContainerToolbar,
	Content,
	formatMeta,
	ToolbarButton,
	useBlockEditor,
	useTranslator,
} from "@monti-cms/admin";
import {
	cn,
	commonMessages,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Text,
} from "@monti-cms/admin/kit";
import { File, FilePlus, Folder, FolderPlus, FolderTree, Trash2 } from "lucide-react";
import { useId } from "react";
import { filesOf, uniquePath } from "./editor-files";
import { codeExplorerMessages } from "./messages";

/** Placeholder paths of new entries. They are made unique against the paths already in the explorer. */
const NEW_FILE = { stem: "src/new-file", suffix: ".ts", language: "ts" } as const;
const NEW_FOLDER = { stem: "src/new-folder", suffix: "/", language: "text" } as const;

/**
 * Code explorer editing view (theme colors). The header lists the files (the code blocks' titles) and clicking one moves the cursor into
 * that file; the file holding the cursor is marked. Below it every file is an ordinary code block, edited in place (the path in its title field).
 * The toolbar adds files and folders, picks the file shown first, and deletes the block.
 */
export function CodeExplorerNodeView() {
	const t = useTranslator(codeExplorerMessages);
	const tc = useTranslator(commonMessages);
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
		<BlockFrame className="my-spacious rounded-md border bg-monti-page">
			<div
				contentEditable={false}
				className="not-prose flex flex-col gap-condensed rounded-t-md bg-monti-neutral px-normal py-condensed"
			>
				<div className="flex items-center gap-condensed font-medium text-monti-body text-monti-default">
					<FolderTree aria-hidden className="size-4 shrink-0 text-monti-muted" />
					{t("label")}
				</div>
				{files.length > 0 ? (
					<ul aria-label={t("files")} className="m-0 flex list-none flex-wrap gap-tight p-0">
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
											"inline-flex max-w-full items-center gap-tight rounded-md border border-transparent px-condensed py-hair font-mono text-monti-caption text-monti-muted hover:bg-monti-hover hover:text-monti-default",
											current && "border-monti-muted bg-monti-page text-monti-default",
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
					"px-normal pt-condensed pb-normal text-monti-default",
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
					<ToolbarButton label={tc("addFolder")} onClick={() => addEntry(NEW_FOLDER)}>
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
									<SelectTrigger id={openId} size="sm" width="full">
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
									boxed
								/>
							)}
							<Text as="p" variant="caption" tone="muted">
								{t("open.hint")}
							</Text>
						</BlockSettingsField>
					</BlockSettings>
					<ToolbarButton label={t("delete")} tone="danger" onClick={removeBlock}>
						<Trash2 aria-hidden />
					</ToolbarButton>
				</ContainerToolbar>
			) : null}
		</BlockFrame>
	);
}
