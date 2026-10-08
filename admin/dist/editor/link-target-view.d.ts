/**
 * Where an internal link goes, shown in the link bubble: the title and the address of the entry, which opens the entry (its page on the site when it is
 * published, otherwise the entry in the admin). The document holds only the id of the entry, so the entry is looked up (`useLinkTarget`).
 */
export declare function LinkTargetAnchor({ entryId, className }: {
    entryId: string;
    className?: string;
}): import("react").JSX.Element;
/** A line in the link form saying where the link goes now. */
export declare function LinkTargetSummary({ entryId }: {
    entryId: string;
}): import("react").JSX.Element;
