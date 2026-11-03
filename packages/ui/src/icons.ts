import { Add, Folder, OverflowMenuHorizontal, Search } from "@carbon/icons-react";

/**
 * The design system's icon table: the name a screen spec writes for each Carbon icon (docs/design/admin/tokens.md, "아이콘"). A spec can name only these;
 * add a row here, and to the table in the docs, to use another.
 */
export const ICONS = {
	add: Add,
	folder: Folder,
	more: OverflowMenuHorizontal,
	search: Search,
} as const;

export type IconName = keyof typeof ICONS;
