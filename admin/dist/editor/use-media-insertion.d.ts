/**
 * Image and file insertion of the visual editor: the image dialog state (opened from the slash menu, the toolbar, paste and drop),
 * inserting the chosen image, the file picker, and uploading attachments as file cards.
 */
import type { Site } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import { type ClipboardEvent, type DragEvent } from "react";
import type { TranslatorFor } from "../translator.js";
import type { EditorAllowance } from "./allowed.js";
import type { ImageInsertion } from "./image-insert-dialog.js";
import type { editorMessages } from "./messages.js";
/** The first image file in a clipboard or drop payload. */
export declare const imageFileFrom: (source: DataTransferItemList | FileList | null) => File | null;
/** The non-image files of a drop payload. */
export declare const attachmentsFrom: (list: FileList | null) => File[];
export declare function useMediaInsertion({ editor, site, t, media, allowance, canEdit, }: {
    editor: Editor | null;
    site: Site;
    t: TranslatorFor<typeof editorMessages>;
    /** Whether media storage is configured. */
    media: boolean;
    allowance: EditorAllowance;
    canEdit: boolean;
}): {
    imageDialog: {
        file: File | null;
    } | null;
    /** Whether something fills in the image text after the insert, so the dialog can leave alt text empty. */
    fillsImageText: boolean;
    openImageDialog: () => void;
    closeImageDialog: () => void;
    insertImage: (image: ImageInsertion) => void;
    fileInputRef: import("react").RefObject<HTMLInputElement | null>;
    uploadAttachments: (files: File[], at?: number) => Promise<void>;
    handlePaste: (event: ClipboardEvent<HTMLElement>) => void;
    handleDrop: (event: DragEvent<HTMLElement>) => void;
};
