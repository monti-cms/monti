"use client";

/** The design system's parts a block's editor view draws with, beside the ones above. */
export {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	FileTree,
	FileTreeRow,
	FolderTab,
	FolderTabEdit,
	FolderTabs,
	FolderTabsAdd,
	FolderTabsBody,
	FolderTabsList,
	FormFieldError,
	IconButton,
	Inline,
	Label,
	PopoverHeader,
	PopoverTitle,
	Stack,
	TableAddStrip,
	TableColumnBorder,
	TableGrip,
	Textarea,
} from "@monti-cms/ui";
/**
 * What a site's block (doc 18) draws its editor view with: `useBlock` to read and change its block, and the admin's parts for its frame, its tool row,
 * a name typed in the block, its children and a source field. They are the design system's, so a block the site changes still looks like the admin.
 */
/** The admin's language ("ko" or "en"), for a mark's card to pick its words. */
export {
	BlockBar,
	BlockBarButton,
	BlockBarMenu,
	BlockBarToggle,
	BlockContent,
	BlockFrame,
	BlockTitle,
	SourceBlock,
	SourcePanel,
	useBarHold,
	useBlock,
	useBlockLanguage,
} from "./editor/block-api";
