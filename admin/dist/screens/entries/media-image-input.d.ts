import type { FieldInputProps } from "./field-inputs.js";
/** Remembers the URL of the picked image. It is not fetched again. */
export declare function rememberMediaUrl(mediaId: string, url: string | null): void;
/** Public URL of a media ID. `null` if empty, not yet known, or failed to load. */
export declare function useMediaUrl(mediaId: string): string | null;
/** Image preview. Shows an icon if the URL is unknown. */
export declare function MediaThumbnail({ mediaId, className }: {
    mediaId: string;
    className?: string;
}): import("react").JSX.Element;
/** Default input of a media field (`fields.media`). Picks a file if `accept` is `file`, otherwise an image. */
export declare function MediaInput(props: FieldInputProps): import("react").JSX.Element;
/** Picks an image from the media library and shows the picked image small. */
export declare function MediaImageInput({ field, id, value, invalid, describedBy, context, onChange }: FieldInputProps): import("react").JSX.Element;
