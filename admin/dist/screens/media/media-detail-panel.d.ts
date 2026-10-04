import { type MediaItem } from "./media-item.js";
/**
 * Media detail. Opens on the right whichever view (grid or list) it was picked from.
 * From the top: preview -> immediate actions (copy URL/ID, open) -> info -> default description (images) -> usages -> delete.
 * Name and default description have AI slots (file name, alt text, caption suggestions). The default description is saved only by pressing `Save`,
 * and unsaved changes are reported through `onDirtyChange` (used to ask before opening or closing another file).
 */
export declare function MediaDetailPanel({ media, className, onClose, onSaveDefaults, onRename, onRequestDelete, onDirtyChange, }: {
    media: MediaItem;
    className?: string;
    onClose: () => void;
    /** Saves the default description. Rejects on failure. The error shows inside the field. */
    onSaveDefaults: (defaults: {
        alt: string;
        caption: string;
    }) => Promise<void>;
    onRename: (filename: string) => void;
    onRequestDelete: () => void;
    onDirtyChange?: (dirty: boolean) => void;
}): import("react").JSX.Element;
