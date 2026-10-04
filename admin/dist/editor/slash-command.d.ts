import type { BlockDefinition } from "@monti-cms/core/client";
import type { Editor, Range } from "@tiptap/core";
import { type LucideIcon } from "lucide-react";
import { type BlockInsertAction } from "./block-inserts.js";
export { OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts.js";
export interface SlashCommandItem {
    /** Name of the block insertion item (nodeView for core blocks, block name for added blocks). Absent for basic formatting items. */
    id?: string;
    /** Icon. For block insertion items it is the block definition's `editor.icon` (lucide name). A puzzle icon if absent. */
    icon?: LucideIcon | string;
    title: string;
    description: string;
    keywords: string[];
    action: (editor: Editor, range: Range) => void;
}
/**
 * Basic formatting and inline slash commands.
 */
export declare const BASE_SLASH_COMMANDS: SlashCommandItem[];
/**
 * Among block definitions (BLOCKS) with `editor.insertable === true` and `editor.view === 'node'`,
 * generates the slash command list for blocks with a registered insert action.
 */
export declare function buildBlockSlashCommands(definitions?: readonly BlockDefinition[], actions?: Record<string, BlockInsertAction>): SlashCommandItem[];
/**
 * `/` block insertion menu. Searchable by Korean and English names.
 * The post title is the H1 above the body, so body headings start at H2.
 */
export declare const SLASH_COMMANDS: SlashCommandItem[];
/**
 * Slash menu items. `extra` are items added by edit view extensions (plugins) (appended after), and `inline` are items added by text decoration extensions
 * (after the basic text formatting items, before block items).
 */
export declare function filterCommands(query: string, extra?: readonly SlashCommandItem[], inline?: readonly SlashCommandItem[]): SlashCommandItem[];
