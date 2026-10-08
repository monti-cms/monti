/**
 * Places columns side by side like the public page and edits each column in place (grid on wide screens, stacked on narrow ones).
 * The child columns sit directly inside the content's first element (see `Content`), so the grid is applied there.
 * Dragging the boundary between columns changes the width ratios, and the toolbar resets them to an equal split.
 */
export declare function ColumnsNodeView(): import("react").JSX.Element;
/** One column. The boundary shows as a dotted line only on hover or when the cursor is inside. */
export declare function ColumnNodeView(): import("react").JSX.Element;
