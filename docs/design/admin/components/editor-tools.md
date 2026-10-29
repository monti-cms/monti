# Editor tools

This page covers the tools inside the editor: the block handle and block menu, the format bar on selected text, the block tool row, the file block and the body blocks.

There is no always-visible toolbar. The block handle, the format card that appears when text is selected, and the "/" insert menu (see Menu) do everything. Nothing else sits on the body: the document tools are a group of the header's ⋯ menu ("EditorNotion" board, `moreMenu`). The group holds what a plugin adds (a source panel's switch such as "MDX로 보기", a text checker, "모두 번역"), the source beside a translation ("원문 옆에 보기"), "본문 폭 ▸" with the chosen width as its value and the steps with a ✓ in its second level, and the theme. Copy, archive and export sit above it; "휴지통으로" stays at the bottom. The core only opens the place; it shows a plugin's row only when that plugin is installed (`EditorMenuItem`, `menuItems` of an edit screen extension). The template editor's ⋯ has the same group above 복제 · 지우기.

The writing column is `width-reading` (680px) by default ("본문 폭" changes it). The language tabs, the title and the body start on the same left edge. Under the header: 16, the language tabs, 16, the title, 20, the one ink rule, 32, the body. In the body (`text-reading`, 17 / 30) a paragraph has 20 below it, a heading 32 above and 12 below, and list items follow line under line.

An empty line the cursor is on, and the one empty line of a new post, says "/ 를 눌러 블록 넣기" (`fg-faint`, in the body's own type). Only a top-level paragraph shows it.

## Block handle

The + and the handle at the left of an editor block. Pressing + makes an empty block right under this block and opens the same block-picking list as typing "/". Pressing the handle opens the block menu (see Menu), and dragging moves the block. A block whose menu is open has the `bg-block` ground.

The block menu: block kind name | "다른 블록으로 바꾸기" (change to another block) › · "정렬" (align) › | "위로" (up) · "아래로" (down) · "복제" (duplicate) · "삭제" (delete).

- "Change to another block" is a second level: paragraph · heading 2 to 4 · list · numbered list · check list · quote · code block, with the markdown shortcut at the right. The current kind has a ✓. It is only on a block that has one of these kinds (not on a table, an image or a component), and a kind the body's allowed list does not allow is not listed. Turning a list item into another kind takes only that item out of its list.
- "Align" is a second level (left · center · right, with a ✓ on the current one; no alignment set reads as left, and choosing left clears the setting). It exists only on paragraphs and headings, and shows only when the site has turned alignment on.
- "Up" is not on the first block of its parent and "down" is not on the last: what cannot be done is hidden. Actions an extension adds (translate this block) are rows after "align".
- The + puts an empty line under the block with a "/" typed in it and the cursor after it, so the list that opens is the one typing "/" opens. Choosing a block takes the "/" away.
- The things that are inserted (list · table · quote · code · file · divider) are in the "/" menu, and table editing is in the tool row inside the table. So nothing is missing for lack of an always-visible toolbar.

### In code

`BlockHandleOverlay` (admin editor) places the handle beside the pointed block and builds the menu from `block-kinds.ts` (the kinds, the kind of a block, align, turn into) and `block-commands.ts` (move, duplicate, delete, add below). `BlockHandle` holds the two marks in the left margin: a + that adds an empty block below and opens the block picker, and the grip. Pressing the grip opens the block menu, and dragging it moves the block, so the grip takes the drag events (`onDragStart`, `onDragEnd`, `draggable`). `active` keeps the grip pressed while the menu is open. To make the grip the menu trigger, wrap it with `trigger`: `trigger={(grip) => <DropdownMenuTrigger render={grip} />}`. `Block` is a block of the editor's text; while its menu is open (`active`) it has the block background. It sets no type: the text inside is the editor's. The block menu itself is a `DropdownMenu`, and the "/" menu is a `Command`. `HeadingIcon` and `headingIcons` are the heading glyphs by level (2, 3, 4) for the "change to" rows.

## Format card

A one-line format bar that floats above the selected text (`.mt-format-bar`). A toolbar that is always visible is not used.

- From the left: bold · italic · underline · strikethrough · code | superscript · subscript · link · footnote · ⋯ (formats a site added) | "✦ 요청" (✦ request).
- The ⋯ opens a menu with one row per format a site added (text color, tooltip, a link to a code line), each with its icon, and a ✓ on one the selection has. A row that cannot work on the selection is left out, and with no row left there is no ⋯. An editor extension adds its rows with `formatItems` (see the admin README, "Text marks").
- Buttons are 28px with 2px between. A vertical rule (`.sep`) between groups. A format that is on is `bg-selected` + ink.
- "✦ 요청" is a text button at the end of the bar. ✦ is the blue pencil. Like every button, it shows no shortcut.
- The bar does not change from one line. When the screen is narrow, the whole bar slides sideways above the selected text and stays inside the screen.

### In code

`FormatBar` is the bar that floats above selected text: the inline formats as letters (`FormatButton`, drawn as the letter it gives: B, I, U …; `pressed` marks one the selected text already has; `more` is the ⋯ that opens the formats a site added, with a `trigger`), a `FormatBarSeparator` between groups, and at the end `FormatBarRequest` (a blue ✦, the word that asks the assistant about the selected text, and its key combination). `FormatBarButton` is a 28px button of the bar, with its name in a tooltip (with the key combination when it has one), `pressed`, and `danger` for a button that removes something. It does not take the selection or the focus from the text on press. `FormatMark` is the type of the marks.

## Block tool row (`.mt-block-bar`)

A small tool row that appears at the top left of a block with settings, such as an image, when it is selected. 28px icon buttons, a vertical rule between groups. The pressed state is `bg-selected`.

- Image: align left · center · right | settings · crop and rotate. Delete is in the block handle's menu.
- Settings card: width (fit to the body) · alt text (✦ fill) · decorative image. If the alt text is empty, one red line under the field.
- The caption is edited on the spot, centered right under the image. A ✦ is beside it.
- Width can also be changed by dragging the two corner handles at the bottom (`.mt-resize`).
- An image that is pasted or dragged in goes into the cursor position at once with no window, and a progress bar shows inside the block.
- Next image: while the alt text card is open and another image still has no alt text, the card ends with "다음 이미지 ↵" (next image). Pressing it, or Enter in the alt text, selects that image and opens its card with the cursor in the alt text. With no other image to go to, the button is not shown and Enter closes the card. The count ("23 / 80") shows in the label row while there is text.
- Crop and rotate is making with several inputs, so it opens as a sheet.

### In code

`BlockBar` is the small floating row of tools above a block that has settings; put `BlockBarButton`s in it and a `BlockBarSeparator` between groups. It is a floating card and the editor places it at the block's top left. `BlockBarButton` is a 28px icon button: `label` is its name and its tooltip, `shortcut` its key combination, `pressed` keeps the background while the tool is on, and `trigger` wraps it to make it the trigger of a card or menu. `ResizeCorner` is the square handle on a bottom corner of a selected block; dragging it changes the block's width (the parent is `relative`). `UploadingImage` is the image block while it goes up: the file's own picture, faded, 240px high, with the 3px bar along its bottom edge. `CropStage` is the picture of the crop sheet in its frame: the tool ground with an edge and 4px inside, at most 380px high, the picture at most 360px; the mask and the crop box lay over it in % of the picture. `Image` draws a picture in a frame of a fixed shape (`cover` crops, `contain` shows all of it; a file-type icon as `fallback`).

The format bar and the block bar share one floating-row look: 3px inside, 2px between buttons, an emphasis border and the floating shadow.

## File block (`.mt-file-block`)

How a file chosen with "/ 파일" (/ file) looks in the body. A one-line box with the file icon (16px), the name, and the kind and size (mono 12, "PDF · 1.2 MB"). The panel for choosing is the same library as image insert, and it shows only files.

### In code

`FileBlock` draws it: the file icon, the name and, in mono at the end, the kind and size. With `onNameChange` the name is a field that reads as text, so the shown name can be changed in place (`name` is then its value and `placeholder` the file's own name); `tone="danger"` is for a file that cannot be found. `MediaPicker` is the panel for choosing (see List).

## Body blocks (`.mt-doc-callout`, `.mt-doc-code`, `.mt-doc-table`)

Blocks that sit with the text inside the editor. A callout is a gray box with a bold first line; code is the same box in fixed-width 12px; a table has a dark rule under the head row and a pale rule for each row. A number column is `td.num` (fixed-width). Side-by-side view and the entry compare use the same parts.

Not in `@monti-cms/ui` as editor blocks yet. `CodeBlock` is a different part: text shown as it is (fixed-width, line breaks kept) in the inner box (`bg-muted`, `radius-lg`, no border), for a JSON value, an error's details or a model's answer.
