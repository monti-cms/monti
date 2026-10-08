/**
 * Shows only the tab bar and the selected tab's body, like the public page. The body is edited in place.
 * Clicking a tab moves the cursor to that tab's body, and entering another tab's body with the arrow keys opens that tab.
 * Tab names, the initially open tab, adding, and deleting are done from the block toolbar.
 */
export declare function TabsNodeView(): import("react").JSX.Element;
/** One tab. The parent (tab bar and body box) handles the look, and this view only provides the body slot. */
export declare function TabNodeView(): import("react").JSX.Element;
