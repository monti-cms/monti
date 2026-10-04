/** Notice for when an image that needs a description has no alt text. Shared by the insert dialog and image settings. */
export declare const ALT_REQUIRED_MESSAGE: string;
export interface ImageInsertion {
    mediaId: string;
    alt: string;
    decorative: boolean;
    caption: string;
    /** Public URL for the preview. `null` if not yet available. */
    publicUrl: string | null;
}
interface ImageInsertDialogProps {
    open: boolean;
    /** File that came in by paste or drag and drop. If present, opens the upload tab. */
    initialFile: File | null;
    onClose: () => void;
    onInsert: (image: ImageInsertion) => void;
    /** `pick` picks a single image without inserting it into the body (media field). Does not ask for alt text or caption. */
    mode?: "insert" | "pick";
    title?: string;
}
/**
 * Image insertion. Upload a new file (original kept by default, web optimization optional) or reuse from the library.
 * The library's default alt and caption are copied on insertion. An image that needs a description must have alt.
 */
export declare function ImageInsertDialog({ open, initialFile, onClose, onInsert, mode, title, }: ImageInsertDialogProps): import("react").JSX.Element;
export {};
