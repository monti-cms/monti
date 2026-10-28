# Assistant

This page covers what is inside the assistant panel: the conversation, tool call lines, proposal cards, the input box, the model picker and error replies.

The panel itself is a side panel (see Overlay).

## Conversation

My words are a speech bubble at the right (paper). The assistant's answer has no ground and is plain text. A tool call is one mono line ("✓ 글 목록 읽음 · 게시글 6편" (✓ read the post list · 6 posts)); pressing it opens the input and the result.

### In code

`ChatMessage`: `user` is a paper bubble at the right, and `assistant` is plain text with no ground; `streaming` shows a thin blinking caret after the last word while the answer is still arriving. Put them in a column. `ToolCallLine`: one call as a mono line with a mark for where it stands (running, ✓ done, ⚠ failed) and what was done, in words. With `details` the line opens to show the input and the result; without, it is a plain line. `statusLabel` is the status in words for screen readers; it is not drawn. `Suggest` is one row of the assistant's empty panel: a request to start from (`request` is a saved one with a spark, `recent` one asked before with a clock); pressing it sends the words or puts them in the box. `Suggest` has no rule in the DS README.

## Proposal card

A proposal card in the chat. It tells what is changed in how many places; each item has a blue pencil; below are "검토" (review) · "버리기" (discard) · [적용] (apply). After applying: "✓ 2편에 적용 · 10:52 · 되돌리기" (✓ applied to 2 posts · 10:52 · undo).

### In code

`ProposalCard`: the head says what will change and how much ("Proposal · Fill summary · 2 posts") and that it waits for review; under it one `ProposalItem` per place (its name in bold, and under it the text with `Ins` and `Del` marks); at the bottom review (goes to the places), discard and a black Apply. Once applied (`appliedLabel`, `undoLabel`) the bottom line says so with the time and a way back. The README writes this part as `Proposal card`.

## Input box

The assistant input box. At the lower left is the model picker (remembered per conversation); at the right is a round send button. While the answer is being written the send button becomes stop.

### In code

`ChatInput`: a rounded box with a text area, and under it a row with `aside` at the start (the model picker) and a round send button at the end that becomes a stop button while the answer is being written (`busy`). Enter sends and Shift+Enter breaks the line (not while an input method is composing). Nothing is sent while the text is blank or the box is `disabled`. The words are the app's.

## Model picker

At the lower left of the input box, `모델 · 생각 정도 ▾` (model · thinking level). Pressing opens a menu upward (`.mt-card` + the menu parts).

- A search row at the top (`.mt-menu-search`). A key like OpenRouter has hundreds of models, so finding comes first.
- The list is grouped by key, not by company. At the top is a "최근" (recent) group with the recently used models, and the count beside each group name. The list scrolls inside (`.mt-menu-scroll`).
- A model name is mono 12 (`.mt-menu-item.is-mono`). The default model is marked "기본" (default). A model that cannot use tools is not in the list.
- The last row is "생각 › 보통" (thinking › normal). In the second level pick one of "끔" (off) · "낮음" (low) · "보통" (normal) · "높음" (high). If the model does not support thinking, this row is left out.
- The chosen model and thinking level are remembered per conversation.

There is no dedicated model-picker component in `@monti-cms/ui`: it is built from the `aside` slot of `ChatInput` and the menu parts (see Menu).

## When blocked

Sending is not blocked. If something cannot be done after sending, it is told by an error reply in the conversation (`.mt-msg-error`): one red line at the left, one bold red title line, one gray line of explanation, and under it what can be done.

- The service refused (out of credit): "Anthropic 크레딧이 부족해요" (Anthropic credit is low) · the key name · one line telling to top up at the service's site · [다른 모델로 보내기] (send with another model). Picking another model sends that message again as it is. Monti does not count money (only the service knows the price), so it shows no amount or limit.
- The connection dropped: "연결이 끊겼어요" (the connection was lost) · how far it got · [이어서 하기] (continue).

### In code

`ChatError`: a red line on the left, the problem in one bold red line, one grey line that says what happened (which key, when it opens again), and what can be done next (`actions`, one or two text buttons). Sending is never blocked beforehand; this is what comes back after.
