import type { Editor } from "@tiptap/core";
/** Custom component list. Shared by the component menu and the toolbar "More" menu. Like the slash menu, it shows a description under each name. */
export declare function CustomBlockMenuItems({ editor }: {
    editor: Editor;
}): import("react").JSX.Element[];
/** Inserts a custom component (block) at the cursor from the toolbar. */
export declare function CustomBlockMenu({ editor }: {
    editor: Editor;
}): import("react").JSX.Element;
