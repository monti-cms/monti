/**
 * Sizes the screens share, so no two pages pick their own. They are class names written out in full (Tailwind reads them from the source).
 */

/** The list column of a list-and-editor page (templates, the AI tabs). */
export const LIST_PANE_WIDTH = "w-72";

/** The widest a form-like page body gets; a workspace page (lists, trees, side panels) uses all the width. */
export const PAGE_MAX_WIDTH = "max-w-[1160px]";

/** The widest the field tree of the schema screen gets. */
export const TREE_MAX_WIDTH = "max-w-[1000px]";

/** The frame of the editor pane of a list-and-editor page: a centered column that reads well. */
export const DETAIL_PANE_FRAME = "mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 text-sm";
