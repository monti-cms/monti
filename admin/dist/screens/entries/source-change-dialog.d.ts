/** List of blocks that differ between the source the translator last confirmed and the current source. */
export declare function SourceChangeDialog({ open, onOpenChange, before, after, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    before: string;
    after: string;
}): import("react").JSX.Element;
