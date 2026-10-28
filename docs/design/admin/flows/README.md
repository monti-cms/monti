# Admin flows

This folder describes the user flows drawn on the Monti admin canvas, one file per flow page, so a step can be found without opening the canvas.

## Flows

- [Flow 1: Write and publish](01-write-and-publish.md) ("흐름 1 · 글 쓰고 발행하기"): Writing a post from the first slash to publishing and editing after publishing, with two exceptions: an edit conflict and recovering a browser draft. 3 rows, 19 steps.
- [Flow 2: Assistant](02-assistant.md) ("흐름 2 · 어시스턴트"): Asking the assistant, editing the current post, editing many posts, undoing, default requests, writing rules, settings changes, first connection and finding old chats. 10 rows, 29 steps.
- [Flow 3: Translation](03-translation.md) ("흐름 3 · 번역"): Creating and publishing a translation, handling a changed source, the language column in the list, translating many posts, and exceptions. 4 rows, 15 steps.
- [Flow 4: Collections](04-collections.md) ("흐름 4 · 컬렉션"): Creating a collection, editing its fields, changing its public address and deleting it, on a dev server. 4 rows, 19 steps.
- [Flow 5: Trash](05-trash.md) ("흐름 5 · 휴지통"): Folders in the post list, discarding, browsing the trash, restoring, permanent delete, handling many items and emptying the trash. 7 rows, 28 steps.
- [Flow 6: Media](06-media.md) ("흐름 6 · 미디어"): Uploading, inserting from the editor, browsing, replacing a file, alt text, deleting, files that are not images, picking, and exceptions. 12 rows, 38 steps.
- [Flow 7: List tidy-up](07-list-tidy-up.md) ("흐름 7 · 목록 정리"): Sorting by the column name menu, filtering, columns, per page, search scope, changing many posts and merging tags. 7 rows, 19 steps.
- [Flow 8: First install](08-first-install.md) ("흐름 8 · 처음 설치"): The first admin and the sign-in exceptions. 3 rows, 10 steps.
- [Flow 9: Data](09-data.md) ("흐름 9 · 데이터"): Downloading a backup and importing (read the file, then either new posts or a restore). 3 rows, 15 steps.
- [Flow 10: API keys](10-api-keys.md) ("흐름 10 · API 키"): Adding, checking, editing and deleting keys, plugin keys, the quick-task model, and exceptions. 6 rows, 20 steps.
- [Flow 11: Settings](11-settings.md) ("흐름 11 · 설정"): Dev server (no plugin, writes the file directly), production with the GitHub plugin (PR), production without a plugin (locks), and exceptions. 5 rows, 26 steps.
- [Flow 12: Activity log](12-activity-log.md) ("흐름 12 · 활동 기록"): The failed-delivery notice, resend, cancel, resend all, details, filters and the empty screen. 6 rows, 15 steps.

## How steps are numbered and named

- A flow page on the canvas is a stack of labeled rows. Each row holds the steps of one part of the flow, left to right. Rows are ordered top to bottom.
- Each step is one board named `Flow<flow>Step<step>.dc.html`, for example `Flow5Step22.dc.html` is flow 5, step 22. Its canvas title is `<step> · <what happens>`; these docs quote the part after the number.
- Steps are numbered in the order they were drawn, not always in reading order. Steps in an exception row (for example flow 2 steps 05, 06 and 24) are numbered into the main sequence but sit in their own row at the bottom. Follow the row order in each file, not the numbers.
- A letter after the number (`05b`, `23c`) is a variant of the numbered step or its next moment: a menu closing, an error line, a second option, a result. `07b` follows `07`; `23b` to `23d` follow `23`.
- A step board usually imports one main board from `../screens.md` in one state (the "Renders" line), sometimes with the assistant panel beside it. The state names are the Korean strings the board uses.
- Where a flow note says "flow 11 · 12" or "01 · 04", it points at steps of the same or another flow.

## Tests

Each canvas flow is meant to have one test that follows its steps. No step is linked to a test yet; when a test exists, add "Test: path" under its step.
