# Proposal

This page covers how an AI proposal is shown and handled on the spot: the blue pencil, the bubble, request marks and cards, the fill-a-field button, and the blue "made by AI" state of controls.

All of it is the blue pencil (`fg-proposal`), and this color is not used for anything else.

## Blue pencil

The blue pencil marks every proposal from the AI that has not been accepted yet. The color (`fg-proposal`) is used for nothing else.

- Text that is taken out: a blue strikethrough. Text that comes in: a pale blue ground (`bg-proposal-muted`).
- A proposal that fills an empty place (moving dimmed source text) is blue text with no ground.
- The proposal being looked at has a blue vertical line in the left margin. A proposal that is in another tab has a blue dot beside the tab name.
- The look is the same everywhere: the editor, settings, the review screen and the assistant card.

### In code

`Ins` (text that comes in: pale blue ground, blue letters), `Del` (text taken out: blue with a line through it), `Fill` (an empty place filled with a suggestion: blue letters, no ground), `CurrentProposal` (the blue line in the left margin of the text the proposal is about) and `ChangeDot tone="proposal"` (the dot beside a tab name on other tabs). `Highlight` is a run of text on the highlight background: the words a note to the assistant is about, or the words that differ between two versions. It sets no color, so the text keeps its own.

## Bubble

A bubble to move between proposals that hang on places, and accept or discard them. It floats in the center, directly above the status bar.

- Left: ✦ and the name of the request (so the source is known even with the panel closed). Pressing it goes to that conversation.
- Center: ↑ n / N ↓.
- Right: "모두 버리기" (discard all) and a small pill, "모두 받기" (accept all).
- Height 44. Discarding, accepting or asking about one by one is not in the bubble: it is done in the card that opens when the mark is pressed. The shortcuts (⌘⌫ discard, ⌘↵ accept) work on the proposal now pointed at, and the letters show only as tooltips.

### In code

`ProposalBubble`: `name` (the request's words, cut with … when long), `onOpen`, `position` (the one being looked at, from 1) and `total`, previous / next labels and handlers, and discard-all / accept-all labels and handlers. It holds nothing for a single proposal: accepting, discarding or asking again about one is in the card that opens from its mark.

## Request mark and card

An AI request left at a place in the text. A small mark (with a count) sits in the block's left margin, and pressing it opens a card under that place. Several can be left without waiting for them.

- A request attached to plain body text gets the `bg-highlight` ground on those words.
- While it is being fixed, the mark shows "…" instead of a count.

The card (`.mt-memo`) has three parts.

- **Head** (`.mt-memo-head`, 48px): at the left where the request is attached (12px gray), at the right "버리기" (discard) and [받기] (accept). Accept is the one black pill in a floating surface. There is no close button. It closes with a press outside, Esc, or pressing the mark again.
- **Conversation** (`.mt-memo-thread`): the name line is 12px, with the name only in bold (the assistant is ✦ and blue), and the time dimmed. The body is 14px. 16px between messages.
- **Reply row** (`.mt-memo-reply`, 48px): one line under a rule. When empty, the send button is dimmed.
- Buttons are not put in the middle of the conversation. However long it gets, accept and discard are always in the head.

### In code

`Marker` with `tone="request"` (a note left for the assistant, with a count; `margin` hangs it in the left margin, 12px from the block; `active` when its card is open). `MemoCard`: three parts. The head (48px) says where the note is (`where`, "Request · paragraph 4") and holds the two ways to deal with it, always in this order: a quiet text to discard, then one black pill to accept (a spark before the accept label when accepting asks the assistant to do something, "✦ Translate again"). The key combinations show as tooltips on the head's buttons. The body is a `MemoThread` of `MemoMessage`s (16px apart; the assistant's name, `ai`, is blue with a spark; while it works there is an indicator) or a `MemoDiff`. `reply` adds the row at the bottom where the note goes on ("Continue").

## Fill a field

A text button that fills one property field with AI (`mt-ai-action`). It has the same letters as the field label (mono 11) and differs only in blue; it has no border or ground. It floats at the right end of the label row, on the one field the hand is on.

- An empty field: "✦ 채우기" (✦ fill). After filling, or a field that has a value: "↻ 다시" (↻ again).
- While working: a turning ring (10px) in place of ✦ / ↻ and "쓰는 중…" (writing…). It stays blue and is not dimmed. It cannot be pressed again. When the answer comes the value goes in and the button becomes "↻ 다시".
- It is a job the person pointed at one field, so the value goes in at once without the blue pencil proposal. If it is not liked, "↻ 다시" gets a new one, and to undo use ⌘Z.
- The blue pencil (accept / discard) is used only when the agent changes several places or the body text.
- Keyboard: ⌘J inside the field. Nothing is made before it is pressed.

### In code

`AiAction`: `loading` shows the spinner and "writing" label, and the action cannot be pressed again and is not dimmed (only `disabled` dims); it is `aria-busy`. `filled` (the field has a value) makes it ask again instead of filling. It goes in `FormFieldLabel action`, and inside a `FormField` it shows only on the field the pointer or keyboard is in.

## State made by AI

A state that the AI made and the person has not touched yet is shown in blue (`fg-proposal`, with the ground `bg-proposal-muted`). When the person touches that element, accepts it or saves, it returns to the normal color. Blue is for AI only.

- Filter chip: `.mt-chip.is-ai` + ✦ in front. It ends when the chip is changed or removed.
- Picked rows: `.mt-row.is-on.is-ai` + `.mt-check.is-on.is-ai`, and the checkbox name is "AI가 고름" (picked by AI). If any one check is touched, all return to normal picking.
- Field value: input and select fields are `.is-ai` (blue text + blue underline), and value text in a panel is `.mt-fill`. It ends when the field is edited or the entry saved. In the properties list a value is `PropertyRow proposal` (blue text, described as the assistant's), and the open field gets the same `proposal`. The entry editor keeps the keys the assistant filled (`useField().assisted`): editing a key, or saving the entry, takes the mark off.
- Switch: `.mt-switch.is-on.is-ai`.
- It is not told by color alone. The chip has ✦, and the checkbox and field get an accessible name.
- Work with nothing to paint, such as going to another screen, is left as one line in the panel.

### In code

The `proposal` prop on `Chip`, `Checkbox`, `Switch`, `Input`, `Textarea`, `Select`, `Affix`, `MapRow` (through its `Select`) and `Tile`. A control with `proposal` gets the accessible description of `UiLabels.proposal` ("AI suggestion"), through `useProposalDescription`; a chip, which is only text, uses `ProposalNote`.
