import { type StoredDocument } from "@monti-cms/core/client";
/** List of blocks that differ between the source the translator last confirmed and the current source. */
export declare function SourceChangeDialog({ open, onOpenChange, before, after, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The stored documents of both versions. Blocks are compared by block id, and moves are shown. */
    before: StoredDocument | undefined;
    after: StoredDocument;
}): import("react").JSX.Element;
