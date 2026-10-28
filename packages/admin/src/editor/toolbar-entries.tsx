/**
 * Assembles the toolbar entries of the visual editor from the tool definitions: which slots exist for the body's allowance,
 * their hide priority, how each renders in the bar and in the "More" menu, and the final placement order.
 */

import { Attachment, Image, Link, List, TextAlignLeft, TextSuperscript, Upload } from "@carbon/icons-react";
import type { Site } from "@monti-cms/core/site";
import type { MontiIcon } from "@monti-cms/ui";
import {
	Box,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	IconButton,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@monti-cms/ui";
import type { Editor } from "@tiptap/core";
import type { commonMessages } from "../lib/common.messages";
import type { TranslatorFor } from "../translator";
import type { EditorAllowance } from "./allowed";
import { CustomBlockMenu, CustomBlockMenuItems, offeredBlocks } from "./custom-block-menu";
import type { useMarkExtensions } from "./inline-bubble";
import { type LinkDraft, LinkForm, linkDraftFromSelection } from "./link-form";
import type { editorMessages } from "./messages";
import { ToolbarButton, type ToolbarItem } from "./toolbar-button";
import { ToolbarDropdown } from "./toolbar-dropdown";
import { type ToolbarEntry, ToolbarMenuGroup, ToolbarMenuItem, ToolbarMenuSection } from "./toolbar-row";
import {
	ALIGN_TOOLS,
	BLOCK_STYLES,
	DIVIDER_TOOL,
	FOOTNOTE_TOOL,
	INLINE_PRIORITY,
	INSERT_TOOLS,
	inlineTools,
	LIST_STYLES,
	markToolKey,
	orderToolbar,
	PINNED_INLINE_MARKS,
	scriptTools,
} from "./toolbar-tools";

export interface ToolbarEntryContext {
	editor: Editor;
	site: Site;
	t: TranslatorFor<typeof editorMessages>;
	tc: TranslatorFor<typeof commonMessages>;
	allowance: EditorAllowance;
	canEdit: boolean;
	/** Text-style extensions present in this editor's schema. */
	markExtensions: ReturnType<typeof useMarkExtensions>;
	/** Name of the current block shape (the block dropdown label). */
	blockStyle: string;
	activeList: ToolbarItem | undefined;
	activeAlign: ToolbarItem | undefined;
	linkDraft: LinkDraft | null;
	setLinkDraft: (draft: LinkDraft | null) => void;
	openImageDialog: () => void;
	openFilePicker: () => void;
}

export const buildToolbarEntries = ({
	editor,
	site,
	t,
	tc,
	allowance,
	canEdit,
	markExtensions,
	blockStyle,
	activeList,
	activeAlign,
	linkDraft,
	setLinkDraft,
	openImageDialog,
	openFilePicker,
}: ToolbarEntryContext): ToolbarEntry[] => {
	const buttonSlot = (item: ToolbarItem, key: string, priority: number, fixed = false): ToolbarEntry => ({
		key,
		priority,
		fixed,
		render: () => <ToolbarButton editor={editor} item={item} />,
		menu: () => <ToolbarMenuItem editor={editor} item={item} />,
	});
	const dropdownSlot = (
		key: string,
		priority: number,
		label: string,
		items: ToolbarItem[],
		icon: MontiIcon,
		menuLabel = label,
	): ToolbarEntry => ({
		key,
		priority,
		render: () => <ToolbarDropdown editor={editor} label={label} items={items} icon={icon} iconOnly />,
		menu: () => <ToolbarMenuGroup editor={editor} label={menuLabel} items={items} />,
	});
	const UploadMenuItems = () => (
		<>
			{allowance.allowsBlock("image") && (
				<DropdownMenuItem disabled={!canEdit} onClick={() => openImageDialog()}>
					<Image aria-hidden />
					<Box as="span" grow>
						{t("toolbar.image")}
					</Box>
				</DropdownMenuItem>
			)}
			{allowance.allowsBlock("file") && (
				<DropdownMenuItem disabled={!canEdit} onClick={() => openFilePicker()}>
					<Attachment aria-hidden />
					<Box as="span" grow>
						{t("toolbar.file")}
					</Box>
				</DropdownMenuItem>
			)}
		</>
	);
	// Order to hide when narrow: larger priority first. fixed is never hidden (popover tools lose their anchor inside the menu).
	// The placement order is decided by `TOOLBAR_ORDER(t)` below.
	const unordered: ToolbarEntry[] = [
		{
			key: "block-style",
			priority: 0,
			fixed: true,
			render: () => <ToolbarDropdown editor={editor} label={blockStyle} items={BLOCK_STYLES(t, allowance)} />,
		},
		...(allowance.allowsBlock("text-align")
			? [dropdownSlot("align", 9, t("toolbar.align"), ALIGN_TOOLS(t), activeAlign?.icon ?? TextAlignLeft)]
			: []),
		{ key: "divider-block", divider: true },
		...inlineTools(site, allowance).map((tool) =>
			buttonSlot(tool, tool.mark, INLINE_PRIORITY[tool.mark] ?? 5, PINNED_INLINE_MARKS.includes(tool.mark)),
		),
		// Formatting tools of text-style extensions (block extension text color, tooltip, etc.).
		...markExtensions.flatMap(({ name, extension }): ToolbarEntry[] => {
			const tool = extension.toolbar;
			if (!tool) return [];
			const { Button, MenuItems } = tool;
			return [
				{
					key: markToolKey(tool.group, name),
					priority: tool.priority ?? 0,
					fixed: tool.priority === undefined || !MenuItems,
					render: () => <Button editor={editor} />,
					...(MenuItems ? { menu: () => <MenuItems editor={editor} /> } : {}),
				},
			];
		}),
		...(scriptTools(site, allowance).length > 0
			? [dropdownSlot("script", 8, t("toolbar.script"), scriptTools(site, allowance), TextSuperscript)]
			: []),
		{ key: "divider-inline", divider: true },
		{ key: "divider-list", divider: true },
		{ key: "divider-insert", divider: true },
		dropdownSlot(
			"list",
			2,
			activeList?.title ?? t("toolbar.list"),
			LIST_STYLES(t, allowance),
			activeList?.icon ?? List,
			t("toolbar.list"),
		),
		...INSERT_TOOLS(t, allowance).map(({ tool, priority }) => buttonSlot(tool, tool.label, priority)),
		...(offeredBlocks(site, editor).length > 0
			? [
					{
						key: "custom-block",
						priority: 4,
						render: () => <CustomBlockMenu editor={editor} />,
						menu: () => (
							<ToolbarMenuSection label={t("toolbar.components")}>
								<CustomBlockMenuItems editor={editor} />
							</ToolbarMenuSection>
						),
					},
				]
			: []),
		...(allowance.allowsBlock("image") || allowance.allowsBlock("file")
			? [
					{
						key: "upload",
						// Hide later than underline (5). With the same priority, right-hand tools hide first.
						priority: 4,
						render: () => (
							<DropdownMenu>
								<IconButton
									label={tc("upload")}
									side="bottom"
									disabled={!canEdit}
									onMouseDown={(event) => event.preventDefault()}
									trigger={(button) => <DropdownMenuTrigger render={button} />}
								>
									<Upload aria-hidden />
								</IconButton>
								<DropdownMenuContent align="start">
									<UploadMenuItems />
								</DropdownMenuContent>
							</DropdownMenu>
						),
						menu: () => <UploadMenuItems />,
					},
				]
			: []),
		...(allowance.allowsMark("link")
			? [
					{
						key: "link",
						priority: 0,
						fixed: true,
						render: () => (
							<Popover
								open={linkDraft !== null}
								onOpenChange={(open) => setLinkDraft(open ? linkDraftFromSelection(editor) : null)}
							>
								<IconButton
									label={t("toolbar.link")}
									side="bottom"
									pressed={editor.isActive("link")}
									disabled={!canEdit}
									onMouseDown={(event) => event.preventDefault()}
									trigger={(button) => <PopoverTrigger render={button} />}
								>
									<Link aria-hidden />
								</IconButton>
								<PopoverContent align="start" width="md">
									{linkDraft && <LinkForm editor={editor} draft={linkDraft} onDone={() => setLinkDraft(null)} />}
								</PopoverContent>
							</Popover>
						),
					},
				]
			: []),
		...(allowance.allowsBlock("footnotes") ? [buttonSlot(FOOTNOTE_TOOL(t), FOOTNOTE_TOOL(t).label, 5)] : []),
		...(allowance.allowsBlock("horizontalRule") ? [buttonSlot(DIVIDER_TOOL(t), "divider-tool", 8)] : []),
	];
	return orderToolbar(t, unordered);
};
