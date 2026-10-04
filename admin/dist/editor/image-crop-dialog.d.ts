import type React from "react";
export interface ImageCropDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    src: string;
    crop?: string | null;
    rotate?: string | number | null;
    onApply: (result: {
        crop: string | null;
        rotate: string | null;
    }) => void;
}
export declare function ImageCropDialog({ open, onOpenChange, src, crop, rotate, onApply }: ImageCropDialogProps): React.JSX.Element;
