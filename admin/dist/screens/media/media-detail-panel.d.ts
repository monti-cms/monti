import type { Folder } from "@monti-cms/core/runtime";
import type { MediaItem } from "../../api/media.js";
/**
 * Media detail. Opens on the right whichever view (grid or list) it was picked from.
 * From the top: preview -> immediate actions (copy URL/ID, open) -> info -> default description (images) -> usages -> delete.
 * The file name (its stem; the extension stays) and the default description are inputs with an AI button beside them (file name, alt text, caption
 * suggestions). A suggestion only fills the input. The name is saved by its own button and the default description by pressing `Save`;
 * unsaved changes are reported through `onDirtyChange` (used to ask before opening or closing another file).
 */
export declare function MediaDetailPanel({ media, folders, className, onClose, onSaveDefaults, onRename, onMoveFolder, onRequestDelete, onDirtyChange, }: {
    media: MediaItem;
    folders?: Folder[];
    className?: string;
    onClose: () => void;
    /** Saves the default description. Rejects on failure. The error shows inside the field. */
    onSaveDefaults: (defaults: {
        alt: string;
        caption: string;
    }) => Promise<void>;
    /** Renames the file (the whole new name, extension included). Rejects on failure. The error shows under the field. */
    onRename: (filename: string) => Promise<void>;
    /** Moves the file to another folder (or null for root). */
    onMoveFolder?: (folderId: string | null) => Promise<void>;
    onRequestDelete: () => void;
    onDirtyChange?: (dirty: boolean) => void;
}): import("react").JSX.Element;
