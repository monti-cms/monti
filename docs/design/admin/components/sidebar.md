# Sidebar

This page covers the left navigation: the rows, the header, folding to a rail, and the screen-mode switch.

## Sidebar

The left navigation, on the cream tool ground. The upper group is content; the lower group is trash, tools and settings.

- A row under the pointer (`.mt-nav:hover`; `.is-hover` in the drawings) is `bg-selected`. Because the ground is cream, this is one step darker than the row hover in paper lists (`bg-muted`).
- The current place (`.mt-nav.is-on`) is one more step darker, `bg-current`, at weight 600, so it is not confused with a row under the pointer. A collection with folders shows a tree under it when it is open; inside a folder the collection row stays current and the open folder is bold in the tree.
- Tree rows (`.mt-nav-sub a`) are rounded rows too, and `bg-selected` on hover. The 36px indent is padding inside the row, so the background is painted at the same width as the row above and only the text moves in.
- Numbers are mono, at the right end.
- A row is 36px high with 10px side padding and a `radius-md` shape.

### In code

`Sidebar` is a `nav` on the tool ground with a line down its right edge, a header with the site's name, the rows of the groups, and a footer. The writer drags its edge to change the width (200px to 400px, 232px until dragged; `width-sidebar`). On a narrow screen it is a drawer that opens from the left over a dimmed page, square and with a line on its open edge, like the sheet. `label` names it for screen readers.

Parts: `SidebarProvider`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuBadge`, `SidebarFooter`, `SidebarFoot`, `SidebarInset`, `SidebarTrigger`, `SidebarRailToggle`, `SidebarScreenMode`, and `useSidebar`. The rail has the tool ground, 20px above, 14px at the sides (6px folded, so the 36px rows fill the 48px rail), 16px below, and rows 2px apart.

## Header row

The site name (`text-title`) and the fold button (`.mt-sidebar-head`). A long name is cut with an ellipsis. There is no link to the site.

## Folding

Pressing the fold button or ⌘B makes a narrow sidebar with only icons (`.mt-sidebar.is-rail`, `--width-rail`, 48px). The side padding is 6px, so the 36px rows fill it. Icons are in the same place as when expanded, so they do not move. The folded state is remembered in this browser.

- Names and numbers are hidden. On hover the tooltip shows the name and the number ("도구 1" (tools 1)).
- If a tool has a failure, a dot (`.mt-change-dot`) is attached at the top right of its icon. The trash number is not turned into a dot.
- The folder tree is not shown while folded.
- The header row keeps only the expand button.
- On a narrow screen (below tablet) it opens as a drawer instead of folding.

### In code

`SidebarProvider` takes `rail` (folded to the icon rail; desktop only, never while it is a drawer) and `onRailChange`, to keep the state outside; the admin remembers it in the browser. `resizeKey` names the remembered width, and `fixed` makes the frame take exactly the window, with the panes inside scrolling on their own.

## Screen mode

The bottom row (`.mt-sidebar-foot`) is a three-icon toggle (`.mt-seg`: system, light, dark, drawn as a screen, a sun and a moon). It fills the sidebar width and the three cells share it equally. The cell for the current mode is pressed (`bg-current`); the other cells are `bg-selected` on hover. One press changes it. It follows the system at first.

The folded sidebar has no room for three cells, so one icon button shows the current mode. Pressing it opens a small menu upward, with a ✓ on the current mode.

### In code

`SidebarScreenMode` takes `value`, `onValueChange` and `labels`. It uses the tool ground variant of `Segmented`, where the selected ground is the hover and the pressed cell takes the current ground.
