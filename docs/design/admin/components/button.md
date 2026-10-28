# Button

This page covers everything in the admin that is pressed: pills, text buttons, icon buttons and the split pill.

The order of weight is black pill, then gray pill, then text button, then the ⋯ menu. A screen or a floating surface has one black pill.

## Pill

A pill-shaped button. It has no border and no shadow. Its text is 600 and its height is `height-control-md` (36px).

- **primary**: the one main action of the screen ("새 글 쓰기" (new post), "저장하고 적용" (save and apply), "모두 받기" (accept all)). `bg-emphasis` with `fg-on-emphasis`. Only one per screen or floating surface.
- **secondary**: one or two common side actions ("검색" (search), "미리보기" (preview)). `bg-muted`.
- **danger**: the confirmation of something that cannot be undone ("휴지통으로" (to trash), "지우기" (delete)). Use it only inside a confirmation dialog.
- **sm**: pills inside cards and panels ("적용" (apply), "저장" (save)). Height `height-control-sm` (28px), 13px text, 12px side padding.
- Centering the text is the font's job. Padding above and below is equal; do not lift the text with extra bottom padding.
- **Disabled**: opacity .45. The reason it is disabled is told by the text beside it or by what is left to do, not by the button.
- **Loading** (`.is-loading`): a turning ring (`.mt-spinner`, 14px, 12px in `sm`) comes first, and the label says what is being done ("저장 중…" (saving), "올리는 중 64%" (uploading 64%)).
  - A leading icon is replaced by the ring.
  - The fill stays as it is; the button is not dimmed. It cannot be pressed again, as with disabled. It is not dimmed because it is "doing something", not "unable to do something".
  - The spacing was set by eye. For a black pill: 13px from the left edge, 15px on the right, 7px between ring and text. The left is 2px wider than the ring's top and bottom margin, and the right is 3px narrower than a normal pill. In `sm` the padding is 10px on the left and 9px on the right.

### Leading icon

An icon (✦, the magnifier) is pointed or round, so with equal padding it looks emptier than the text side. A button's first icon therefore pulls 2px into the left padding (`.mt-btn > svg:first-child`). Measured, the ink margins left and right are close, and it looks centered.

### In code

`Button` in `@monti-cms/ui`: `variant` is `primary`, `secondary`, `danger` or `outline-danger`; `size` is `md` or `sm`; `loading` shows the ring.

`outline-danger` is not in the DS README. It is a quieter `danger` with a 1px line. The side padding of the filled pills is 18px, 16px for `secondary` and 12px for `sm`.

## Text button

A button that is only text. Adding, editing and side actions inside a section are all text buttons.

- **Default**: `fg-muted`, no border ("취소" (cancel), "모두 되돌리기" (undo all)).
- **underline**: presses go somewhere or open something ("검토" (review), "AI로 채우기" (fill with AI), "목록에서 보기 →" (see in the list)). The underline is `border-strong`.
- **quiet**: less important things ("+ 언어" (+ language), "+ 묶음 추가" (+ add a group)). `fg-subtle`.
- **danger**: the risky second choice of a confirmation dialog, such as "저장하지 않고 나가기" (leave without saving).
- **Loading** (`.mt-text-btn.is-loading`): the same rule as the pill.
  - The button keeps its place, its color and its underline.
  - The label says what is being done ("보내는 중…" (sending)), with a ring in front of it at the height of the text's ink (`.mt-spinner`, 0.85em: 11px beside 13px text).
  - A button at the right edge only grows to the left, so its right end does not move.
  - It cannot be pressed again. Used by the activity log's "다시 보내기" (send again) and "모두 다시 보내기" (send all again).

### In code

`TextButton`: `variant` is `plain` (the default), `underline`, `quiet` or `danger`; `mono` sets fixed-width letters for an address or identifier. With an `href` it renders a link, and the app's router link goes in `render`. An icon goes before the text (14px, 6px gap); a `Caret` after it keeps its own 12px. The DS draws no hover; the text turns ink, and so does the rule.

The DS README names this part `TextLink`. No such export exists; `TextButton` is the part.

## Icon button

A round icon button, 32px (`height-icon-button`). The ⋯, properties and ✦ assistant buttons in a header, and the close button of a panel.

- The on state (the properties panel is open) is `bg-selected`.
- On a screen with no header, the ✦ assistant button floats at the top right corner (`mt-icon-btn--corner`).
- ⋯ holds everything else. In a list row it shows only when the pointer is over the row.
- Always give it a name (`aria-label`). The name of a ⋯ is the menu's items.

### Red icon button (`.mt-icon-btn--danger`)

Used only for deleting and removing (delete a rule, delete a row or cell of a table, delete a block). The icon is `fg-danger`, and on hover the background is `bg-danger-muted`. The name shows as a tooltip. A delete that cannot be undone is not finished by the button alone: it goes through a confirmation.

### In code

`IconButton`: `label` is both the accessible name and the hover tooltip; `pressed` makes it a toggle that keeps a background while on; `tone="danger"` is the red version. To open a menu or popover, pass `trigger`, for example `trigger={(button) => <PopoverTrigger render={button} />}`.

## Split pill

One pill that holds the main action and its variants. Today there is one: "발행하기 ▾" (publish) in the editor.

- The ▾ holds only other ways of the same action, such as "오늘 날짜로 다시 발행" (republish with today's date).
- A first publish (a draft) has no ▾; it is a plain primary button.
- While publishing, the left half gets a turning ring ("발행 중" (publishing)) and neither half can be pressed.

### In code

`SplitButton`: `label`, `menu` (the items, as `DropdownMenuItem`s), `menuLabel` (names the caret half for screen readers and its tooltip), `loading` and `disabled` (both apply to both halves). The menu hangs under the whole pill. A loading pill keeps its fill.

## Spinner

The working mark. A 14px ring in the ink color of the text beside it, a quarter open, one turn per second (one per three seconds when the system asks for less motion). It is decorative: the words beside it say what is happening. `Button`, `SplitButton` and `AiAction` show it themselves while `loading`; use `Spinner` directly only next to a status line.
