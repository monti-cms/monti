/**
 * Shows as many tags as fit the cell width and shortens the rest to `+N`. Remeasures when the column width changes.
 * Draws all tags and the longest `+N` in an invisible measuring row and measures the width. If none fit, the first tag is truncated with an ellipsis.
 */
export declare function FittingTags({ tags }: {
    tags: readonly {
        id: string;
        title: string;
    }[];
}): import("react").JSX.Element;
