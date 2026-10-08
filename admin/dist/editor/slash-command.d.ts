import { type BlockDefinition, type Site } from "@monti-cms/core/client";
import type { Editor, Range } from "@tiptap/core";
import { type LucideIcon } from "lucide-react";
import type { TranslatorFor } from "../translator.js";
import { type EditorAllowance } from "./allowed.js";
import { type BlockInsertAction } from "./block-inserts.js";
import { editorMessages } from "./messages.js";
export { OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts.js";
export interface SlashCommandItem {
    /** Name of the block insertion item (nodeView for core blocks, block name for added blocks). Absent for basic formatting items. */
    id?: string;
    /** Icon. For block insertion items it is the block definition's `editor.icon` (lucide name). A puzzle icon if absent. */
    icon?: LucideIcon | string;
    title: string;
    description: string;
    keywords: string[];
    /** The block this item inserts, by its name in the body's allowed list (`table`, `callout`, ...). The item is left out where the list does not allow it. */
    block?: string;
    /** The heading level this item sets. The item is left out where the list does not allow that level. */
    heading?: number;
    action: (editor: Editor, range: Range) => void;
}
/** Whether the allowed list of the body lets this item be offered. */
export declare const isOffered: (item: SlashCommandItem, allowance: EditorAllowance) => boolean;
/**
 * Basic formatting and inline slash commands.
 */
export declare const baseSlashCommands: (t: TranslatorFor<typeof editorMessages>) => SlashCommandItem[];
/**
 * Among block definitions (site.BLOCKS) with `editor.insertable === true` and `editor.view === 'node'`,
 * generates the slash command list for blocks with a registered insert action.
 */
export declare function buildBlockSlashCommands(site: Site, definitions?: readonly BlockDefinition[], actions?: Record<string, BlockInsertAction>): SlashCommandItem[];
/** The slash menu of a site: the basic formatting items, then its block insertion items (core blocks after added blocks). */
export declare const slashCommands: (site: Site) => SlashCommandItem[];
/**
 * Slash menu items. `extra` are items added by edit view extensions (plugins) (appended after), and `inline` are items added by text decoration extensions
 * (after the basic text formatting items, before block items). `allowance` is what the body's allowed list lets a writer add.
 */
export declare function filterCommands(site: Site, query: string, extra?: readonly SlashCommandItem[], inline?: readonly SlashCommandItem[], allowance?: EditorAllowance): SlashCommandItem[];
