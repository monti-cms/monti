# Translation

This page covers how translations are shown in the editor: dimmed blocks, source-changed markers, the side-by-side view, blocks shared with the source, and the translate action.

Each language has its own text, and a new translation starts with the source laid under it, dimmed. A translation is not a copy of the source, so sections can be deleted, added or reordered.

## Dimmed block (`.mt-untranslated`)

A block that has not been decided yet. While dimmed text remains, publishing is blocked (the public screen does not draw dimmed text). Pick one of three from the block menu.

- "✦ 번역" (✦ translate): turns into a blue proposal.
- "원문 유지" (keep the source): it goes out as the source as it is. A `원문` (source) mark in the left margin (`.mt-marker--keep`).
- "지우기" (delete): leave it out in this language.

There is no button to turn all dimmed blocks into "keep the source" at once. The source could be mixed into the text of the other language as it is, so each block is looked at and decided. When publishing is blocked, "이동" (go) goes to the first dimmed block.

### In code

`Untranslated` is the dimmed look (`fg-faint`) of text that is not decided yet: the source text a new translation starts from. It reads as a placeholder, and it is not published. Typing in it, or choosing what to do with the block, takes the look away. `Marker` with `tone="keep"` is the `원문` mark.

## Source changed (`.mt-marker--source`)

A translation block remembers the ID of its source block. When the source changes, an orange mark is put in the left margin of the paired translation block.

- "바뀜" (changed): pressing it shows the source before and after in a card (`.mt-memo` + `.mt-memo-diff`). The changed letters are `.mt-diff`. The head row has "확인" (confirm) · [✦ 다시 번역] (✦ translate again).
- "새로" (new): a block newly made in the source comes in as a dimmed block.
- "지워짐" (removed): a block deleted from the source. Delete it or leave it.
- Confirming is per block. "모두 확인" (confirm all) in the notice strip above is for all at once.

### In code

`Marker` with `tone="changed"` (a block whose source changed since it was translated: "changed", "new", "removed"; `active` when its card is open; `margin` hangs it in the left margin). It is an 18px tall tag in mono 10px. `MemoCard` with `MemoDiff` is the card (`acceptSpark` gives the "✦ Translate again" accept). The notice strip is `Banner` (see Status). The to-do row of a changed block is a `TodoItem` with `marker` (see Status bar).

## Side-by-side view (`.mt-pair`)

Source view has three states, `끔 · 옆 창 · 나란히` (off · side pane · side by side; `.mt-seg--sm.mt-seg--inline`). Picking side by side gives one row per block. The left margin (`.gutter`, 104px) has the block kind and its state, the middle is the source (`.src`, tool ground, cannot be edited), and the right is the translation (`.dst`). The first row is `.mt-pair--head` with the language and the edited date, and the title row is `.mt-pair--title`.

- The state is one more line in the margin: `원문 바뀜` (source changed; `.is-changed`, orange) · `원문에 추가` (added in the source; `.is-new`, green). Text that changed on the source side has `.mt-src-changed` underline.
- The translation cell being edited is `.dst.is-on`.
- Blocks are drawn with the same body parts as the editor (`.mt-doc-callout` · `.mt-doc-code` · `.mt-doc-table`). In the source cell, the ground is one step darker.
- Comparing two versions of an entry is `.mt-compare`. Two columns with no margin, properties on top (`.props`), and changed text is `.mt-diff`.

### In code

The source view switch is `Segmented` (`size="sm"`, `inline`). The pair view and the compare view are not in `@monti-cms/ui` yet.

## Same as the source (`.mt-shared`)

A block that is not translated, such as a code block, uses the source as it is. The translation cell has only a dotted box with `원문과 같은 코드` (the same code as the source) and `English에서만 따로 고치기` (edit separately only in English). Pressing it makes a copy for this language at that moment.

Not in `@monti-cms/ui` yet.

## Running a translation

Only while dimmed blocks remain, there is a blue text button "✦ 번역" (✦ translate) at the right of the language tab row, before source view. It translates all the remaining dimmed blocks. It does not float over the text, so it does not cover the body. To translate only one block, use "✦ 번역" in the block menu.

### In code

No dedicated component. The language tab row is `Tabs`, and the source view switch is `Segmented`.
