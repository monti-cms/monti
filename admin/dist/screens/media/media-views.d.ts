import type { Folder } from "@monti-cms/core/site";
import type { MediaItem } from "../../api/media.js";
import { type MenuAction } from "../shared/action-menu.js";
import { type FolderActions } from "../shared/use-folder-actions.js";
/** Thumbnail for images, a type icon for other files. */
export declare function MediaThumb({ media, iconClassName }: {
    media: MediaItem;
    iconClassName?: string;
}): import("react").JSX.Element;
export interface MediaViewProps {
    items: readonly MediaItem[];
    /** The file open in the right detail panel. Highlighted with `OPEN_ITEM`. */
    selectedId: string | null;
    /** Dims the previous rows while conditions change. */
    dimmed: boolean;
    onSelect: (media: MediaItem) => void;
    menuFor: (media: MediaItem) => MenuAction[];
    /** Delete key. Only unused files can be deleted. */
    onDeleteKey: (media: MediaItem) => void;
    explorer?: {
        folders: Folder[];
        parent: string | null;
    } | null;
    folders?: Folder[];
    folderActions?: FolderActions;
    onSelectFolder?: (folder: string) => void;
}
/** Grid view. Shows the thumbnail and usage state large. */
export declare function MediaGrid({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey, explorer, folders, folderActions, onSelectFolder, }: MediaViewProps): import("react").JSX.Element;
/** List view. Shows name, type, size, dimensions, usage state and upload date, one per row. */
export declare function MediaTable({ items, selectedId, dimmed, onSelect, menuFor, onDeleteKey, explorer, folders, folderActions, onSelectFolder, }: MediaViewProps): import("react").JSX.Element;
