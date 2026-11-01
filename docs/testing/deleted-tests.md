# 지운 테스트와 그 이유

상태: 기록 (2026-11-01). 테스트 정리(#379, #381, #383, #385, #388)에서 지운 테스트를 하나씩 적는다.

판정의 뜻과 지우기 전에 하는 확인은 [약속 없는 테스트 나누기](triage.md)에 있다. 짧게:

- **작음**: 망가져도 사용자가 알아채지 못하거나, 다른 층이 이미 막는다. 소유자가 ⚪로 정한 기능의 테스트도 여기 든다.
- **겹침**: 이 테스트가 잡는 결함을 다른 테스트가 모두 잡는다. "이유"에 그 다른 테스트를 적었다.
- **세부**: 무엇이 아니라 어떻게를 본다. 같은 결함을 동작으로 잡는 테스트가 있다.
- **(질문 → 제안대로)**: 판정할 때 소유자에게 물은 것이다. 소유자가 제안대로 정했다.

겹침과 세부는 모두 변이 테스트로 쟀다. 그 테스트만 잡는 바꿈이 하나라도 있으면 남겼다.

## 어떻게 뽑았나

PR마다 바뀐 테스트 파일을 합치기 전과 뒤로 읽어, 뒤에 없는 제목을 뽑았다. 앞에 붙은 ID와 번호는 빼고 비교했다.
그렇게 뽑은 646개 가운데 42개는 지운 것이 아니라 제목을 고치거나 다른 층으로 옮긴 것(붙임, 새 줄, 아래로)이라 이 문서에서 뺐다.
이유는 판정할 때 쓴 판정표에서 가져왔다.

## 합

| PR | 작음 | 겹침 | 세부 | 합 |
|---|---|---|---|---|
| [#379](https://github.com/monti-cms/monti/pull/379) admin 판정 | 157 | 4 | 0 | 161 |
| [#381](https://github.com/monti-cms/monti/pull/381) admin 겹침과 세부 | 1 | 75 | 25 | 101 |
| [#385](https://github.com/monti-cms/monti/pull/385) ui 판정 | 4 | 0 | 0 | 4 |
| [#388](https://github.com/monti-cms/monti/pull/388) core 판정 | 180 | 131 | 27 | 338 |
| [#383](https://github.com/monti-cms/monti/pull/383) ai 정리 | | | | 230 |

ai(#383)는 테스트마다 판정하지 않았다. 패키지를 에이전트 중심으로 다시 쓰는 중이라(#312), 지금 고치면 코드와 함께 버릴 일이었다.
API 키 저장(🔴 KEY-A1~A3)의 7개만 남기고 나머지를 지웠다. 다시 쓴 코드의 테스트는 #312의 끝나는 조건에 있다.

| 파일 | 지운 테스트 |
|---|---|
| `ai/src/__test__/action.test.ts` | 11 |
| `ai/src/__test__/agent-model.test.ts` | 6 |
| `ai/src/__test__/agent-route.test.ts` | 14 |
| `ai/src/__test__/agent-store.test.ts` | 5 |
| `ai/src/__test__/agent-tools.test.ts` | 7 |
| `ai/src/__test__/any-site.test.ts` | 3 |
| `ai/src/__test__/checks.test.ts` | 4 |
| `ai/src/__test__/contract.test.ts` | 3 |
| `ai/src/__test__/custom.test.ts` | 5 |
| `ai/src/__test__/fake-provider.test.ts` | 3 |
| `ai/src/__test__/messages.test.ts` | 1 |
| `ai/src/__test__/plugin.test.ts` | 3 |
| `ai/src/__test__/presets.test.ts` | 16 |
| `ai/src/__test__/registry.test.ts` | 5 |
| `ai/src/__test__/run-route.test.ts` | 4 |
| `ai/src/__test__/run.test.ts` | 25 |
| `ai/src/__test__/settings.test.ts` | 15 |
| `ai/src/__test__/site-image.test.ts` | 2 |
| `ai/src/__test__/snippets-route.test.ts` | 3 |
| `ai/src/__test__/snippets.test.ts` | 6 |
| `ai/src/__test__/store.test.ts` | 7 |
| `ai/src/__test__/validators-syntax.test.ts` | 2 |
| `ai/src/__test__/validators.test.ts` | 4 |
| `ai/src/admin/__test__/agent-editor-tools.test.ts` | 5 |
| `ai/src/admin/__test__/agent-model-picker.test.tsx` | 6 |
| `ai/src/admin/__test__/agent-panel.test.tsx` | 23 |
| `ai/src/admin/__test__/ai-manager.test.tsx` | 10 |
| `ai/src/admin/__test__/ai-slot-provider.test.tsx` | 6 |
| `ai/src/admin/__test__/ai-test-sample.test.tsx` | 3 |
| `ai/src/admin/__test__/ai-translate.test.ts` | 10 |
| `ai/src/admin/__test__/mdx-format.test.ts` | 3 |
| `ai/src/admin/__test__/snippet-editor.test.tsx` | 5 |
| `ai/src/admin/__test__/use-ai-action.test.ts` | 3 |
| `ai/src/admin/__test__/word-diff.test.ts` | 2 |

## #379 admin 판정

### `admin/src/__test__/plugins.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps the loaded plugins of one site apart from another site | 작음 | 한 프로세스에 사이트가 둘인 것은 테스트와 개발 중 설정 다시 읽기뿐이다 |

### `admin/src/__test__/registry.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| has no source format without a registered panel | 작음 | 형식은 있고 패널은 없는 사이트는 드물고, 그때 틀려도 상자 미리보기 하나가 달라진다 |

### `admin/src/api/__test__/error-message.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| leaves out the field key, which is an internal name the field already stands for | 작음 (질문 → 제안대로) | Q2 → 작음 · 필드 옆 오류에 `(title)`이 붙는 것뿐이다 |
| keeps a place that is not the field's key, such as a line and a column of the body | 작음 (질문 → 제안대로) | Q2 → 작음 · 같은 함수의 다른 가지. 본문 오류의 줄과 칸은 원문 패널이 따로 보인다 |

### `admin/src/editor/__test__/editor-width.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is the normal step and full when the config sets no widths | 작음 | (질문 Q3, ⚪ 제안) · 틀려도 본문의 폭만 다르다 |
| lists the configured steps in order and appends full last | 작음 | (Q3) · 같음 |
| does not mix a configured label with a built-in step | 작음 | (Q3) · 같음 |
| applies a picked step and remembers it after reopening | 작음 | (Q3: 🟡이면 남김) · 고른 폭이 적용되고 다시 열어도 남는다. ⚪이면 이것도 지울 후보 |

### `admin/src/editor/__test__/footnotes.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps new definitions together without piling up empty paragraphs | 작음 | 빈 문단이 쌓이면 저장된 본문에 빈 문단이 남을 뿐 사이트에 보이지 않는다. 라벨은 L202 |
| does nothing where an inline reference cannot go, such as in a code block | 작음 | 틀리면 코드 안에서 쓰지 않는 정의 하나가 생기고 그렇게 표시된다 |

### `admin/src/editor/__test__/image-node-view.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| MEDIA-W1 hides the tool row and has no delete button when read-only | 작음 | (ID 틀림: 너비·자르기가 아니다) · 읽기 전용은 휴지통의 글뿐이고, 그 저장은 store가 거부한다(TRASH-T7, L1) |

### `admin/src/editor/__test__/inline-bubble.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is not there when no site format is available for the selection (in code, or none registered) | 작음 | 쓸 꾸밈이 없을 때 빈 ⋯가 보이는 것은 모양이다 |
| ticks a format the selection has, and runs the one that is picked | 작음 | ✓ 표시는 모양이고, 고른 꾸밈을 돌리는 것은 L203이 본다 |

### `admin/src/editor/__test__/internal-link-display.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| looks an entry up once however many places show it, and not again for a link just inserted | 작음 | 캐시다. 틀려도 요청이 하나 늘 뿐 보이는 것은 같다 |

### `admin/src/editor/__test__/internal-link-search.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lets a network failure through as a TypeError | 작음 | 오류의 종류는 창이 오류를 보이는 데 차이가 없다. 삼키지 않는 것은 L65가 본다 |
| shows the empty-result text when there is no error | 작음 | 결과가 없을 때의 문구. 모양에 가깝다 |

### `admin/src/editor/__test__/m13-accessibility.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| assigns unique IDs to each image editor field | 작음 | 설정 창은 한 번에 하나만 열려 id가 겹쳐도 레이블이 다른 입력을 가리키는 순간이 없다 |

### `admin/src/editor/__test__/strip-location.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| does not change the file it was given | 작음 | 부르는 쪽(`stripLocation`)은 새로 읽은 배열을 넘기므로 사용자가 겪는 일이 없다 |
| leaves a file without GPS alone | 작음 | 깨끗한 파일을 다시 고칠 것이 있다고 보면 같은 파일을 한 번 더 복사할 뿐이다 |

### `admin/src/editor/__test__/table-merge.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| mergeCells and splitCell must be unavailable when the selection is not a CellSelection | 작음 | `mergeCells`를 부르지 않고 고름이 CellSelection이 아닌지만 본다. 아무 결함도 잡지 않는다 |

### `admin/src/editor/__test__/table-resize.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| drops selection-only transactions while dragging and accepts them again after release | 작음 | (질문 Q2) · 끄는 동안 칸이 골라지는 것. 놓으면 풀리고 저장되는 것은 같다 |
| does not revert the dragged width (DOM) to the stored width when the table redraws during a drag | 작음 | (Q2) · 끄는 동안 너비가 잠깐 돌아가는 것은 모양이다 |

### `admin/src/editor/__test__/tiptap-content.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| gives the stored document in its canonical form: keys sorted, one text run per mark set | 작음 | 키 정렬과 조각 합치기는 core가 해시 전에(`canonicalDocument`), admin이 비교 전에(`documentKey`) 다시 한다. 틀려도 사용자가 겪는 일이 없다 |

### `admin/src/editor/blocks/__test__/use-block-editor.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| shows only the visible child | 작음 | 보이는 탭만 보이는 것은 모양(스타일 규칙)이다. 시각 비교가 본다 |
| moves a child together with the cursor inside it | 작음 | 옮기기는 240줄이 본다. 더하는 것은 커서가 따라가는지뿐이고, 틀려도 커서만 제자리다 |

### `admin/src/editor/blocks/added/__test__/custom-block-view.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| shows no warning list for a block without warnings | 작음 | 빈 목록이 없다는 부정 검사. 96줄이 경고가 새지 않는 것을 이미 본다 |

### `admin/src/editor/blocks/added/__test__/custom-blocks.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the slash menu lists added blocks (in config order) after the core blocks, and icons come from the definition | 작음 | 메뉴 안의 순서와 아이콘이다 |

### `admin/src/editor/blocks/fence-preview/__test__/fence-preview.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| shows only the preview, without a textarea, when not selected | 작음 | 고르지 않았을 때의 모양 |
| shows both the textarea and the preview when selected (selected=true) | 작음 | 골랐을 때의 모양 |
| updateAttributes is called after the debounce (400ms) when the textarea content changes | 작음 | 400ms 뒤 넣기는 미리보기를 새로 그리는 일이다. 떠날 때, ⌘S, 사라질 때 넣는 것은 120·168·196줄이 본다 |
| renders valid math as KaTeX output | 작음 | KaTeX가 그리는지는 모양이다 |

### `admin/src/editor/code-block/__test__/anchor-dedupe.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| undoing a duplicate removes the copy in one step | 작음 | 라벨 고침이 같은 되돌리기 단계에 붙는지. 틀려도 되돌리기를 한 번 더 누를 뿐이다 |

### `admin/src/editor/code-block/__test__/code-block-view.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| has language, file path, line effects, regex rules, line numbers, and copy in the header tools | 작음 | 도구가 있다는 것만 본다. 파일 경로, 줄 번호, 규칙, 복사는 114·179·203줄이 쓰면서 잡는다 |
| copy button copies the code without annotation lines | 작음 | 복사 단추. 주석 줄은 편집기 글자에 처음부터 없다 |
| Shift-clicking a line number extends the selected lines | 작음 | 고르기 편의. 끌어 고르기는 154줄이 본다 |
| does not show the text effect bubble while selecting lines by line number | 작음 | 말풍선이 겹쳐 보이는 것. 모양에 가깝다 |
| draws the warning underline text once across the whole line, and it stays after picking lines by line number | 작음 | 경고 밑줄 덧칠의 모양 |

### `admin/src/editor/code-block/__test__/code-block.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| Mod-a: selects everything inside the code block without including the document outside it | 작음 | ⌘A의 범위. 틀려도 보이고 되돌린다 |
| saves with the new language's comment syntax when the language changes | 작음 | core가 `//` 표기를 어느 언어에서나 다시 읽으므로(`comment-syntax-by-language.test.ts` "`//` fallback") 주석을 잃지 않는다. 표기만 다르다 |
| char collapse (marks and regex rules) stays expanded in the editor and is hidden when collapsed | 작음 | 글자 접기를 편집기에서 펴 보이는 모양 |
| lazy-loaded shiki syntax highlighting produces dual theme decorations without changing the text | 작음 | Shiki의 토큰을 본다(라이브러리). 장식은 글자를 바꾸지 않는다 |
| adds the Shiki token offset of multi-line code only once to decorate the second line | 작음 | 둘째 줄의 강조 색이 밀리는 것은 모양이다 |

### `admin/src/editor/code-block/__test__/code-link.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a body link with no linked line is flagged with a red wavy underline | 작음 | 가리킬 줄 없는 링크의 표시는 힌트다. 사이트는 BLOCK-R3대로 단추를 달지 않는다 |

### `admin/src/editor/code-block/__test__/highlight-config.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| loads one theme once when light and dark are the same | 작음 | 같은 테마를 두 번 읽는 것은 성능뿐이다 |
| is only the default list when there are no extra languages | 작음 | 63줄을 뒤집은 것. 틀릴 코드가 거의 없다 |

### `admin/src/editor/drag/__test__/block-refine.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the gap between list items maps to the nearest item, not the whole list | 작음 | 항목 사이 틈의 가장자리 경우 |

### `admin/src/editor/text-check/__test__/extract.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| extracts table cell text one by one too | 작음 | 표의 칸이 빠지면 거기만 검사되지 않을 뿐이다 |
| skips blocks without letters (only digits or symbols) | 작음 | 숫자만 있는 블록을 보내는 것은 비용뿐이다 |

### `admin/src/editor/text-check/__test__/run.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| stops sending when aborted | 작음 | 끊은 뒤에도 보내면 비용이 들 뿐, 결과는 글자로 맞춘 캐시로 놓인다 |
| keeps results when only marks such as bold change | 작음 | 굵게만 바꿔 결과가 사라져도 다시 검사하면 된다 |

### `admin/src/editor/text-check/__test__/text-check-editor.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| shows no button when no checker is registered | 작음 | 검사기 없이 단추가 보여도 누르면 아무 일이 없을 뿐이다 |

### `admin/src/hooks/__test__/result.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| maps an AbortError to aborted | 작음 | 틀리면 플러그인이 스스로 멈춘 실행에 오류 한 줄이 남을 뿐이다 |
| keeps the original error as cause | 작음 | 개발자만 보는 값 |

### `admin/src/host/__test__/admin-theme-provider.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| stores the admin theme under the key the site picks | 작음 (질문 → 제안대로) | Q1 → 작음 · 사이트가 고른 키를 무시해도 기본 키가 사이트의 키와 겹칠 때만 문제다 |

### `admin/src/lib/hooks/__test__/use-hydrated-query.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| hydrates without a mismatch when the cache already holds the data, then shows it | 작음 | 공개(`kit`) 훅이지만, 틀려도 React가 회복할 수 있는 hydration 오류를 남기고 브라우저에서 다시 그릴 뿐이다 |
| is needed: reading the cached query directly does not match the server HTML | 작음 | 우리 코드가 아니라 React Query와 React의 동작을 본다 |

### `admin/src/lib/hooks/__test__/use-preference.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| starts with the remembered value on the first render, not the default | 작음 (질문 → 제안대로) | Q5 → 작음 · 기억한 패널 폭이 한 번 깜박이는 것뿐이다 |
| keeps every component on one preference in step, and forgets it on reset | 작음 (질문 → 제안대로) | Q5 → 작음 · 같은 기억값을 쓰는 두 곳이 잠깐 다르게 보인다 |
| follows a change made outside the component | 작음 (질문 → 제안대로) | Q5 → 작음 · 다른 탭에서 바꾼 패널 상태를 따라가지 않는다 |
| reads booleans and positive numbers strictly | 작음 (질문 → 제안대로) | Q5 → 작음 · 42줄이 잘못된 값의 대체를 본다 |

### `admin/src/lib/utils/__test__/move-within.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| moves items that are falsy | 작음 | 부르는 곳은 모두 글자(id, 이름)를 옮긴다 |

### `admin/src/lib/utils/__test__/site-storage.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps two sites on one origin apart | 작음 | 기억값(패널 폭)이 두 사이트에 섞이는 것뿐이다. 임시 저장본이 섞이는 결함은 local-backup의 WRITE-R1 97줄이 잡는다 |

### `admin/src/router/__test__/router.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| fails with a message that names the missing provider when there is none | 작음 | 호스트 패키지를 만드는 개발자만 보는 문장이다. 던지지 않아도 바로 다음 줄에서 실패한다 |

### `admin/src/screens/__test__/admin-entries-table.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-F6 starts a folder row's name in the title's cell, after the folder icon, with how many things are in it, and no status | 작음 | 칸의 순서, 아이콘, `colspan`은 모양이다(시각 회귀의 몫). 폴더 행이 열리는지는 `list-folders-flow`가 본다 |
| LIST-S3 a taxonomy item shows its first language and how many others have a name | 작음 | ⚪. 같은 `LanguageCell`을 `admin-list-rows`:72가 본다. 다른 것은 `recordLocales ??`를 먼저 읽는 한 줄뿐이다 |
| LIST-C5 the drag image is removed from the page after the drag starts | 작음 | 남은 끌기 그림은 화면 밖의 빈 노드라서 사용자가 보지 못한다 |
| LIST-S3 welcomes a document collection with no entries, offering to write and to import Markdown | 작음 | ⚪ 빈 화면의 문구와 단추다. 동작은 가져오기 링크의 주소 하나뿐이다 |
| LIST-S3 keeps the plain empty state with an add button for an item collection | 작음 | ⚪ 빈 화면 |

### `admin/src/screens/__test__/admin-options.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| are the schema file's tabs, Site first; templates, the event log and plugin pages are not among them | 작음 | 탭의 목록과 순서는 모양에 가깝다. 탭이 사라지면 SET-N1의 테스트가 404로 잡는다 |

### `admin/src/screens/__test__/admin-sidebar.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lists the collections, then media, and ends with trash, tools and settings | 작음 (질문 → 제안대로) | 관리자 틀 (⚪ 제안, 그러면 작음) · 줄의 순서는 모양이다 |
| marks the open row, and the tools row for a page of the tools page | 작음 (질문 → 제안대로) | 관리자 틀 (⚪ 제안, 그러면 작음) · 지금 위치의 표시다 |
| counts what is in the trash, and says nothing when it is empty | 작음 | 🟡 휴지통 둘러보기의 덤이다. 수가 틀려도 휴지통 화면이 맞는 것을 보인다 |
| leaves media out when the site has no storage | 작음 (질문 → 제안대로) | 흐름 6·31과 다름 (아래 질문 5) · 보드는 저장소 없는 미디어 화면을 보이고, 코드는 사이드바에서 미디어를 숨겨 그 화면에 갈 길이 없다 |
| offers no way to add, rename or delete a folder | 작음 | 없는 것을 본다. 생겨도 사용자가 잃는 것이 없다 |

### `admin/src/screens/__test__/entry-list-screen.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 shows the title and, for a collection with a public route, its address rule beside it | 작음 | ⚪ 머리의 제목과 주소 규칙은 모양이다 |
| LIST-S1 requests the list once, with the saved sort, and not first with the defaults | 작음 | ⚪. 기본값으로 한 번 더 요청해도 마지막에 보이는 목록은 같다 |

### `admin/src/screens/__test__/list-cells.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 leaves empty values off the row and shows the raw value for a select option that no longer exists | 작음 | ⚪. 없어진 선택지의 값이 빈칸으로 보여도 값은 남는다(WRITE-S8) |

### `admin/src/screens/__test__/list-menus.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S1 opens a column's menu from the keyboard too, with the arrow down on its name | 작음 | ⚪. 메뉴를 키보드로 여는 것은 ui 부품의 일이다 |
| LIST-C5 hangs a check on each row and a select-all on the head row, and the bar replaces the column names in the same place while rows are picked | 작음 | 막대가 머리 줄의 자리를 쓰고 열 폭이 그대로인지는 모양이다(시각 회귀). 고르기와 "일부" 표시는 316과 `bulk-bar.dom`:167이 본다 |

### `admin/src/screens/__test__/rail-folders.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| ignores an open folder it does not know | 작음 | 지운 폴더가 열려 있으면 맨 위만 보인다. 사용자가 잃는 것이 없다 |
| shows nothing for no folders | 작음 | 빈 배열 |
| is empty for the top level and for a folder that is not known, and ends on a loop in the data | 작음 | 고리는 망가진 데이터에서만 생긴다 |

### `admin/src/screens/__test__/record-panel.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| opens as a panel beside the list and shows per locale tab whether a translation exists | 작음 | 탭의 "번역 있음/없음"은 표시다. 탭을 눌러 그 언어를 고치는 것은 63이 본다 |
| shows no language tabs when the site turns the translation UI off, and still edits the default language | 작음 | ⚪(관리자 옵션으로 끄면 숨는 것, 제안대로 2026-10-31) |
| a series edits its post list on the default locale tab | 작음 | 콤보박스가 있는지만 본다. 고친 목록이 저장되는지는 보지 않는다 |

### `admin/src/screens/entries/__test__/body-stats.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| counts characters without whitespace, nested blocks included | 작음 (질문 → 제안대로) | 상태 줄의 글자 수 (제안 ⚪) · 틀리면 상태 줄의 숫자만 틀린다. ⚪면 작음 |
| does not split a word that holds a bold part, and counts an empty body as zero | 작음 (질문 → 제안대로) | 같은 질문 · 위와 같다 |

### `admin/src/screens/entries/__test__/bulk-bar.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-C5 says how many are picked, and lets go with one press | 작음 | 고른 수 표시와 "선택 풀기"는 LIST-C5의 약속이 아니다. 깨져도 행의 체크를 풀면 된다(확신 낮음) |
| LIST-C5 draws nothing while no row is picked, and has no request to the assistant yet | 작음 | 고른 행이 없을 때 막대가 없는 것은 겉모양이다. 뒤 절반(어시스턴트 요청이 없다)은 아직 없는 기능의 부재를 보고 언제나 통과한다 |

### `admin/src/screens/entries/__test__/custom-field-input.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a multi-line text field is a multi-line input with `rows` rows | 작음 | 여러 줄 입력의 줄 수는 겉모양이다. Enter로 줄을 바꾸는 동작은 `properties-flow` 180이 본다 |

### `admin/src/screens/entries/__test__/entry-editor-shell.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| tells a missing entry how to find it again instead of asking for a refresh | 작음 | 안내 문구는 ⚪로 정했다. 지웠다 |
| opens a body that could not be read in the panel, and shows the visual editor's box when there is none | 겹침 | 555줄의 WRITE-P8. 변이: 이 테스트만 잡는 바꿈 0. 지웠다 |
| moves to another language by its link, and has no tab list without panels | 겹침 | 861줄. 변이: 0. 지웠다 |
| hides the language tabs of the editor | 작음 | 기능을 끄는 관리자 옵션은 ⚪로 정했다. 지웠다 |
| with no translation state or a malformed one, nothing is treated as confirmed | 겹침 | L1의 TRANS-N9. 변이: 0. 지웠다 |
| opens from the header and shows the plugin's component next to the editor | 겹침 | `side-panel-slot.dom.test.tsx`의 PLUG-A5 "opens and closes from the button in the header…" |

### `admin/src/screens/entries/__test__/entry-editor-store.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is loading until the server answers | 작음 | 처음 상태의 모양이다. 화면은 이 값으로 로딩을 그리고, 저장은 버전이 막는다 |
| drops the result of a load that was stopped | 작음 | 멈춘 편집기는 버려지므로 늦게 온 결과가 남아도 사용자에게 보이지 않는다 |
| is null for an entry that is not a translation | 작음 | 상태 칸 하나의 기본값. 원문에 번역 막대가 뜨면 shell 테스트가 잡는다 |

### `admin/src/screens/entries/__test__/field-input-parts.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| when empty, it is a pick button | 작음 | 빈 값일 때의 단추 글자. 고르기는 `editor-media-flow` 377이 본다 |

### `admin/src/screens/entries/__test__/lifecycle-confirm.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| transitions that do not ask also have text to announce when done | 작음 | 사전에 끝난 뒤의 문구가 있는지만 본다. 빠지면 타입 검사나 키가 보이는 화면이 알린다 |

### `admin/src/screens/entries/__test__/plugin-tab.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the config has fields a plugin places | 작음 | 다음 테스트가 건너뛰지 않게 테스트 설정을 확인한다. 다음 테스트가 설정을 직접 만들면 필요 없다 |
| a collection no plugin places fields in and no layout group has a tab has only the default tab | 작음 | 빈 탭이 하나 더 보이는 것은 겉모양이다 |

### `admin/src/screens/entries/__test__/post-relation-inputs.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| sends one request for a burst of typing | 작음 | 요청 수. 사용자는 알아채지 못한다 |
| only asks for published posts when the field says so | 작음 | 깨져서 초안을 고르면 발행 검사(WRITE-P1)가 할 일로 막는다(확신 낮음) |
| names the picked posts of an ordered list by looking them up by id | 작음 | 이 테스트만의 몫은 없는 글의 "없음" 표시다. 없는 글은 발행 검사가 할 일로 잡는다(확신 낮음) |
| each item has a handle for dragging | 작음 | 손잡이가 있는지만 보고 끌기는 보지 않는다. 겉모양이다 |

### `admin/src/screens/entries/__test__/removed-fields-notice.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lists the keys of the values the schema no longer has | 작음 (질문 → 제안대로) | 지운 필드의 값 알림 (제안 ⚪) · 값은 WRITE-S8이 지킨다. 알림이 깨지면 숨은 값이 있다는 것만 모른다 |
| renders nothing when every value has a field | 작음 | 빈 알림이 보이는 것은 겉모양이다 |
| renders nothing without metadata or for an unknown collection | 작음 | 드문 입력의 방어 |

### `admin/src/screens/entries/__test__/use-entry-editor.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| useEntryEditorContext outside a provider says so | 작음 | 개발자만 보는 오류 |
| EntryEditorProvider needs the value that useEntryEditor returned | 작음 | 개발자만 보는 오류 |
| callbacks may be new functions on every render and the latest one is called | 작음 | 공개 훅의 세부 계약. 기본 화면의 콜백은 바뀌지 않는 값만 쓴다(확신 낮음) |

### `admin/src/screens/entries/__test__/use-field.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a new entry's slot request has the `new` scope | 작음 | 요청의 칸 하나. 사용자가 알아채지 못한다 |
| throws outside an EntryFormProvider | 작음 | 개발자만 보는 오류 |

### `admin/src/screens/entries/__test__/write-and-publish-flow.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| starts with the collection as a link back, the full path and the status | 작음 | 머리의 돌아가는 링크, 경로, 상태 글자. 상태 글자는 231·253이 다시 본다 |

### `admin/src/screens/events/__test__/events-screen.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lists failed and dead deliveries with subscriber and state | 작음 | 상태 이름과 지운 글의 제목은 165의 대표 흐름에 얹힌 표시다 |
| pages through the events | 작음 | 쪽 넘기기는 목록의 쪽과 같은 ⚪이다 |

### `admin/src/screens/login/__test__/login-page.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| AUTH-C3 falls back to Monti when the site has no name | 작음 | 이름 없는 사이트에서 머리 글자가 비어도 로그인은 된다 |

### `admin/src/screens/settings/__test__/place.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| comes back once, for the same address only | 작음 | 저장 뒤의 스크롤 자리는 ⚪이다 |

### `admin/src/screens/shared/__test__/admin-frame.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps the rail in a drawer on a narrow screen: a button opens it, choosing a row closes it, and there is no fold | 작음 (질문 → 제안대로) | 관리자 틀 (⚪ 제안, 그러면 작음) |
| folds with the fold button and unfolds with the button that takes its place | 작음 (질문 → 제안대로) | 관리자 틀 (⚪ 제안) |
| folds and unfolds with ⌘B and Ctrl+B | 작음 (질문 → 제안대로) | 관리자 틀 (⚪ 제안) |
| names a folded row and its count in a tooltip | 작음 (질문 → 제안대로) | 관리자 틀 (⚪ 제안) |

### `admin/src/screens/shared/__test__/folder-actions.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| ends on a folder that is not known or on a loop in the data | 작음 | 고리는 망가진 데이터에서만 생긴다 |

### `admin/src/screens/shared/__test__/noun.messages.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| reads the label of the collection, and nothing for an unknown one | 작음 (질문 → 제안대로) | 관리자 문구의 컬렉션 이름 (🟡 제안, 아래 질문 4) |
| keeps a label with capitals of its own | 작음 (질문 → 제안대로) | 같음 |
| uses a neutral word when the collection is unknown | 작음 (질문 → 제안대로) | 같음 |
| bulk confirmations of a list name the label in both languages | 작음 (질문 → 제안대로) | 같음 |

### `admin/src/screens/shared/__test__/page-window.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| are every page of a list of up to seven pages | 작음 | ⚪(쪽). 쪽 단추가 틀려도 "다음"으로 넘어간다 |
| keep the same number of buttons on every page of a longer list | 작음 | ⚪, 모양 |
| show the first five pages and the last near the start | 작음 | ⚪ |
| show the first and the last, and the current page with its neighbours in between | 작음 | ⚪ |
| show the first page and the last five near the end | 작음 | ⚪ |

### `admin/src/screens/shared/__test__/save-cell.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| marks what needs attention as a warning and what is broken as danger | 작음 | 색은 모양이다 |
| marks changes that are not on the server yet, and nothing else | 작음 | 칸의 점은 모양이다 |

### `admin/src/screens/shared/__test__/side-panel-slot.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| opens and closes with the keyboard shortcut, and leaves other keys alone | 작음 | 🟡의 덤: 단축키가 없어도 머리의 단추로 연다 |

### `admin/src/screens/shared/__test__/todo-rows.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| words an empty field with its name, and picks instead of writing for a field that is chosen | 작음 | 줄의 동사("쓰기"와 "고르기")가 틀려도 누르면 그 필드로 간다 |
| names the thing a problem is about | 작음 | 문구의 빈칸 하나 |
| does not remember a problem that has no name to put under a check | 작음 | 이름 없는 체크 줄 하나 |
| lists every required field when nothing is left to fix | 작음 | 133의 빈 경우 |
| leaves out the fields that have their own row because they were fixed just now | 작음 | 같은 이름이 두 번 보이는 것뿐이다 |
| lists the required fields in the order of the form | 작음 | 순서 |
| names a field of a conditional group when its condition is met and it has no problem | 작음 | 조건 판단은 가짜 `site.requiredFieldsOf` 안에 있다. 실제 판단은 core의 SCHEMA-S3이 본다. 여기서 남는 것은 메타데이터를 넘기는 것뿐이다 |
| leaves out a field whose condition is not met | 작음 | 같음 |
| asks the check only for the fields written per language when the entry is a translation | 작음 | 번역의 "준비된 것"에 원문과 함께 쓰는 필드가 보이는 것뿐이다(확신 낮음) |

### `admin/src/screens/shared/__test__/use-draft-editor.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is busy while saving or deleting | 작음 | 바쁨 표시 하나 |

### `admin/src/screens/templates/__test__/template-model.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lists the headings in order, whatever their level | 작음 (질문 → 제안대로) | 템플릿 관리 (🟡 제안, 아래 질문 3). 🟡이면 작음 · 목록의 요약 줄 |
| is empty when there is no heading, and skips an empty one | 작음 (질문 → 제안대로) | 같음, 🟡이면 작음 |

### `admin/src/screens/templates/__test__/templates-flow.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| starts a new template from the header: it goes to the new template page | 작음 (질문 → 제안대로) | 같음, 🟡이면 작음 |
| shows a failed load with the server's message and a retry, under the back link | 작음 (질문 → 제안대로) | 같음, 🟡이면 작음 |

### `admin/src/screens/tools/__test__/tools-tabs.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| leaves templates out when the site turns them off | 작음 | ⚪(관리자 옵션으로 끄면 숨는 것, 제안대로 2026-10-31) |
| knows which nav ids belong to the tools page | 작음 (질문 → 제안대로) | 관리자 틀 (⚪ 제안, 그러면 작음) · 사이드바의 도구 줄을 현재로 표시하는 데만 쓴다 |

### `admin/src/slots/__test__/slots.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| says fill while the target is empty and again once it has a value; both are the same press | 작음 | 단추의 낱말뿐이다. 모양은 `ui`의 `AiAction` 스토리가 본다 |

### `admin/src/slots/__test__/use-slot-actions.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| an unknown action id fails with invalid_state | 작음 | 화면은 목록에 있는 id만 부른다. 틀리게 부르는 것은 플러그인 개발자의 실수다 |
| two hook instances with the same slot, target, collection and scope share one run state; another scope does not | 작음 | 같은 필드의 단추가 동시에 두 곳에 있을 때만 다르다(확신 낮음, 아래) |

### `admin/src/ui/__test__/screen-mode.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| offers the three modes at once, the system pressed until one is picked | 작음 (질문 → 제안대로) | Q4 → 작음 · 처음 상태의 표시뿐이다 |
| picks each mode with one press and keeps it in this browser | 작음 (질문 → 제안대로) | Q4 → 대표 하나로 남길지 소유자가 · 고른 모드가 기억되지 않는 결함 |
| starts at the mode that is stored | 작음 (질문 → 제안대로) | Q4 → 작음 · 49줄과 같은 기억을 다른 쪽에서 본다 |
| is one button on the folded rail, which opens the three modes with the current one checked | 작음 (질문 → 제안대로) | Q4 → 작음 · 접은 막대의 모양과 메뉴다 |
| is light or dark as stored, and the system for anything else | 작음 (질문 → 제안대로) | Q4 → 작음 · 잘못 저장된 값의 대체. next-themes가 먼저 거른다 |

## #381 admin 겹침과 세부

### `admin/src/__test__/plugins.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lets a plugin page share a name with a core screen: pages live under tools/ | 작음 | 틀려도 분명한 말로 시작을 막을 뿐이고, 개발자가 이름을 바꾸면 된다 |
| loads plugins with distinct pages | 겹침 | 같은 파일 42줄 · 플러그인을 빠뜨리거나 순서를 바꾸는 결함은 42줄도 잡는다(두 플러그인의 자리를 본다) |

### `admin/src/__test__/registry.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| finds a registered format by name, and gives undefined for any other name | 겹침 | `mdx/src/admin/source-panel.test.tsx` "FMT-P2 the mdx admin components register the mdx format, found by name and absent without the provider" · 그 테스트도 `useFormat`이 이름으로 찾고, 다른 이름(`markdown`)과 프로바이더 없음에 `undefined`인지 본다 |

### `admin/src/editor/__test__/any-site-blocks.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the active config adds at least one insertable block | 세부 | 약속이 아니라 아래 `it.each`가 비지 않았는지 보는 전제 |

### `admin/src/editor/__test__/block-commands.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| finds the top-level block for a position inside it | 세부 | 손잡이가 쓰는 내부 도우미. 엉뚱한 블록을 고르면 L35와 writing-flow의 WRITE-W2가 잡는다 |

### `admin/src/editor/__test__/block-ids.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| are given to every block of a body loaded from MDX, all different | 겹침 | 같은 파일 L82·L95, core `doc/__test__/block-ids.test.ts` "TRANS-B1 gives every block, and only blocks, a unique id" · `tiptapOf`가 이미 id를 준 문서를 넣어 편집기의 id 주기는 거의 돌지 않는다. 새 블록과 겹친 id는 L82·L95가 본다 |
| are paired with the previous document when MDX comes back from source mode | 겹침 | core `doc/__test__/block-ids.test.ts` "TRANS-B1 survive an edited paragraph, an inserted block and a removed block" · 짝짓기는 `docOf(text, previous)`(테스트 도우미와 core)가 하고, 편집기는 받은 id를 지킬 뿐이다(L65) |

### `admin/src/editor/__test__/converters.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| no two default converters handle the same node type (matches branches allowed) | 세부 | 등록표의 모양. 같은 종류를 둘이 맡아 틀리게 바꾸면 L63과 tiptap-content의 왕복이 잡는다 · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |
| the registry does not shadow types handled by the default branch | 세부 | 같음 |
| finds a converter by type | 세부 | 찾기 함수 자체. 모든 왕복이 이것을 거친다 |

### `admin/src/editor/__test__/document-key.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is worked out once for a document | 세부 | 캐시. `toBe` 비교는 캐시가 없어도 통과해 아무것도 잡지 않는다 |

### `admin/src/editor/__test__/footnotes.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| loads footnotes as editable nodes instead of a source box | 겹침 | mdx `editor-roundtrip.test.ts` "FMT-R3 opens as editable nodes instead of a source box" + "FMT-R3 round-trips references and definitions, also with code inside a definition" · 같은 `storedToTiptap`을 L1에서 거친다. 정의 안의 코드 블록이… |
| gives an empty definition a paragraph so it can be typed into, and saves it as empty | 겹침 | mdx "FMT-R3 saves an empty definition as empty" + 같은 파일 L56 · 빈 정의의 저장은 mdx가 본다. 입력할 문단을 주는 것만 남는다 |
| moves a definition nested by pasting or dragging out to the top level when saving | 겹침 | mdx "FMT-R3 moves a definition nested by pasting or dragging out to the top level when saving" · 같은 `tiptapToStored` 입력이고, 결과를 MDX로 본다 |
| renumbers when a reference is added before another | 겹침 | 같은 파일 L148 · L148도 앞에 참조를 넣고 뒤 참조의 번호가 2로 바뀌는지 화면에서 본다 |
| starts at 1 and does not touch the existing numbering | 겹침 | 같은 파일 L253 · 각주가 없는 글에 넣은 라벨이 "1"인지 L253의 저장 문서가 본다 |

### `admin/src/editor/__test__/image-node-view.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| MEDIA-E2 clearing alt text in the settings popover shows an error there, and decorative images are turned on with the switch | 겹침 | `editor-media-flow` L274 "MEDIA-E2 opens the image card with the alt text focused; typing sets the alt text and decorative clears it" — 같은 카드의 빈 대체 텍스트 알림과, 꾸밈용 스위치가 alt를 비우는 것을 L274가 실제 편집기로 본다 · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |

### `admin/src/editor/__test__/inline-bubble-code-features.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| offers text styles, tooltip and fold in code when everything is on | 겹침 | 같은 파일 L96·L106 + `inline-bubble` L331 · 하나씩 끈 두 테스트가 남은 도구가 코드에 나오는지 본다 |
| does not change the bubble outside code | 겹침 | 같은 파일 L156 · 코드 밖에서는 설정이 글자 스타일을 빼지 않는 것을 함수로 본다 |

### `admin/src/editor/__test__/inline-bubble.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| detects footnote references and resolves their definition position and text | 겹침 | 같은 파일 L394 · L394가 말풍선에 번호와 정의의 글을 보이고 그 라벨로 글을 고친다 |

### `admin/src/editor/__test__/slash-and-tooltip.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| extensibility: adding a new block definition and action to the registry auto-generates a slash command | 겹침 | `any-site-blocks` "%s is in the slash menu under its own label" + 같은 파일 L124 · 라벨은 any-site가, 키워드는 L124의 찾기가 잡는다. 설명만 남는데 작다 |
| SLASH_COMMANDS includes both the base commands and the auto-generated block commands | 겹침 | allowed-body L176 "lists only the blocks and heading levels the list allows" · 목록이 없을 때 기본 항목과 블록 항목이 함께 있는지 L176이 본다. 툴팁이 core 목록에 없는 것은 작다 |
| round-trips a tooltip label containing a closing bracket unescaped | 겹침 | mdx "FMT-R2 round-trips a tooltip whose label contains a closing bracket" · 닫는 대괄호는 MDX 표기의 문제다. 저장 문서(JSON)에는 이스케이프가 없어 이 테스트는 그 결함을 잡지 못한다 |
| sets the cmsTooltip mark on the selection and saves it in the stored document | 겹침 | 같은 파일 L262 · 툴팁 표시를 저장 문서로 바꾸는 같은 변환. `setMark`는 Tiptap의 것이다 |
| edits the description with extendMarkRange when the cursor is inside a tooltip mark | 세부 | Tiptap의 `extendMarkRange`를 본다. 사용자가 설명을 고치는 화면은 거치지 않는다 |
| removes the tooltip with extendMarkRange when the cursor is inside a tooltip mark | 세부 | 같음 |

### `admin/src/editor/__test__/strip-location.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| gives back the same file when there is nothing to remove, and a clean copy with the same name and type when there is | 겹침 | `upload-helper.test.ts` "MEDIA-U4 removes the GPS tags from a file that is kept as it is, without changing its type or name" — 사본의 이름·형식·크기는 그쪽이 `prepareUpload`를 거쳐 본다. 고칠 것이 없을 때 같은 파일을 돌려주는 것은 작다 · 변이 테스트: 이 테스트만 잡는 바… |

### `admin/src/editor/__test__/tiptap-content.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| maps a line break to the editor's hardBreak and back to the one document node | 겹침 | 같은 파일 L47 · L47의 문서에 `<br />`가 있고 스키마를 거쳐 그대로 돌아오는지 본다. 편집기 쪽 노드 이름만 더 본다 |
| preserves blocks not in the schema as boxes and restores them | 겹침 | 같은 파일 L169 · 모르는 블록이 상자가 되고 그대로 돌아오는지를 L169가 id까지 정확히 본다 |
| the mark name of the added text decoration (block extension tooltip) matches the schema | 세부 | 이 파일이 손으로 맞춘 스키마에 이름이 있는지 본다. 실제 편집기에서 툴팁이 남는지는 `slash-and-tooltip` L262 |

### `admin/src/editor/__test__/tiptap-editor-doc.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| shows the document it is given | 겹침 | `writing-flow` "WRITE-W1 puts the chosen template's blocks at the cursor…"(받은 "앞", "뒤"가 저장에 남는다) · 받은 문서를 보이는 것은 편집기를 여는 모든 테스트가 기댄다. 고정 도구 줄이 없는 것은 모양 |

### `admin/src/editor/__test__/tiptap-schema.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| headings and paragraphs have a textAlign attribute with no default | 세부 | 스키마 설정값. 정렬 없는 본문이 정렬 없이 돌아오는지는 `tiptap-content` L47이 본다 |
| allowed alignments are only left, center, and right (justify is forbidden) | 세부 | 확장의 옵션. 정렬 메뉴가 왼쪽·가운데·오른쪽만 보이는 것은 `writing-flow` "WRITE-W2 align: …"이 본다 |

### `admin/src/editor/blocks/__test__/core-block-views.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a site replaces the file view | 겹침 | 81줄 · 보기 찾기는 `block-node-view.tsx`의 `blockViews[definition.name]` 한 줄이라, 그림 보기 교체가 잡는 결함과 같다. 파일 보기는 쓰기도 하지 않는다 |

### `admin/src/editor/blocks/added/__test__/containers.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| inserts the code explorer via slash with one code block, not an empty paragraph | 겹침 | `packages/blocks/src/code-explorer/__test__/editor.test.tsx` "BLOCK-E1 the slash menu inserts the block with one code block `src/index.ts`…" · 같은 `blockInsertActions["code-explorer"]`로 넣고 자식 하나, 언어, meta를 본다. 저쪽은 파일 목록과… |
| long titles are also preserved through HTML copy and paste | 겹침 | 76줄 · 길이를 다루는 코드가 없고, 값은 76줄과 같은 `data-monti-values` JSON 하나로 오간다 |
| a callout without body opens with an empty paragraph, and saving it left empty restores it without body | 겹침 | `packages/mdx/src/__test__/editor-roundtrip.test.ts` "FMT-R2 writes a callout without a body as a self-closing element" · 빈 본문이 빈 문단으로 열리고 빈 채 저장하면 본문 없이 돌아오는 것을 같은 `storedToTiptap`/`tiptapToStored`로 본다 |
| the schema rejects fewer than two tabs or two columns | 세부 | 스키마 객체의 `contentMatch`를 직접 읽는다. 탭은 122줄이 동작으로 잡는다. 열의 최소 2개를 122줄처럼 손잡이 지우기로 잡게 더하고 지운다 |

### `admin/src/editor/blocks/added/__test__/custom-blocks.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a custom block with an editor node moves its attributes and body into the node and round-trips unchanged | 겹침 | `containers.dom.test.ts:39`, 그리고 mdx `editor-roundtrip.test.ts` "FMT-R2 round-trips a block with an editor node, a raw-source box and a code fence block" · `notice`는 상자 블록과 같은 변환기를 거친다. 39줄은 스키마와 id까지, mdx는 글자까지 본다. 더 보… |
| a custom block set as a raw-source box is preserved as is | 겹침 | mdx `editor-roundtrip.test.ts` 같은 테스트, `__test__/tiptap-content.test.ts` "keeps a box exactly as it was, nested ids and all…" · 원문 상자의 왕복과 id는 저 둘이 본다 |
| the code explorer block starts with one `src/index.ts` code block | 겹침 | `packages/blocks/src/code-explorer/__test__/editor.test.tsx` "BLOCK-E1 the slash menu inserts…" · 같은 정의 값을 저쪽이 넣기 동작으로 본다. 규칙은 86줄이 본다 |
| a code fence block moves that language's code block into a node and round-trips the meta | 겹침 | mdx `editor-roundtrip.test.ts` "FMT-R2 round-trips a block with an editor node, a raw-source box and a code fence block" · 같은 `mermaid title=흐름` 글을 같은 변환으로 왕복한다. 더 보는 것은 attrs의 모양(세부) |

### `admin/src/editor/code-block/__test__/code-block-features.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lists only the offered line effects | 겹침 | 108줄 · 108줄의 "그 효과가 없는 줄에는 메뉴에 없다"가 같은 결함(omit을 무시)을 잡는다 |
| keeps showing a rule whose effect is turned off (text styles off) and saves it unchanged | 겹침 | 182줄 · 꺼진 효과의 규칙이 그대로 저장되는 것은 182줄(`textStyles: false`, `strong` 규칙)이 본다. 더하는 것은 패턴 칸이 보이는지뿐 |

### `admin/src/editor/code-block/__test__/code-block.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| plain code without comments round-trips byte for byte | 겹침 | mdx `editor-roundtrip.test.ts` "FMT-R2 round-trips %s" (a code block) · 같은 `codeBlockConverter` 왕복을 저쪽이 글자로 본다 |

### `admin/src/editor/code-block/__test__/code-link-absent.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| finds the decoration pointing at code lines in the block definitions (`codeAnchor`) | 세부 | 코드의 이름 규칙을 테스트 안에서 다시 짠다. 찾기가 틀리면 `code-link.dom.test.ts:42`가 실패한다(참조 블로그 설정에는 그 꾸밈이 있다) |

### `admin/src/editor/code-block/__test__/highlight-config.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| loads the configured languages by default | 세부 | 같은 이름을 두 번 부르는 것까지 호출 목록으로 고정한다. 설정의 언어가 넘어가는 것은 63줄이 같은 `site.EXTRA_CODE_LANGUAGES`로 본다 |

### `admin/src/editor/drag/__test__/drag-commands.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| CmsBlockDrag plugin: a valid drop moves the document and a disallowed drop is ignored | 겹침 | `drop-indicator.dom.test.ts:15`, 이 파일 302줄 · `view.dragging`의 내부 모양(`cmsBlockPos`)을 손으로 만든다. 플러그인의 놓기는 15줄이 `startBlockDrag`부터, 목록 감싸기는 302줄이 본다. 제목의 "disallowed drop is ignored"는 단언이 없다 |
| the sole paragraph of a list item is still not taken out | 겹침 | `review-fixes.dom.test.ts:40` · `canDropBlockNode`가 `placeableContentAt`에서 `sourceRangeOf`를 쓰므로, 40줄이 같은 결함을 결과로 잡는다 |

### `admin/src/editor/internal-link.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| saves the id alone: the address shown in the editor is not stored | 겹침 | `tiptap-content.test.ts` "keeps internal links as the id of their entry, without the address the editor shows" · 보이는 주소를 저장에서 빼는 것은 같은 `tiptapToStored` 갈래이고, 그쪽이 L1이다 |
| saves the id as the link, and the saved document opens as the same link | 겹침 | 같은 파일 L48 + `tiptap-content.test.ts`의 같은 테스트 · 넣은 링크의 id(L48)와 저장·다시 열기(L1)를 합친 것 |
| opens a stored document with a link by id and saves it back unchanged | 겹침 | `tiptap-content.test.ts` "keeps internal links as the id…" + "does not lose inline marks, headings, and line breaks"(제목 있는 바깥 링크) · 두 링크의 왕복을 L1이 본다 |

### `admin/src/editor/text-check/__test__/run.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| has automatic checking off by default | 겹침 | `text-check-editor.dom.test.tsx:311`, `:322` · 기본값이 켜지면 311줄이, `auto: true`가 꺼지면 322줄이 실패한다 |
| draws results as wavy underlines | 겹침 | `text-check-editor.dom.test.tsx:186` · 저쪽이 같은 `[data-text-issue]`의 글자를 본다. 더 보는 `data-severity`는 모양 |
| reports the result when an underline is clicked | 겹침 | `text-check-editor.dom.test.tsx:218` · 저쪽도 같은 `handleClick`으로 결과 창을 연다. 밑줄 밖 클릭이 아무것도 열지 않는 것만 더한다 |

### `admin/src/hooks/__test__/store.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| merges partial updates and notifies subscribers | 세부 | 지울 후보: zustand를 감싼 내부 모듈. 이 store를 쓰는 `use-field.dom.test.tsx`의 모든 테스트가 같은 결함을 잡는다 · 내부 모듈의 동작 |
| a selector hook re-renders only when its slice changes | 세부 | 동작 쪽: `use-field.dom.test.tsx` "typing in one field does not re-render the component of another field" · 내부 훅을 따로 렌더한다 |

### `admin/src/lib/hooks/__test__/use-url-state.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| reads the address and falls back to defaults for bad values | 세부 | 내부 훅(`kit` 밖). 판단(`pageParam`, `enumParam`의 parse)은 이미 순수 함수라 원하면 L1으로. 동작 쪽은 `media-flows.dom.test.tsx`가 주소(`folder=blog&alt=none`)를 읽는다 · 내부 훅을 따로 렌더한다 |
| follows a change of the address made elsewhere | 세부 | 같음 · 내부 훅을 따로 렌더한다 |

### `admin/src/lib/utils/__test__/site-storage.dom.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| names its keys after the site and its admin path | 겹침 | `screens/entries/__test__/local-backup.dom.test.ts` "WRITE-R1 keeps a site's copies in a database named after the site and its admin path" · 그 테스트가 같은 `storageNamespace`로 만든 이름(`cms_backup:Blog${ADMIN_PATH}`)을 본다. 남는 것은… |
| keeps two admins of one site name apart by their admin path | 겹침 | `local-backup.dom.test.ts` 91줄(위와 같음) · 이름공간에서 관리자 경로를 빼면 91줄의 기대 이름과 달라진다 |

### `admin/src/router/__test__/router.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| draws links with the host's Link and reads the address through the host's hooks | 겹침 | `nextjs/src/admin/__test__/admin.test.tsx` "SITE-N1 gives the admin Next's address and a link to an address inside the site"; admin 안에서는 `screens/__test__/entry-list-screen.dom.test.tsx` "LIST-F6 adding a post creates i… |
| navigates and replaces through the host, and re-renders when the host's address changes | 겹침 | nextjs의 "SITE-N1 navigates through Next's router: push for a new history entry, replace with its options"; 위의 LIST-F6 · 같음. 다시 그리기는 호스트 훅의 몫이다 |

### `admin/src/screens/__test__/admin-entries-table.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-C5 selects rows through the row checks and the select-all of the toolbar | 겹침 | `list-menus.dom.test.tsx`:316 "LIST-C5 picks every row of the page with the select-all…", 344·374(행 체크로 골라 막대가 뜬다) · 같은 `select`/`selectAll`이 틀리면 316(전체 선택과 풀기)과 344·374(행 체크)가 실패한다. 이 테스트는 그 둘을 콜백으로만 본다 |
| LIST-S3 opens record collections in their form instead of the editor | 겹침 | `entry-list-screen.dom.test.tsx`:338 (항목 이름을 누르면 패널이 그 항목으로 열린다) · 항목 행을 눌러도 폼이 열리지 않는 결함을 338이 화면 층에서 잡는다. ID도 틀렸다(WRITE-W6의 약속이다). "활성"이 없다는 것은 모양이다 |
| LIST-F6 shows child folders in explorer mode and navigates up | 겹침 | `list-folders-flow.dom.test.tsx`:237 "opens a folder from its row", 227 "goes up one folder…" · 같은 콜백을 화면 전체에서 누르고 주소의 `folder=`까지 본다 |

### `admin/src/screens/__test__/admin-list-rows.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 has its check and its ⋯ in the row, named for the entry | 겹침 | `list-menus.dom.test.tsx`:344·374(체크를 `t("list.rowSelect")`로 찾는다), `admin-entries-table`:72(⋯를 이름으로 찾는다) · 이름이 틀리면 그 테스트들이 요소를 찾지 못해 실패한다 |

### `admin/src/screens/__test__/admin-sidebar.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| opens under the open collection, with the folders on the open path | 겹침 | `rail-folders.test.ts`:26, 30 · 어느 폴더가 펼쳐지는지는 L1 `railFolders`가 본다. 나무가 그려지고 눌리는지는 150이 본다 |

### `admin/src/screens/__test__/list-menus.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| has no 'ask the assistant' action yet | 겹침 | `entries/__test__/bulk-bar.dom.test.tsx`:174 "…has no request to the assistant yet" · 같은 막대 부품에 같은 단추가 없는 것을 본다. #278이 들어오면 둘 다 바뀐다 |
| TRASH-T3 moves the picked draft rows to the trash from the menu at once, and the list is requested again | 겹침 | `bulk-bar.dom.test.tsx`:214 "…moves drafts at once" + `safe-delete.dom.test.tsx`:235 · 214가 막대의 `trash()`가 초안을 묻지 않는 것을, 235가 화면이 그 길로 요청을 보내는 것을 본다. 다시 읽기는 `entry-list-screen`:191이 본다 |

### `admin/src/screens/__test__/record-panel.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a new item is saved with just a name, passes the created item on, and does not close the slot | 겹침 | `any-site-screens.dom.test.tsx`:177 · 같은 POST 본문과 `onSaved`를 본다(그쪽은 두 사이트 설정에서). 닫지 않는 것은 확신이 낮다(아래) |

### `admin/src/screens/__test__/use-entry-mutations.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| sends every row for an action that is not a lifecycle change | 세부 | 내부 훅. 거르기가 관계 바꾸기에도 걸리면 `list-menus`:374의 `items` 2개가 0개가 되어 실패한다 |

### `admin/src/screens/entries/__test__/entry-editor-store.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| opens an entry: ready, with its form, version and a saved status | 겹침 | 같은 파일 184 "WRITE-S1 sends a PATCH with the expected version and the form's metadata…" · 불러온 폼과 버전이 틀리면 184의 `expectedVersion: 4`, `categoryId`, `summary`가 틀린다. 처음 상태가 저장됨인지는 239(WRITE-S3)가 본다(확신 낮음) |
| getSnapshot is current without waiting for a render | 세부 | 표의 "React 배관"이지만 남긴다. 번역 만들기와 상태 바꾸기의 저장 안 됨 검사가 `getSnapshot()`을 동기로 읽는다(WRITE-S6). shell 테스트는 그사이 렌더가 있어 이것을 못 잡는다 |
| the view of one state is one object, so selectors stay stable between changes | 세부 | 선택자 안정성. 표의 "React 배관" 결정대로 남긴다 |

### `admin/src/screens/entries/__test__/entry-form-removed.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| sends the value of a removed field back as stored; it is not a form field | 겹침 | `entry-editor-store.test.ts` 345 "WRITE-S8 sends a removed field's value back as stored (orphaned metadata round trip)" · 둘 다 지운 필드의 키 둘을 가진 글에서 제목만 고쳐 같은 메타데이터가 나가는지 본다. `metadataFromForm`이 키를 버리는 결함을 둘 다 잡는다 |
| adds nothing for a key the entry never had | 겹침 | `entry-form.test.ts` 53 "the original also handles shared values" · 53도 빈 필드가 많은 폼에서 메타데이터를 `toEqual`로 정확히 비교하므로 빈 키가 더해지면 실패한다 |

### `admin/src/screens/entries/__test__/entry-form.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a state with an invalid document is treated as unconfirmed | 겹침 | 같은 파일 130 "with no valid state, nothing is treated as confirmed" · 둘 다 `parseTranslationState`가 거부한 값을 `?? UNCONFIRMED`로 바꾸는 같은 줄을 지난다. 문서가 틀린 경우는 core가 본다 |

### `admin/src/screens/entries/__test__/post-relation-inputs.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| shows the picked post's title | 겹침 | 같은 파일 123 "keeps the picked post visible when the search does not return it" · 123도 고른 글의 제목을 id로 찾아 입력에 보이는지 본다(첫 줄 `input.value`) |

### `admin/src/screens/entries/__test__/properties-flow.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| "다시" fills again, and saving ends the assistant's mark | 겹침 | `use-field.dom.test.tsx` 391 "the assistant's mark ends when the entry is saved…" + `slots.dom.test.tsx` "says fill while the target is empty and again once it has a value; both are the same press" · 저장하면 표시가 끝나는 것은 391… |

### `admin/src/screens/entries/__test__/property-fields.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a change reaches the owner as a patch of that field only | 겹침 | `custom-field-input.dom.test.tsx` 22 "PLUG-A2 an input registered…" + `use-field.dom.test.tsx` 272 "PLUG-A6 a change patches the field only…" · 속성 패널의 입력은 모두 `field.setValue`(property-fields.tsx 292줄)로 바꾼다. 22가 그 길로 한 필… |

### `admin/src/screens/entries/__test__/use-entry-editor.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a component that selects one value re-renders only when it changes, while the form is typed in | 세부 | 렌더 수. 표의 "React 배관" 결정대로 남긴다 |

### `admin/src/screens/entries/__test__/use-field-any-site.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| gives the value, a patch-only change, the error and the ids of the title field | 겹침 | `use-field.dom.test.tsx` 88 "PLUG-A6 returns the value…" + `use-field.blog.test.ts` 98 + `use-field.dom.test.tsx` 356 · 값과 정의와 패치는 88이, 오류는 98이, `aria-invalid`·`aria-describedby`는 356이 같은 제목 필드로 본다 |
| typing in one field does not re-render another field's component | 겹침 | `use-field.dom.test.tsx` 217 "typing in one field does not re-render the component of another field" · 같은 memo 탐침, 같은 렌더 수 검사 |

### `admin/src/screens/entries/__test__/use-field.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| an issue on the field's path becomes its error, with ids that link the input to it | 겹침 | `use-field.blog.test.ts` 98 + 같은 파일 356 · 오류를 고르는 판단은 98이, 입력과 오류의 이어짐(`aria-describedby`, alert의 id)은 356이 본다 |
| a disabled form makes every field read-only and ignores changes | 겹침 | `use-entry-editor.dom.test.tsx` 193 "TRASH-T7 a trashed entry is read-only in the field" + `use-field-any-site.dom.test.tsx` 50 · `inputProps.disabled`는 193이, 바꾸기를 무시하는 것은 any-site 50이 본다 |
| typing in one field does not re-render the component of another field | 세부 | 렌더 수. "React 배관"과 같은 몫이라 남긴다(긴 폼의 입력 속도) |
| shows no suggestion button for a field no source attached an action to | 겹침 | 같은 파일 156(슬롯 요청의 `target`) + `slots.dom.test.tsx` "renders nothing when no action is attached…" · 이 테스트의 빈 결과는 테스트가 만든 source가 `target`으로 거른 것이다. 요청의 target은 156이, 빈 결과에 단추가 없는 것은 slots가 본다 |

### `admin/src/screens/entries/__test__/write-and-publish-flow.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| WRITE-P1 sends nothing to publish while a refusal is the answer, and the entry stays a draft | 겹침 | 같은 파일 186 + `entry-editor-store.test.ts` 657 "WRITE-P1 a refusal with issues is a validation error…" · 같은 거부를 같은 단추로 받는다. 이것만의 몫은 상태 글자가 "초안"으로 남는 것인데, store는 성공할 때만 글을 바꾼다(확신 낮음) |

### `admin/src/screens/media/__test__/media-flows.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| MEDIA-U3 shrinks to WebP by default: there is no switch for it, and the picture goes through the converter without an option | 세부 | 가짜 `prepareUpload`에 넘긴 인자 수를 본다. 기본으로 WebP로 줄이는 것은 `upload-helper`의 L1(`upload-helper.test`:62 근처)이 볼 몫이다 · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |
| MEDIA-U1 keeps a format the site does not take as a tile that says so, with the remove button and nothing sent | 겹침 | `media-upload.test.ts`:32(받지 않는 형식), :60(알려진 문제는 처음부터 실패이고 보내지 않는다) + 181(실패 타일과 빼기) — 판단은 L1이, 타일과 빼기는 181이 본다 · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |

### `admin/src/screens/schema/__test__/collections-edit-flows.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| SCHEMA-F10 when the file is saved but the database does not take it, the sheet closes and the screen is told what the server said | 겹침 | 573 "SCHEMA-F10 when the database does not take the saved file, the page says so with a way to reload" — 573이 같은 실패에서 시트가 닫히고 서버의 말이 페이지에 나오는 것까지 본다. `onApplyFailed`가 불리지 않으면 573도 실패한다 · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |

### `admin/src/screens/schema/__test__/locale-names.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| names a language in itself and in the admin language, from the code | 겹침 | 같은 파일 18 "makes a row from a code…" · 18이 같은 `ja`의 두 이름과 모르는 코드를 `localeName`을 거쳐 본다 |

### `admin/src/screens/shared/__test__/status-bar.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| saves from the cell while there are unsaved changes | 겹침 | `entries/__test__/entry-editor-shell.dom.test.tsx`:275 "WRITE-S1 shows the save state in the status bar and saves from it…" · 편집기에서 칸을 눌러 PATCH가 가는 것까지 본다 |
| says nothing is left to do, and the list then holds only the check rows | 겹침 | `write-and-publish-flow.dom.test.tsx`:214 "WRITE-P1 lists the to-dos fixed along the way as check rows…" · 할 일이 없으면 체크 줄만 있고 단추는 없다는 것을 편집기에서 본다 |
| can be opened from outside, as a refused publish does | 겹침 | `write-and-publish-flow.dom.test.tsx`:186 · 막힌 발행이 목록을 여는 것을 편집기에서 본다 |
| draws the plugin's cell after the to-do cell, and its rows, settings and fix all open from it | 겹침 | `entries/__test__/entry-editor-shell.dom.test.tsx`:423 "PLUG-A4 fills the slot in the source editor, after the to-do cell" · 칸 안의 목록(고치기, 설정, 모두 고치기)은 ui 부품 `StatusBarPluginCell`의 일이다 |

### `admin/src/slots/__test__/use-slot-actions.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lists the attached actions without `run`, and nothing when no source matches | 겹침 | 같은 폴더 `slots.dom.test.tsx` 46줄 · 동작이 없을 때 아무것도 없는 것은 46줄이 화면에서 본다. `run`을 빼는지는 반환 모양(세부)이다 |
| a failure lands in the state with the notice's words | 겹침 | `slots.dom.test.tsx` "PLUG-A3 a failed run leaves one error line and writes nothing" + `hooks/__test__/result.test.ts` 51줄 · 실패가 상태에 남는 것은 앞의 것, 고치는 법을 잇는 것은 `toEditorError`라 뒤의 것이 잡는다 |
| `disabled` follows the option | 겹침 | `slots.dom.test.tsx` 114줄과 "PLUG-A3 one press runs…" · 늘 꺼지면 누르는 PLUG-A3 테스트가, 켜지지 않으면 114줄이 실패한다 |
| commands keep their identity across renders, so they are safe in effects | 세부 | 지울 후보 · 함수의 정체성은 어떻게다. 사용자가 보는 결함은 효과가 끝없이 도는 플러그인뿐이다 |

## #385 ui 판정

### `ui/src/__test__/layout-options.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is the place of the screen-reader-only inputs inside it, and still lets `sticky` and `place` win | 작음 | 클래스 이름만 본다. 결함(숨은 입력이 쪽을 창보다 넓힌다)은 시각 감사의 옆 스크롤 검사가 본다 |

### `ui/src/__test__/resize-handle.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| goes back to the default on double-click and forgets the remembered width | 작음 | 너비를 되돌리고 잊는 것은 관리자 틀과 기억하는 값으로 ⚪다 |
| remembers the width per key | 작음 | 기억하는 값(막힌 저장소와 잘못된 값 말고)은 ⚪다 |
| does not remember a width that is only being dragged | 작음 | ⚪인 기억하는 값의 세부이고, 포인터를 지어낸다 |

## #388 core 판정

### `admin/src/screens/__test__/admin-list-rows.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 says the languages as a code and how many others there are | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/__test__/any-site-screens.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 shows the collection's rows under its configured list columns | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/__test__/entry-list-screen.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S1 with no page size or sort in the address, requests with the saved settings | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/__test__/list-cells.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 labels field columns by the field label | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 draws the select option label, the stored text, the media id and relation names | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/__test__/list-column-menu.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S1 sorts only the title, the address and the three dates, texts as letters and dates as dates | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 hides every column but the title | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 are the hidden ones in the saved order, and never the title | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/__test__/list-columns.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 finds the slug column by field kind, not by name | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 offers every other stored field as a column, hidden until the writer shows it | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 has no slug column without a slug field, and always has a title column | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 until the writer chooses columns the default ones are used: documents get status, title, taxonomy fields, locale and the updated date; items get status, title, locale, updated date and keep the slug beside the t… | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 has a locale column on a site with several locales | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 has no locale column on a single-locale site, and the other columns stay in order | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 has no locale column on a multi-locale site that turns the translation UI off | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 has no locale column on an item collection without a per-locale field | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/__test__/list-menus.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S1 picks 'ascending' on the title, which applies it, closes the menu and is saved for the collection | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 lists only the hidden columns under +, and picking one shows it and saves it | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S2 picks 50 per page from the footer, which applies it, closes the menu and is saved | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S2 goes to a page by its button and to the next one by 'next' | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/__test__/list-row-dates.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 is month and day within this year | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 carries the year before this one | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 is a dash where there is no date | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/entries/__test__/bulk-bar.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-C4 adds a mixed tag to all the rows without asking, and the menu stays open with it ticked | 겹침 | `list-menus.dom.test.tsx`의 "LIST-C4 adds a tag some picked rows hold to all of them from 바꾸기…"가 같은 `RelationChoice` 길을 지난다. 그쪽은 실제 요청 본문과 캐시 갱신까지 본다. 확인이 생기면 저쪽도 보낸 요청이 0이 되어 실패한다. 확신은 중간이다 |

### `admin/src/screens/entries/__test__/title-role-form.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 is one list column, `title`, whatever the title field is named | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `admin/src/screens/entries/__test__/use-field.dom.test.tsx`

| 테스트 | 판정 | 이유 |
|---|---|---|
| PLUG-A6 a change patches the field only, so values of removed fields stay in the form | 겹침 | 첫 테스트의 `expect(setForm).toHaveBeenCalledWith({ title: "Changed" })`가 이미 다른 키를 보내는 결함에서 실패한다. 이 테스트는 그 위에 테스트가 만든 주인(병합)을 더할 뿐이다. 확신은 중간이다 |

### `core/src/__test__/errors-say-how-to-fix.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| leaves out Where when there is none, and does not double a full stop | 작음 | 마침표 둘(모양) |

### `core/src/adapters/postgres/__test__/block-ids.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| saving the same document again keeps every id and writes nothing | 겹침 | `core/store/__test__/contract/entries.contract.ts:1989` TRANS-B1 "saving the same body again, with or without its ids, keeps the occurrences and the version"(Postgres에서도 돈다) · 같은 문서, id 없는 문서, 읽은 그대로의 문서를 저장해 버전이 그대로인지를… |
| saving the same content without its ids keeps every id and writes nothing | 겹침 | 위와 같은 계약 1989 · id 없는 저장이 바뀜이 아님을 계약이 본다. 두 깊이의 블록(목록)은 L1 WRITE-S3(`core/__test__/body-check.test.ts`, 해시가 id를 보지 않음)이 본다 |
| a document sent back as it was read changes nothing | 겹침 | 계약 1989, `http/v1/__test__/entries-doc.int.test.ts:287` WRITE-S3 · 읽은 문서를 그대로 보내는 저장을 둘 다 본다 |

### `core/src/adapters/postgres/__test__/changed-by.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a new entry has a change time and no author | 작음 | `changedBy`는 관리자 화면 어디에도 나오지 않는다(관리자는 한 명). 새 글의 시각은 충돌 알림에 나오지 않는다 |
| the next admin who saves replaces the name, and a write with no actor clears it instead of keeping a stale name | 작음 | `changedBy`만 본다. 화면에 안 나오는 값이다 |
| an identical save does not count as a change | 작음 | 같은 내용 저장의 버전은 WRITE-S3 계약이 본다. 남는 것은 `changedBy`뿐 |
| records who published, archived, unarchived and trashed it | 작음 | `changedBy`만 본다 |
| keeps the actor of each request apart when requests overlap | 작음 | `AsyncLocalStorage`의 격리는 Node가 지킨다. 활동 기록의 actor는 `events.int` 575가 본다 |

### `core/src/adapters/postgres/__test__/connection.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| names the fix | 작음 | 상수 문자열이 글자를 담는지만 본다 |

### `core/src/adapters/postgres/__test__/content-store.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| stores the new search text without a version bump or a new updatedAt | 작음 | 해시를 손으로 같게 준 인위적인 경우다. 실제로는 해시가 같으면 보이는 글자도 같아 찾기 글이 달라질 수 없다 |

### `core/src/adapters/postgres/__test__/decisions.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| reports a URL given in the config | 작음 | doctor의 출처 글자. 실제 연결의 우선순위는 `env-conventions` 54가 본다 |
| says when there is no URL | 작음 | 빠진 변수는 `env-conventions` 70이 실제 오류로 본다 |
| reports the schema from the option, the environment or the default | 작음 | 실제 스키마 결정은 `env-conventions` 37·47·54가 본다 |

### `core/src/adapters/postgres/__test__/explain.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps an error that already explains itself | 작음 | 두 번 감싸도 문장은 개발자만 본다 |

### `core/src/adapters/postgres/__test__/folders-disabled.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| rejects changing, deleting and reading the contents of a folder in a collection without folders | 작음 | 폴더를 끈 컬렉션에는 폴더 화면이 없어 남은 폴더를 고칠 길이 없다 |

### `core/src/adapters/postgres/__test__/kysely.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| puts the runtime schema on every table, so a query names only the table | 세부 | SQL 글자. 틀리면 모든 L2 저장소 테스트가 실패한다 |
| reads and writes the store's own schema through the pool | 세부 | 모든 L2 저장소 테스트가 같은 길을 쓴다 |
| lends connections and gives them back: many more queries than connections still finish | 세부 | · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |
| does not own the pool: destroying the instance leaves the pool usable | 세부 | 배관의 소유 관계 |
| runs on the very connection of the transaction | 세부 | 같은 결함을 127, 그리고 발행·스키마 변경의 되돌림 테스트가 잡는다 |
| sees what plain SQL wrote in the same transaction, and the other way around, before any commit | 세부 | · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |
| rolls back what Kysely and plain SQL wrote together when the transaction fails | 세부 | `pg/content-store.int` 65 (WRITE-P6) · 동작으로는 발행·스키마 변경·복원의 되돌림 테스트가 잡는다 |
| rolls back when it is a Kysely statement that fails (a duplicate key), including what plain SQL wrote before it | 세부 | 127과 같다 · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |
| locks rows with FOR UPDATE through Kysely, so a second transaction waits for the first | 세부 | `pg/folders.int` 54, `pg/migrations.int` 84 · 잠금의 동작은 동시성 테스트가 잡는다 |
| does not release the client: it is still the owner's after Kysely used it | 세부 | 배관 |
| reads the same titles as the SQL text, across collections and for one | 세부 | `pg/title-role.int` 100, 134 · 제목 식이 결과로 맞는지는 title-role이 본다 |
| reads the name in a display language, falling back to the title | 세부 | `pg/title-role.int` 178 · 같다 |

### `core/src/adapters/postgres/__test__/list-entries.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S1 5. all sort fields/directions, NULLS LAST both dirs, deterministic id tie-break; malicious sort rejects invalid_input | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01). 정렬 값의 거부는 API-G5가 본다 |
| LIST-S3 7. List authority: working metadata is authoritative for the single relation and the ordered many relation; publishedAt is the column | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S1 8. publishedAt sort and range use the published_at column; entries without it come last | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `core/src/adapters/postgres/__test__/migrations.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| creates no MDX text columns, and a normal write stores the document only | 겹침 | CI의 `pnpm gen:db-types --check`(없던 열이 생기면 실패, 전에는 `pg/database-types.int` 171), `pg/stored-document.int` 130(문서만 저장), `pg/templates.int` 37(템플릿 문서) · 셋이 같은 결함을 나눠 잡는다 |
| seeds the initial body templates once, and does not revive a deleted one | 겹침 | `pg/templates.int` 37 · 둘 다 지운 뒤 다시 마이그레이션해 되살아나지 않는지 본다. 37은 내용까지 본다 |

### `core/src/adapters/postgres/__test__/references.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| explicit DB FK contract: entry_references has a foreign key to entries covering target_entry_id | 세부 | 79, 143 · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |

### `core/src/adapters/postgres/__test__/sql.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| contains pattern adds % on both sides | 겹침 | `core/store/__test__/contract/list.contract.ts:467` LIST-F1 "2. Korean case-insensitive substring…" · 이 함수를 쓰는 찾기 테스트가 모두 잡는다 |
| prefix pattern adds % only at the end | 겹침 | `list.contract.ts:836` LIST-F7, 미디어 종류 거르기의 MEDIA-B2 계약 · 앞이 같은 것 순서와 `image/` 거르기가 이 함수를 쓴다 |

### `core/src/adapters/postgres/__test__/stored-document.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| saving the same content without its ids changes nothing | 겹침 | `entries.contract.ts:1989` TRANS-B1 · `pg/block-ids` 113과 같은 결함, 계약이 잡는다 |
| the public read returns the stored document, and a list returns it only with the body | 겹침 | `read/__test__/read-document.int.test.ts:200` SITE-R5 "a list reads the document only with the body…" · 목록 부분은 그대로 같다. 한 글 조회 부분은 read-document의 SITE-R1·SITE-R5 테스트가 본다 |

### `core/src/adapters/postgres/__test__/template-paths.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a fresh install seeds doc-only templates after the steps, and running everything again changes nothing | 겹침 | `pg/templates.int` 37(시드 내용), 66(다시 시드해도 하나), `pg/migrations.int` 93(다시 돌려도 단계 0) · 셋이 나눠 잡는다 |

### `core/src/adapters/postgres/__test__/title-role.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| answers the title field as the title of the site's collections | 겹침 | `schema/__test__/title-field.test.ts:19` SCHEMA-S2 "is the field with the title role, whatever its name" · L1 판단을 int 파일에서 다시 본다 |

### `core/src/adapters/postgres/__test__/title-sql.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| reads the title field of the collection, found by role | 세부 | `pg/title-role.int` 100 · SQL 글자. 결과는 title-role이 본다 |
| writes a key as an escaped string literal, never as a parameter or as SQL | 작음 | `defineSite`가 그런 키를 거부해서 생길 수 없는 상태를 막는 방어다(지우는 기준 3번). 설정 작성자만 키를 쓴다 |
| reads the name of a display language of a record collection, falling back to the title, and binds the language | 세부 | `pg/title-role.int` 178 · 결과로 본다 |

### `core/src/adapters/postgres/__test__/translations.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| gives the same result when migrated again (columns and primary key) | 겹침 | `pg/migrations.int` 93 · 다시 돌리면 단계가 0이라 기본 키가 바뀔 수 없다 |
| TRASH-R2 brings back a translation trashed with its source when the source is restored | 겹침 | `core/store/__test__/contract/translations.contract.ts:270` TRASH-R2 "trashing the source trashes its translations too, and restoring brings back only…" · 계약이 Postgres에서 같은 복원을 본다 |

### `core/src/adapters/postgres/__test__/trash.blog.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| TRASH-D6 deletes a source with a translation that was trashed on its own | 겹침 | `trash.delete`의 글 분기는 `removeEntryGroup`을 부르는데, 위 테스트와 같은 길이다. 위 테스트의 번역도 따로 버린 것이다. `deleted` 사건은 `translations.int`의 EVENT-D4 테스트가 본다. 확신은 중간이다 |
| TRASH-R1 goes to the trash while an entry uses it, and restoring it publishes it again | 겹침 | 휴지통 서비스의 `restoreOne`은 `content.restore`를 부르는데, 위 contract 테스트(`restoreDraft` = `content.restore`)와 같은 길이다. 앞쪽 절반(쓰이는 태그를 버리기)은 TRASH-T9의 몫이고 `lifecycle.contract.ts`의 "TRASH-T9 trashes a tag still used by published entr… |

### `core/src/annotation/code-block/__test__/code-string-comment-syntax.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| parses annotation lines in postcss /* */ comments | 겹침 | comment-syntax-by-language.test.ts 74(css) · postcss는 css와 같은 문법 항목이다. 74의 css 그룹이 같은 해석을 본다. 별칭이 빠지는 것은 별칭 표의 일(작음) |
| keeps the /* */ postfix on annotation lines when serializing postcss | 겹침 | comment-syntax-by-language.test.ts 74(css) · 74가 css의 ` */`를 포함한 글자를 그대로 비교한다 |

### `core/src/annotation/code-block/__test__/code-string-converter.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| when converting a document to a code fence, preserves tag and order sequence | 겹침 | 102 + 208 · 거의 같은 입력을 102가 읽고 208이 읽고 다시 써 같은 글자인지 보므로 쓰는 쪽의 결함을 함께 잡는다 |
| code -> document parses a boolean shorthand attribute as true | 겹침 | comment-syntax-by-language.test.ts 74 · 74가 9개 언어에서 `dense`(키만 쓴 속성)를 `true`로 읽는지 본다. 같은 속성 해석을 지난다 |

### `core/src/annotation/code-block/__test__/comment-syntax-by-language.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| parses its own syntax | 겹침 | 같은 파일 74 · 74의 코드 줄 비교(`["\tbody","\tother"]`)가 자기 문법을 읽지 못하는 결함을 잡는다 |
| writes its own syntax | 겹침 | 같은 파일 74 · 74가 `write(document).value`를 입력 글자와 그대로 비교한다 |
| round-trips parse, write, parse to an identical document | 겹침 | 같은 파일 74 · 74의 마지막 검사가 같은 왕복을 속성까지 붙여 본다 |
| gives block comment languages their postfix | 겹침 | 같은 파일 74(css, html) · css·html 그룹의 쓴 글자에 ` */`, ` -->`가 들어 있다. md는 별칭(작음) |
| writes an alias with the syntax of its language | 작음 | 별칭의 쓰는 문법(세부) |
| does not read a `%%` line in a `%` language or a `%` line in a `%%` language | 작음 | latex·mermaid 접두어의 앞부분 맞춤 같은 드문 경우(세부) |
| still reads each language's own syntax | 겹침 | 같은 파일 74(latex, mermaid) · GROUPS에 latex와 mermaid가 있다 |

### `core/src/annotation/code-block/__test__/libs.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| throws an error when annotationConfig is missing | 작음 | 주석 설정은 늘 core가 만든다(`createAnnotationConfig`). 생길 수 없는 상태의 방어 |
| throws an error for a duplicate or invalid name | 작음 | 이름은 core 상수와, `checkCodeBlockConfig`가 이미 거른 사이트 줄 효과에서만 온다. 두 번째 방어 |

### `core/src/annotation/code-block/__test__/line-effects.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the default definitions produce the same names and classes as the old annotation config | 작음 | 공개 화면의 클래스와 메뉴 라벨은 모양(시각 회귀의 몫)이다. 이름이 바뀌는 문제는 "확신이 낮은 판정" |
| the editor recognizes only defined line effects plus folding and the label | 작음 | 아는 효과를 모른다고 하는 쪽은 admin `code-block.dom.test.tsx` 166(FMT-R2)이 잡고, 남는 쪽(모르는 이름을 안다고 하기)은 보이는 일이 거의 없다 |

### `core/src/annotation/code-block/__test__/regex-annotation-comment-syntax.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| does not create an annotation when the regex does not match | 작음 | 22가 이미 맞지 않는 다음 줄(`nextLine`)에 주석이 없음을 본다 |

### `core/src/annotation/code-block/__test__/scope-comment-syntax.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| @line plus {0-1} is read as the closed range [0,1], so the internal range end is +1 | 겹침 | code-string-converter 102 · 102가 `diff {1-1}` → `{1,2}`, `Callout {0-1}` → `{0,2}`를 `toEqual`로 본다 |
| @line collapse ... @line collapse end is parsed as a line scope wrapper range | 겹침 | code-string-converter 385 · 385가 같은 render 종류의 시작·끝을 본다 |

### `core/src/api-keys/__test__/api-key-slots.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| shows the slot in the admin language it is read in | 작음 | 라벨의 언어. 틀려도 다른 언어의 라벨이 보일 뿐이다 |
| has no slot, and no use, when the plugin is not installed | 작음 | 지운 플러그인의 칸이 쓰임으로 남는 드문 경우. force로 지울 수 있다 |

### `core/src/api-keys/__test__/api-keys.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| reuses a key that has the same value, and names a new one when there is none | 작음 | `findOrAdd`를 부르는 코드가 저장소에 없다. 질문 8 |
| deletes a key nothing uses without asking | 겹침 | 같은 파일 71 + 191 · 쓰지 않는 키를 force 없이 지우는 저장소 쪽은 71이, 라우트의 force 기본값과 204는 191이 잡는다 |

### `core/src/cli/__test__/admin-password.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| AUTH-L11 reset-password exits with 130 when the person cancels, like init | 겹침 | `exit.test.ts`의 "CLI-E1 a cancelled question ends with 130, any other error with 1"이 130으로 바꾸는 곳을 잡는다. 이 테스트만 잡는 것은 `adminResetPassword`가 `Cancelled`를 삼키는 결함 하나다. CLI-E1의 "every command ends through it" 목록에는 `admin:rese… |

### `core/src/cli/__test__/db-commands.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| migrate says it is up to date when no step is pending | 작음 (질문 → 제안대로) | 문구. 이어짐은 cli-helpers 94와 db-commands 142가 본다 |
| migrate refuses a database created by an older pre-release, and says to recreate it | 겹침 (질문 → 제안대로) | `adapters/postgres/__test__/migrations.int.test.ts` "refuses a database built from the numbered steps of an older pre-release, and changes nothing", cli-helpers 109 · 거부와 "바꾸지 않음"은 저장소 테스트가, 오류가 명령 밖으로 나가는 것은 109가 본다. 이… |

### `core/src/cli/__test__/doctor.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| does not assume a dev port or an empty NODE_ENV when SITE_URL is not set | 작음 | 안내 문장의 자리표 |
| rejects a DATABASE_URL that is not a Postgres URL | 작음 | 그런 URL은 연결에서도 이유와 함께 실패한다 |
| does not count a comment that mentions withCms as the wrapper | 겹침 | init-edit-with-cms 17 · 같은 `usesWithCms`의 주석 경우 |
| warns about a root layout without suppressHydrationWarning, and is quiet once it has it | 작음 | 콘솔 경고뿐(⚪, 질문 7) |
| says uploads are off when the config has no storage | 작음 | ok 문장 |

### `core/src/cli/__test__/help.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| `monti %s --help` prints that command's options and no other command | 작음 | 다른 명령의 절이 함께 찍혀도 읽는 데 지장이 없다 |
| `monti init --help` names the flags that were added | 작음 | 도움말 문구. 도움말은 명령 표에서 만들어지므로 표에 없는 옛 플래그는 찍힐 수 없다 |
| every option the help lists is accepted by the command (no stale flag) | 작음 | 도움말과 파서가 같은 표에서 나온다. 요약 문장에 옛 플래그를 적는 경우만 남는다 |
| does not send the reader to another command for the shared options | 작음 | 문구 |

### `core/src/cli/__test__/import-boundary.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| holds for the blog example: no client component reaches monti.config.ts, and it does import the config from its server files | 세부 | `pnpm example:check`(CI의 ci.yml 94줄)가 예제 복사본에 `monti doctor --only config`를 돌린다 · 동작이 아니라 저장소의 예제가 규칙을 지키는지 본다 |

### `core/src/cli/__test__/init-command.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| says that the files go to src/ when the app uses src/app | 작음 | 요약의 한 문장 |
| --json reports an error as JSON with exit code 1 | 겹침 | exit 21, 33; init.int 819 · 오류는 runCli의 한 catch에서 JSON이 된다(21, 33). 잘못된 플래그가 아무것도 쓰지 않는 것은 819 |
| the flags of the removed behavior are refused | 겹침 | exit 33 · 파서는 모르는 옵션을 모두 거부한다. 없앤 플래그는 모르는 옵션이다 |
| --locale still sets the one default language | 작음 | 옛 이름의 플래그. 방향은 호환 장치를 두지 않는 것이다 |
| runCli routes init, and `init --help` shows every flag | 겹침 | help 55 · init은 명령 표에 있어 55가 모든 옵션을 본다 |

### `core/src/cli/__test__/init-detect.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| says where the folder would be made when there is none: src/app if only src/ exists | 작음 | 앱 폴더가 없으면 init은 App Router 앱이 아니라며 거부한다(init.int 637). 남는 쓰임은 doctor의 경로 문장뿐이다 |
| notices a .gitignore that does not cover .env.local | 작음 | `envLocalIgnored`는 아무 코드도 읽지 않는다(.gitignore 편집은 `gitignoreCoverage`를 쓴다). 필드와 함께 지울 후보 |

### `core/src/cli/__test__/init-locales.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| detectApp reports suffix languages of a content folder | 겹침 | 76이 같은 파일로 init을 돌려 스키마의 언어를 본다. 그 길은 detectApp을 거친다 |
| offers them in the question, and the person can change them | 작음 | 질문 문장과 알림 문구 |
| an app with one language keeps en | 겹침 | 24, init.int 49 · 접미사 없는 이름을 언어로 보지 않는 것(24)과 기본 en(49) |

### `core/src/cli/__test__/init-prompts.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the default is first, the others follow, and none is fine | 겹침 | 기본 언어가 앞에 오는 것은 93의 `locales: ["ko","en"]`이 잡는다. "다른 언어 없음"만 여기 있다 |
| offers the common languages by their own names, with the detected one preselected | 작음 | 보기의 이름과 미리 고른 값은 사람이 그 자리에서 보고 고른다 |
| the offered extras are AI only | 작음 | 보기 목록의 내용 |
| lists every block with a one-line description when picking | 작음 | 보기의 힌트 문구. 목록에서 빠져도 `--blocks`로 고를 수 있다 |
| choosing all blocks does not open the list | 작음 | 질문 흐름의 세세한 길 |
| the heavy blocks say why they are heavy in the list | 작음 | 힌트 문구(185와도 겹친다) |
| never asks for a GitHub id or a database schema | 작음 | 없앤 질문이 돌아와도 해가 없다 |
| a question whose flag is given is not asked | 겹침 | 같은 플래그 묶음(extras만 빠진)에서 `asked = [setup, extras]`를 271이 본다. 시간대 플래그는 306 |
| defaults to the directive syntax when blocks are installed, and to plain MDX when none is | 작음 | 질문에서 미리 고른 값. 결정 자체는 375가 본다 |
| cancelling at any question rejects | 겹침 | init.int 811, init-command 241 · 취소가 거부로 이어지는 것을 811(아무것도 쓰지 않음)과 241(130으로 끝남)이 더 넓게 본다 |

### `core/src/cli/__test__/init-recovery.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| leaves no progress file behind, on a failure or on a dry run | 작음 | 없앤 이어하기(`--resume`)의 흔적. 진행 파일을 쓰는 코드가 없다 |

### `core/src/cli/__test__/init-setup.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| does nothing without .env.example and without .env.local | 작음 | 드문 경우. 빈 파일을 만들어도 해가 없다 |
| keeps a secret that is set | 겹침 | 48, 92 · 함수의 경우는 48, initProject의 이어짐은 92 |
| does not list a database failure again when the database was skipped for want of a URL | 작음 | 남은 일에 같은 줄이 두 번 |
| runs without a terminal (--yes or no TTY) and records the steps | 겹침 | 92, 113, 154; init.int 298 · 터미널 없이 네 단계가 도는 것을 단계마다 본다 |
| asks the question once, with a default of yes, and shows each step as a progress line | 작음 | 질문의 기본값과 진행 줄의 모양 |
| a dry run changes nothing and plans the steps | 겹침 | init.int 780 · 780이 스냅숏으로 모든 파일을 본다. 이 테스트는 URL이 없어 `setupDatabase`가 어차피 불리지 않으므로 그 검사는 아무것도 막지 않는다 |
| with GitHub login the human steps are the OAuth app and the dev server, with the secret already made | 겹침 | init.int 160, 236 · OAuth 단계는 160, 기계 단계가 돈 뒤 openssl·cp가 없는 것은 236 |

### `core/src/cli/__test__/init-specs.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| installs bare names when core has a version range | 겹침 | 33, 42 · 범위의 판단은 33, 설치로 이어짐은 42 |
| records the same specs in a dry run | 작음 | dry run의 보고 한 줄 |
| when the install is left to the person, the list says why the libraries are there | 작음 | 설명 문구. peer가 명령에 들어가는 것은 111이 본다 |

### `core/src/cli/__test__/init.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| --directive-syntax turns it on even without blocks | 겹침 | init-prompts 375, init-command 34 · 판단(블록 없음 + 플래그)은 375, 설정으로 이어짐은 34 |
| lists the S3 variables in .env.example, each with where to get it, when storage is s3 | 작음 | 빠진 변수는 doctor의 저장소 검사(390)가 그 이름으로 알린다 |
| never writes a docker compose file, a proxy or theme files | 겹침 | 49, 109 · 49가 만든 파일 목록을 정확히, 109가 새 파일이 그 목록뿐인지 본다 |
| a failed install turns ok off, names the step and keeps the command in the list; the files stay | 겹침 | init-recovery 9, init-command 170 · 9가 ok, 실패한 단계, 남은 명령, 남은 파일을, 170이 실패의 이유가 찍히는 것을 본다 |
| an existing withCms and an existing suppressHydrationWarning are left alone and need no step | 겹침 | 두 번째 실행에서 두 파일이 "이미 있다"로 남고 남은 일이 없는 것을 483이 본다 |
| a broken computer time zone gives UTC and the summary says it could not be read | 겹침 | init-prompts 315, init.int 722 · 판단은 315, 스키마로 이어짐은 722 |
| an existing .env.example is kept and reported, never merged | 겹침 | `.env.example`도 같은 "있는 파일" 고리(`planProject`의 planned 고리)를 지난다 |
| shows added and removed lines with context | 작음 | `unifiedDiff`는 `internal/cli`에서 내보내기만 하고 아무 코드도 부르지 않는다. 함수와 함께 지울 후보(질문 8) |
| the fresh create-next-app config diff is the import and the export | 작음 | 같은 이유 |

### `core/src/cli/__test__/next-app.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is detected on the tag, also across several lines and with a className expression | 작음 | doctor의 hydration 경고만 이 함수를 쓴다. 빠지면 첫 화면의 콘솔 경고뿐이다(⚪, 질문 7) |
| says nothing about a layout without <html>, and counts a deliberate false as missing | 작음 | 같은 이유 |
| finds the root layout under app or src/app | 겹침 | init.int 393, 109 · `src/app`의 레이아웃을 고치는지(393)와 `app`의 레이아웃을 고치는지(109) |

### `core/src/cli/__test__/write-regular-file.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| writes a new file and overwrites a regular one, reporting no replaced link | 작음 (질문 → 제안대로) | 보통 파일 쓰기와 반환값(미리보기 스크립트의 알림 한 줄) |

### `core/src/cms/__test__/create-cms.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps no global state: nothing is left on the global object | 세부 | 전역 상태가 있으면 91이 섞임으로 잡는다 |
| keeps the media store across reloads too | 작음 | 미디어 저장소는 HTTP 클라이언트라 다시 만들어도 연결이 쌓이지 않는다 |

### `core/src/cms/__test__/decisions.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| reports no schema file for a config written in code | 작음 | 출처 글자 |
| reports a schema file given in the options as set in the config | 작음 | 출처 글자 |
| explains host trust from the environment passed in | 작음 | 호스트 신뢰 자체는 AUTH-L8(`auth.test.ts` 267~287, `adapters/auth/__test__/trust-host.test.ts`)이 본다. 남는 것은 출처 글자 |
| a detached instance (forSchema) reports the same decisions | 작음 | `forSchema` 인스턴스의 doctor 출력은 드물다 |
| is reported as not set when nothing says | 작음 | 출처 글자 |

### `core/src/cms/__test__/two-instances.blog.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the same holds for instances built by fakeCms over fake stores | 세부 | 테스트 도구(`fakeCms`)의 검사 |
| the locale prefix follows each site's rule | 겹침 | 인스턴스가 제 사이트를 쓰는지는 224가 잡는다. 접두어 규칙 자체는 사이트의 L1 테스트 몫이다 |
| applies the line effects of the site that renders | 작음 | 294와 같은 길(사이트에서 읽는 그리기 설정)의 다른 값 |
| keeps the config's types | 세부 | `tsc`의 몫. `*.test-d.ts`와 `expectTypeOf`(Vitest typecheck)로 옮긴다 · 돌지 않는 테스트다(본문이 함수를 만들기만 한다) |

### `core/src/config/__test__/define.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| rejects a definition without a kind | 겹침 | schema-file/__test__/format.test.ts 67 · 같은 `collectionShape.kind`. 67이 `delete kind` → `collections.post.kind`를 본다 |
| rejects the removed `required: "publish"`: only `true` exists | 겹침 | schema-file/__test__/format.test.ts 67 · 같은 필드 모양. 67이 문자열 `required` → `enum`을 본다 |
| keeps the steps in the order written, and the config works without them | 작음 | 본문 너비는 ⚪(제안대로, 2026-10-31) |
| accepts CSS lengths of every common shape | 작음 | 본문 너비 ⚪ |
| rejects empty or invalid widths, naming the step | 작음 | 본문 너비 ⚪. "확신이 낮은 판정" 참고 |
| rejects empty and repeated labels and an empty list | 작음 | 본문 너비 ⚪ |
| reaches the browser snapshot | 작음 | 본문 너비 ⚪ |
| rejects a default locale outside the list and duplicate locales | 겹침 | schema-file/__test__/define-schema.test.ts 136 · 136이 같은 `checkSite`를 파일로 지나 `defaultLocale`의 `unknown-locale`과 `locales[2].code`의 `duplicate`를 본다 |
| takes a text field of any name that has the role | 겹침 | schema-file/__test__/title-role.test.ts 20 · 20이 `headline`에 제목 역할을 준 설정을 `defineSite`로 만들고 그 필드를 제목으로 찾는다 |

### `core/src/core/__test__/admin-features.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| turns templates off only with admin.templates: false | 작음 | ⚪ · 기능을 끄는 관리자 옵션은 ⚪로 정했다 |
| hides the translation UI of a single-locale site without any option | 작음 | ⚪ · 언어가 하나면 번역할 다른 언어가 없고, TRANS-N1(다른 언어)이 서버에서 막는다 |
| keeps it hidden on a single-locale site even when admin.translations is true | 작음 | ⚪ · 22와 같다 |
| hides the translation UI of a multi-locale site with admin.translations: false | 겹침 | `translation.test.ts` "TRANS-N1 rejects every translation when the site turns translations off" · 그 테스트가 같은 옵션으로 사이트를 만들고 `ADMIN_TRANSLATIONS`가 false인지 먼저 본다 |
| is part of a site made from a config | 작음 | ⚪ · 설정에서 사이트로 이어지는 것은 translation.test의 TRANS-N1(옵션으로 만든 사이트)이 본다. 템플릿 쪽은 ⚪ |

### `core/src/core/__test__/allowed-body.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| reports nothing for a body without a list | 겹침 | 같은 파일 190줄 "does not limit a collection without a list" · 190은 `prepareSnapshot`을 거쳐 같은 `checkDocument(…, undefined)`의 결과를 본다 |
| gives the same warnings for a write that keeps what the draft holds | 작음 | 경고 목록이 이전 판에 따라 달라지는지일 뿐, 저장과 발행은 그대로다 |

### `core/src/core/__test__/collections.blog.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the default collection is the first declared document collection | 작음 | 주소에 컬렉션이 없을 때 여는 목록이다(관리자 틀, ⚪). `isDocumentCollection`의 판단은 `kind-and-required` 53이 본다 |

### `core/src/core/__test__/collections.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the default collection is the first declared document collection | 작음 | 주소에 컬렉션이 없을 때 여는 목록이다(관리자 틀, ⚪). `isDocumentCollection`의 판단은 `kind-and-required` 53이 본다 |

### `core/src/core/__test__/content-hash.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| emphasis written with asterisks or underscores | 겹침 | `doc/__test__/block-ids.test.ts` "TRANS-B1 do not change the content hash" (+ mdx `content-hash-spellings.test.ts` "FMT-R1 emphasis written with asterisks or underscores") · 테스트 읽기 도구가 두 표기를 같은 문서로 읽으므로 이 테스트가 보는 차이는 블록… |
| blocks that differ only by their ids | 겹침 | block-ids.test.ts "TRANS-B1 do not change the content hash" · 그 테스트는 중첩 블록까지 id가 모두 다른 두 문서의 해시가 같은지 본다. 이 테스트(바깥 블록 id만 다름)가 잡는 것을 모두 잡는다 |
| metadata keys in a different order | 겹침 | `services/__test__/content-service.test.ts` "WRITE-S3 computes the SHA-256 vector with key-order equivalence and metadata and MDX changes" · 그 테스트가 키 순서만 다른 메타데이터의 두 스냅숏이 같은 해시인지 본다 |
| is deterministic | 겹침 | content-service.test.ts "WRITE-S3 computes the SHA-256 vector…" · 그 테스트가 정확한 해시 값을 고정하므로 결정적이지 않은 해시는 거기서 실패한다 |
| keeps the value every stored entry has: the hash rule is a constant, so every hash stored so far stays | 겹침 | content-service.test.ts "WRITE-S3 computes the SHA-256 vector…" · 그 테스트는 기대 문서를 글자로 적어 더 강하다. 이 테스트는 기대값을 `canonicalBodyForHash`로 계산해 그 함수가 바뀌어도 통과한다 |
| is stable and distinct per raw string | 겹침 | 같은 파일 98 + mdx `content-hash-spellings.test.ts` "FMT-R1 an unclosed element is one body per raw string" · 98이 원문을 넣은 값을 고정하고, mdx 테스트가 같음과 다름을 본다. 남는 것은 `unparsedDocument`의 형식 인자를 해시하지 않는 것뿐이다 |
| leaves the block ids out and sorts the attribute keys at every depth | 세부 | 테스트만 쓰는 내부 함수 `canonicalBodyForHash`의 모양(JSON 글자 순서)을 본다. 동작은 32, 38(block-ids)이 본다. 지운다 |
| keeps the code and its language | 세부 | 내부 함수의 모양이다. 다만 "코드 블록의 언어만 바꾼 저장이 쓰이지 않는" 결함은 다른 테스트가 없다. `computeContentHash`로 "언어가 다르면 해시가 다르다"로 고쳐 쓰고 WRITE-S3을 단다 |
| does not change the document it receives | 세부 | 내부 함수를 본다. 해시 계산이 저장할 문서의 id를 지우는 결함은 TRANS-B1의 L2 테스트(`entries.contract.ts`)가 잡는다. 지우거나 `computeContentHash`로 고쳐 쓴다 |

### `core/src/core/__test__/error-brand.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps subclasses apart: a CmsError is not a ServiceError, a ServiceError is a CmsError | 작음 | `instanceof ServiceError`로 길을 가르는 곳이 사용자에게 보이는 동작을 바꾸지 않는다 |

### `core/src/core/__test__/error-notices.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| only has a `.fix` key for a key that says what went wrong | 작음 | 짝 없는 `.fix`는 보이지 않는 글자다. `auditMessages`의 "참조 없는 키"가 잡을 일이다 |
| fills the values a notice carries, in both languages | 겹침 | `http/v1/__test__/error-handler.test.ts` "reads a notice from the core dictionary in the admin language, with its values" (+ 42) · 같은 키와 값으로 `noticeText`의 what·fix를 본다. 두 언어의 자리표는 42가 본다 |
| tells which status change cannot be made | 작음 | 알림 키다. 규칙 자체는 `lifecycle.test.ts`가 본다. 키가 빠져도 코드의 문장(invalid_status)이 나온다 |
| tells that a trashed entry is restored first, and that records are not archived | 작음 | 78과 같다(규칙은 lifecycle, publish 테스트) |
| tells why a folder cannot move | 작음 | 알림 키. 순환 거부는 `folders-metadata` 34와 L2 `folders.contract.ts`가 본다(L2는 키도 본다) |
| names the language that is not set up | 작음 | 알림 키와 값 |
| tells why an entry cannot be translated | 작음 | 알림 키. 거부 규칙은 `translation.test.ts`의 TRANS-N1이 본다 |
| tells when the site does not use translations | 작음 | 알림 키. 거부는 translation.test의 TRANS-N1이 본다 |
| lists the fields that belong to the original entry | 작음 | 알림 키. 거부는 translation.test "TRANS-N3 rejects a translation that carries a field shared with the source, naming it"가 본다 |
| names the reason the server gives | 작음 | 읽기 전용의 이유 키. 쓰기 거부는 L2 `schema-edit.int.test.ts`의 SCHEMA-F11이 본다 |

### `core/src/core/__test__/file-display.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| writes the number, a space and the unit, with one decimal only under 10 MB | 작음 | 파일 크기의 글자 모양이다(⚪) |

### `core/src/core/__test__/footnote-validation.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| raises nothing for matching references and definitions | 겹침 | 같은 파일 51 + 99 · 51(맞는 짝이 있는 글에 경고 1개)과 99(짝에 경고 없음)가 거짓 경고를 잡는다. 남는 것은 같은 참조를 두 번 쓴 경우뿐이다 |
| warns about duplicate definition labels once per extra definition | 작음 | 🟡의 대표 약속이 아닌 드문 경우(같은 라벨의 정의 둘) |
| reports each problem separately | 작음 | 문제가 여럿일 때 모두 알리는지. 🟡의 대표 약속이 아니다 |

### `core/src/core/__test__/issue-text.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| adds the target a detailed code's message names after the code's text | 작음 | 문장 뒤에 대상 이름을 붙이는 세부 문구 |
| tellIssues keeps every position the editor goes to | 작음 | 펼침 한 줄(`{ ...issue, ...issueText }`)이다. 깨질 여지가 거의 없다 |

### `core/src/core/__test__/kind-and-required.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| an empty value is an issue | 겹침 | `schema/__test__/derive-roles.test.ts` "SCHEMA-S3 uses missing_field with the field label for every field, title included" · 같은 `missingRequiredIssues`가 `null_slug`와 라벨을 단 `missing_field`를 내는지 본다. 채운 경우는 같은 파일의 "SCHEMA-… |

### `core/src/core/__test__/links.blog.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| appends the public path under the preview path and passes the locale when it is not the default | 겹침 | paths.test.ts 87 + links.test.ts 64, 73 · 87이 쿼리 꼴을 글자 그대로, 64·73이 사이트의 이어짐과 인코딩을 본다 |

### `core/src/core/__test__/paths.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| API paths must start with / | 작음 | 코드가 잘못 부를 때만 다른 개발자용 방어다 |

### `core/src/core/__test__/plain-text.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| still gives text for a body that does not parse | 작음 | 읽지 못한 본문에서 채우기는 드문 경우다(🟡의 대표 아님) |

### `core/src/core/__test__/removed-fields.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| rejects a new unknown key, as a typo, on create and on save | 겹침 | content-service.test.ts "WRITE-S7 rejects %s"의 "a key that is not in the schema and that the entry does not already hold" + 같은 파일 46 · 만들 때는 content-service가, 저장할 때(가진 키 옆의 새 키)는 46의 두 번째 검사가 같은 `invalid_metadata_key`를 … |
| keeps the value in the content hash: it is part of the stored metadata | 작음 | 지운 필드의 값은 화면에서 고칠 수 없어 해시에서 빠져도 사용자가 겪는 일이 없다 |
| raises no warning when nothing was removed | 작음 | 거짓 알림만 막는다. "지운 필드의 값 알림"은 ⚪ |
| is told apart from an option the select still has | 작음 | `unknownSelectValues`는 발행 경고에만 쓰인다. 거짓 경고는 ⚪ |

### `core/src/core/__test__/service-input.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| says what its issues say, not only its code | 작음 | 로그와 테스트 실패에 나오는 개발자만 보는 글자다 |

### `core/src/core/__test__/table-validation.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| warns about a span that is not a positive integer | 작음 | 문서를 직접 보내는 API 호출자만 만드는 드문 경우이고 경고뿐이다. 편집기는 이런 칸을 만들지 않는다 |
| warns about a rowspan past the last row and a span wider than the table may be | 작음 | 39와 같다 |
| names the table by its block id | 작음 | 39와 같다 |

### `core/src/core/__test__/time.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| rejects nonexistent dates and bad formats | 작음 | `parseDateTimeInput`은 어느 패키지의 소스도 쓰지 않는다(질문 참고) |
| round-trips in time zones with daylight saving time and rejects skipped times | 작음 | 대부분이 쓰이지 않는 `parseDateTimeInput`이다 |

### `core/src/core/domain/__test__/folders-metadata.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps JSON values and orders object keys, so equal metadata is equal however it was built | 작음 | 해시가 키를 따로 정렬하고 jsonb는 순서를 지키지 않아, 저장 전 정렬이 바뀌어도 사용자가 겪는 일이 없다 |

### `core/src/core/domain/__test__/lifecycle.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| canTransition agrees with assertTransitionAllowed for every action and status | 세부 | `assertTransitionAllowed`가 `canTransition`을 그대로 부르므로 늘 통과한다. 지운다 |
| a restore never takes a published entry offline: only a trashed entry can be restored | 겹침 | 같은 파일 45의 restore 테스트 · 45가 restore를 published에서 보내면 `invalid_status`인지 본다 |
| restoring a record needs its prepared draft | 작음 | 저장소가 늘 준비본을 넘긴다. 코드가 잘못 부를 때만 다른 방어 코드다 |

### `core/src/core/domain/__test__/plugin-storage.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| names plugins and collections as lowercase words that start with a letter | 작음 (질문 → 제안대로) | 서버 플러그인 API → 제안 🟡, 새 줄 PLUG-S1 · 이름 규칙의 경우들. 저장소 계약(`plugin/__test__/storage-contract.ts` "refuses names…")은 몇 경우만 본다 |
| names migration steps like collections, and also allows `_` | 작음 (질문 → 제안대로) | PLUG-S1 · 마이그레이션 단계 이름은 이 테스트만 본다 |
| a conflict carries the stored version, and a missing item is not_found | 작음 (질문 → 제안대로) | 제안대로면 세부 · 오류를 만드는 도우미의 모양이다. 충돌의 버전은 계약 "fails with a conflict that carries the stored version…"가 동작으로 본다 |

### `core/src/core/domain/__test__/references-equal.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| counts the block id as part of an occurrence when comparing references | 겹침 | publish.test.ts "WRITE-P1 compares two reference lists regardless of order and id case, occurrences included" · 그 테스트가 블록 id만 다른 두 참조가 다른지 본다. 남는 것은 블록 id가 없는 쪽과의 비교다 |

### `core/src/core/store/__test__/contract/list.contract.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| LIST-S3 resolves tag names in metadata order without changing tag IDs | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 lists the stored text of text and select fields as `values` (empty values are left out) | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| LIST-S3 9. record collections list the locales that have a name (the default locale is the record's own title) | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `core/src/http/__test__/plugin-routes.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a route identical to another plugin's is also an error | 겹침 | `plugin/__test__/collisions.test.ts` "rejects a route another plugin already has" · 같은 `assertPluginRoutesFree` 분기. 라우터가 그것을 부르는 것은 108이 본다 |
| works when there is no collision | 겹침 | 이 파일 70 "an admin reaches the plugin route" · 70도 충돌 없는 인스턴스에서 라우트에 닿는 것을 본다 |

### `core/src/http/__test__/router.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| the public API is an optional core feature (server config publicApi), and AI and schedule routes are added by plugins | 세부 | 라우트 표의 내용(무엇이 core에 있고 없는지)이라는 코드 규칙이다. 공개 경로가 이어지는 것은 `public-api.int.test.ts`가 `cms.handle`로 본다. "core가 AI 라우트를 갖지 않는다"는 lint(`biome.json`의 `noRestrictedImports`로 core가 `@monti-cms/ai`를 가져오지 못하게)나 knip으로 옮길 수 있다 |
| answers 404 on the template routes when admin.templates is false | 작음 | ⚪ 관리자 옵션으로 템플릿 끄기 · 옵션으로 화면을 숨기는 것은 ⚪로 정했다. API를 닫는 것도 같은 옵션의 일부 |
| serves the template routes when admin.templates is on | 작음 | ⚪ (위와 같음) · `enabled`가 늘 닫는 결함은 formats.int의 템플릿 테스트가 아니라(라우터를 거치지 않는다) 흐름 L4가 잡는다 |
| leaves other routes alone when templates are off | 작음 | ⚪ (위와 같음) |

### `core/src/http/v1/__test__/actor.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is not known outside a request | 작음 | `AsyncLocalStorage`의 기본값을 볼 뿐. 요청 밖 쓰기가 옛 작업자를 받는 결함은 잡지 못한다 |
| names an admin by name, else by account ID | 작음 | 공백만 있는 이름의 다듬기. 51, 57이 같은 함수를 지난다 |

### `core/src/http/v1/__test__/body-limit.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| keeps JSON errors at 400 | 작음 | 관리자는 깨진 JSON을 보내지 않는다. 틀리면 400이 500이 될 뿐 |
| parses a urlencoded form under the cap and refuses one over it | 겹침 | 이 파일 61, `first-admin.test.ts` "AUTH-L2 passes the email and password of the form to the login" · 한도 초과는 61이 실제 로그인 라우트로, 폼 읽기는 AUTH-L2가 본다 |
| keeps the global cap above the form cap | 작음 | 상수 둘의 비교. 사용자가 겪는 일이 없다 |

### `core/src/http/v1/__test__/duplicate.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| duplicates entry with 201 Created | 겹침 | 이 파일 66 · 66이 같은 길(서비스에 닿고 201로 돌아옴)을 관리자가 실제로 보내는 제목과 함께 본다 |
| rejects a non-string title with 400 | 작음 | zod 스키마의 형식 검사. 관리자는 문자열만 보낸다 |
| returns 404 when entry does not exist | 겹침 | `media-api.test.ts` "MEDIA-B4 answers 404 for a file that does not exist" · 라우트에 404 코드가 없고 `handleApiError`의 not_found → 404만 지난다 |
| rejects cross-origin requests with 403 | 겹침 | `entries.test.ts` 125 "rejects cross-origin mutations with 403" · 같은 `guardedAdmin`. `routeCaller`가 access를 주므로 이 라우트의 표 값은 보지 않는다 |

### `core/src/http/v1/__test__/entries.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| rejects an unknown collection, a limit that is too large and an id that is not an id | 작음 | 관리자 화면은 이런 값을 보내지 않는다. 틀려도 저장소가 거부하거나 50개 한도가 풀릴 뿐 |
| rejects a condition that is not one, and a translation state that is not one | 겹침 | `core/__test__/list-query.test.ts` "LIST-F2 refuses what is not a condition", "LIST-F2 refuses another word" · 같은 스키마의 같은 거부 |
| asks for the translation filter's counts with facet=translation | 겹침 | 이 파일 285 · 라우트가 `facet`을 버려도 기본값이 "translation"이라 통과한다. 285가 그 결함을 잡는다 |
| rejects asking for nothing or for both | 겹침 | `list-query.test.ts` "LIST-F3 asks for one field or for one facet, not both and not neither" · 같은 스키마 검사 |

### `core/src/http/v1/__test__/error-handler.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| does not log a request the browser dropped as an error | 작음 | 로그 소음. 사용자는 아무것도 겪지 않는다 |
| answers a route without the site with the developer words | 작음 | 공개·기계 라우트의 오류 글자. 개발자만 본다 |

### `core/src/http/v1/__test__/events.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| needs an admin | 겹침 | `entries.test.ts` 109 · 같은 `runAdminRoute`. 표의 access는 보지 않는다 |
| without a token, needs an admin session and a same-origin request | 겹침 | `trash.blog.int.test.ts` "TRASH-P1 POST /trash/purge takes an admin or the events retry secret, and nobody else", `entries.test.ts` 125 · 토큰 없는 `admin-or-bearer`가 `guardedAdmin`으로 가는 것은 TRASH-P1이, 출처 검사는 125가 본다 |
| is 404 when the delivery is not failed or dead any more, and 400 without a subscriber | 작음 | 이미 처리된 전송에 404를 답하는 것. 틀려도 화면이 성공을 보일 뿐, 보내지는 것은 없다 |

### `core/src/http/v1/__test__/formats.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a text in a format a plugin provides is read by that plugin, and stored as a document | 겹침 | `entries-doc.int.test.ts` "WRITE-S1 creates an entry from text with its format…", `format/__test__/convert.test.ts` "FMT-P1 reads a text with the format that is named, and gives every block an id" · POST 글 길은 entries-do… |
| a save with a text pairs the blocks with the draft, so unchanged blocks keep their ids | 겹침 | `entries-doc.int.test.ts` "TRANS-B1 keeps the block ids of the draft when a patch sends edited text" · 같은 요청, 같은 검사 |
| an internal link written as the path of its target is stored as the id of that target, whatever the format | 겹침 | `convert.test.ts` "FMT-P1 is read, normalised by core (a path becomes an id…)" · 라우트가 더하는 것이 없다 |
| a format that can only write is a 400 format_not_importable | 겹침 | `convert.test.ts` "FMT-P1 fails with format_not_importable for a format that only writes" |
| a text the format rejects is kept as an unparsed draft, with the format's findings blocking publishing | 겹침 | `convert.test.ts` "FMT-P1 cannot get anything past core: a text it rejects is kept as an unparsed draft that cannot be published" |
| the old `mdx` property is gone: it is not read as a body | 작음 | 옛 속성을 무시하는 것. 지금 클라이언트는 보내지 않는다 |
| without ?format= there is no text, only the document | 작음 | 늘 글을 붙이는 결함은 응답이 커질 뿐 |
| a link to an entry that is gone is written as its id when the text is to be imported again, and imports back as that link | 겹침 | 이 파일 348, `convert.test.ts` "FMT-P1 is read, normalised by core…" · 내보내기는 348, 경로 → id는 convert.test가 본다 |
| lists the formats with what a client needs: the file facts, and whether the format can be read back | 겹침 | `format/__test__/registry.test.ts`의 `info()` 테스트 · meta는 `info()`를 그대로 싣는다 |
| creates an empty template when it gets no body | 겹침 | `core/store/__test__/contract/templates.contract.ts` "creates an empty template without a document…" |

### `core/src/http/v1/__test__/meta.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is false when the server config has no media storage | 겹침 | 이 파일 25 · 25도 저장소 없는 인스턴스의 `features.media`가 false인지 본다 |
| reports the document limit next to the MDX limit | 작음 | 관리자 화면은 `docBytes`를 읽지 않는다 |
| reports for every collection whether it uses folders, as a boolean | 겹침 | 이 파일 61 · 61이 같은 값을 정확한 불리언으로 본다 |
| says folders are on exactly when some collection uses them | 작음 | 관리자는 `features.folders`를 읽지 않는다(`definitions[name].folders`를 읽는다) |
| turns features.templates off with admin.templates: false, and keeps it on otherwise | 작음 | ⚪ 관리자 옵션으로 템플릿 끄기 · `core/__test__/admin-features.test.ts`도 같은 값을 본다 |

### `core/src/http/v1/__test__/security.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| trusts the forwarded host by the server config and AUTH_TRUST_HOST when no option is passed | 겹침 | 이 파일 36, `adapters/auth/__test__/trust-host.test.ts` "AUTH-L8 AUTH_TRUST_HOST turns it on or off when the option is absent" · 믿음 여부는 trust-host가, 그 값으로 헤더를 보는 것은 36이 본다 |

### `core/src/http/v1/__test__/templates-api.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| GET /templates lists templates for both editors | 겹침 | `entries-doc.int.test.ts` "lists templates with their documents" |
| POST /templates creates a template and validates body | 겹침 | `formats.int.test.ts` "takes a document, or a text with its format, and returns the document" · 409는 `handleApiError`의 conflict 길뿐 |
| GET /templates/:id returns single template or 404 | 겹침 | `formats.int.test.ts` "?format= adds the text of each template to a list and to one template" · 404는 not_found 길뿐 |
| PATCH /templates/:id updates template and checks expectedVersion | 겹침 | `formats.int.test.ts` "a patch with a text keeps the ids…", `entries.test.ts` "WRITE-S2 PATCH /entries/:id maps optimistic lock conflict to 409…" · 라우트에 충돌 코드가 없다. 저장소의 버전 검사는 templates.contract가 본다 |
| DELETE /templates/:id deletes template with optional expectedVersion | 겹침 | `formats.int.test.ts` "deleting a template still needs its version" |

### `core/src/http/v1/entries/[id]/check/__test__/check.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is guarded as publish is: same-origin and admin login | 겹침 | `entries.test.ts` 109, 125 · 같은 `guardedAdmin` |

### `core/src/http/v1/entries/[id]/publish/__test__/publish.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| ignores a request publishedAt; the display date comes from the saved draft metadata | 작음 | 요청의 발행일을 버리는 것은 스키마가 한다. 대신 `resetPublishedAt`이 서비스에 가는지(WRITE-P5의 이어짐)는 아무 라우트 테스트도 보지 않는다. 이 테스트를 그것으로 바꾸기를 권한다 |
| rejects a non-integer expectedVersion before publishing | 겹침 | 이 파일 86 · 같은 요청. 86이 오류 코드까지 본다 |
| keeps optimistic version conflicts | 겹침 | `entries.test.ts` "WRITE-S2 PATCH /entries/:id maps optimistic lock conflict to 409 and returns serverVersion" · 라우트에 충돌 코드가 없고 같은 오류 길 |
| requires expectedVersion before any publish | 겹침 | `entries.test.ts` "WRITE-S2 PATCH /entries/:id rejects without version with 428 version_required" · 같은 `readVersionedBody` |
| blocks unauthorized and cross-origin requests before reads and writes | 겹침 | `entries.test.ts` 109, 125 · 같은 `guardedAdmin` |

### `core/src/http/v1/entries/[id]/relations/__test__/relations.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| GET /entries/:id/relations requires admin access | 겹침 | `entries.test.ts` 109 |
| GET /entries/:id/relations returns 404 for nonexistent entry | 겹침 | `media-api.test.ts` "MEDIA-B4 answers 404 for a file that does not exist" · not_found 길뿐 |

### `core/src/http/v1/folders/__test__/folders-api.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| PATCH /folders/:id rejects without expectedVersion with 428 | 겹침 | `entries.test.ts` "WRITE-S2 PATCH /entries/:id rejects without version with 428 version_required" · 같은 `readVersionedBody` |
| PATCH /folders/:id maps conflict to 409 | 겹침 | `entries.test.ts` "WRITE-S2 … maps optimistic lock conflict to 409…" · 목이 던진 충돌을 그대로 넘길 뿐 |
| GET /folders/:id/contents tells what the folder holds | 겹침 | `trash.blog.int.test.ts` "TRASH-T4 DELETE /folders/:id trashes the folder, GET /folders/:id/contents counts before…" · TRASH-T4가 실제 저장소로 같은 답을 `toEqual`로 본다 |
| DELETE /folders/:id moves the folder to the trash and answers with what went, without the event bookkeeping | 겹침 | 위와 같은 TRASH-T4 · TRASH-T4도 `entryIds`가 빠지는지와 개수를 보고, 날짜까지 본다 |
| DELETE /folders/:id maps a stale version to 409 and needs a version | 겹침 | `entries.test.ts` WRITE-S2의 428·409 두 테스트 · 같은 `assertVersionPresent`와 오류 길 |

### `core/src/http/v1/media/__test__/media-api.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| POST /media/trash rejects a body without ids | 작음 | 빈 목록은 화면이 보내지 않는다 |

### `core/src/http/v1/preferences/__test__/preferences.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| stores page size, sort and columns per collection and merges partial updates | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |
| drops the removed global shape instead of reading it as per-collection settings | 작음 | ⚪ 정렬·열·쪽 · 옛 저장 모양 |
| rejects malformed column names, duplicate order entries and invalid page sizes with 400 | 작음 | ⚪ 정렬·열·쪽 · 화면이 보내지 않는 값 |

### `core/src/http/v1/public/__test__/public-api.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| an unknown format is a 400 invalid_input, and nothing about the format plugin leaks | 작음 | 설치된 형식 이름이 공개 오류에 나오는 정도의 노출 |

### `core/src/operations/__test__/registry.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| accepts dotted names with camel-case segments | 겹침 | 이 파일 49 · 49가 모든 core 작업 이름(`entries.checkPublish` 포함)에 같은 정규식을 건다 |
| only read operations are defined for now | 작음 | "지금은"의 사실. 쓰기 작업을 더하면 일부러 깨진다. 어시스턴트가 읽기만 쓰는 것은 `ai`의 `agent-tools`가 거른다 |
| accepts distinct names | 겹침 | 이 파일 77 · 77이 core와 플러그인의 다른 이름을 실제 인스턴스로 받는다 |
| reports a repeated name once for each repeat, with the owner of the first | 작음 | 개발자 오류의 개수와 문장 |

### `core/src/plugin/__test__/collisions.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| lets a plugin page share a name with a core screen: pages live under tools/ | 작음 | 틀려도 분명한 말로 시작을 막을 뿐이고, 개발자가 이름을 바꾸면 된다 |
| lets one plugin name the same page twice | 작음 | 드문 경우. 틀려도 시작할 때 분명히 알린다 |
| accepts distinct routes | 작음 | 같은 이유(시작할 때 분명히 알리는 거짓 양성) |
| reserves the scopes the core itself uses | 세부 | 고친 99 · 상수 목록을 그대로 적은 검사. 99를 고치면 같은 결함을 동작으로 잡는다 |
| accepts plugins with distinct names and pages | 겹침 | 같은 파일 12 · 12가 같은 거짓 양성을 함수에서 보고, `defineSite`로 이어지는지는 122와 128이 본다 |

### `core/src/plugin/__test__/options.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is undefined for a plugin the site config does not list | 작음 | 없는 이름에 다른 플러그인의 옵션을 주는 결함은 생기기 어렵다 |
| is undefined for every name when the config lists no plugins | 작음 | "확신이 낮은 판정" 참고 |
| needs only a name for a plugin that adds hooks: options are an empty object, the hooks stay in its server module | 작음 | 기본값 `{}` 하나 |
| keeps the options it is given | 겹침 | 같은 파일 30 · 30이 `definePlugin`에 준 옵션을 `pluginOptions`로 다시 읽는다 |

### `core/src/plugin/__test__/server.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| leaves the subscribers after the save out of the checks | 작음 | 저장 전 검사는 이름 있는 훅(`beforeValidate` 등)만 부른다. 들어가도 불리지 않는다. "확신이 낮은 판정" 참고 |
| is empty when nothing registers hooks | 작음 | 98이 훅 없는 플러그인(`plain`, `no-hooks`)이 빠지는 것을 본다 |
| runs the subscribers of each plugin after the server config's, in the plugin order | 겹침 | 같은 파일 98 · 98이 주인의 순서(`server`, `plugin:alpha`, `plugin:beta`)를 그대로 본다 |
| keeps every part of a server module, not only its subscribers | 겹침 | 같은 파일 23 + 98 · 모듈의 `features`는 23이, `on`은 98이 읽는다 |
| is empty when nothing registers afterCommit | 작음 | 170이 구독자 없는 플러그인(`no-after-commit`)이 빠지는 것을 본다 |
| loads the plugins' formats once, and hands out the same registry afterwards | 세부 | 내부 호출 횟수(`toHaveBeenCalledTimes(1)`). 틀려도 느려질 뿐이다 |
| is the registry the instance gives (`cms.formats()`), with the formats a test adds | 작음 | `fakeCms`의 옵션(시험 도구) |

### `core/src/plugin/__test__/sides.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| takes a module of the matching kind for `admin` and `render` | 작음 | 맞는 모듈을 받는지는 저장소의 실제 플러그인(mdx, blocks, ai)이 `tsc`에서 본다 |

### `core/src/server/__test__/config.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| names what is missing | 겹침 | `__test__/errors-say-how-to-fix.test.ts` "defineConfig without a database says what to add" · 같은 호출, 그쪽이 더 많이 본다 |
| does not read the old names | 작음 | 옛 이름을 읽어도 데이터를 잃지 않는다 |
| decrypts when MONTI_SECRET is set to the old value | 겹침 | 이 파일 99 · 같은 비밀이면 읽힌다는 것을 99가 본다 |
| does not decrypt when the old secret is neither the new one nor listed | 겹침 | `secrets/__test__/plugin-secrets.test.ts` "KEY-S2 cannot read values of a secret that is neither current nor listed" |

### `core/src/services/__test__/any-site.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| publishes a content entry built from the schema's required fields | 작음 | 테스트 도우미(`requiredMetadata`)가 맞는지만 본다. 다른 L2 테스트가 같은 도우미로 발행한다 |
| reports a missing title as missing_field with the title field's label | 겹침 | `schema/__test__/derive-roles.test.ts:91` SCHEMA-S3 "uses missing_field with the field label for every field, title included" · 같은 판단(`missingRequiredIssues`)을 발행 길에서 다시 본다 |
| limits the title by the title field's own max | 겹침 | `svc/content-service.test.ts:211` WRITE-P4 "accepts exactly the title field's max Unicode code points and rejects one more" · 같은 길이 검사를 L1이 본다 |
| lists entries by title and names related entries by their title | 겹침 | `pg/title-role.int` 100, 134 · 같은 SQL 길(목록 제목, 관계 제목, 역참조 제목)을 키가 다른 사이트로 더 세게 본다 |
| the config has a media field (SEO share image) | 세부 | 픽스처를 검사한다. 아래 테스트를 `it.skipIf`로 바꾸면 필요 없다 |
| rejects a value that is not a media ID and ignores an empty one | 겹침 | `schema/__test__/derive-roles.test.ts:71` SCHEMA-S3 "accepts a media ID or an empty value" · 같은 판단(`fieldValueError`) |

### `core/src/services/__test__/block-validate.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| does not change the saved content | 작음 | 검사는 경고만 돌려준다. 같은 입력이 같은 해시가 되는 것은 당연하다 |

### `core/src/services/__test__/events.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| is at least once: a subscriber that did its work and then failed gets the same event id again, and can skip it | 겹침 | services/__test__/events.int.test.ts:255 "retries a failed delivery with the same event id once its backoff passed, and not before" · 변이 테스트: 이 테스트만 잡는 바꿈 없음 |
| keeps the mark with the delivery, so pruning the events past the retention removes it too | 작음 | 표시가 남아도 표만 커질 뿐이다 |
| restoring an entry from the trash delivers `restored`, after `trashed` | 겹침 | 575가 같은 이벤트 행에서 `restored`가 `trashed` 뒤에 있는지 본다. 전송은 같은 행에서 나온다 |

### `core/src/services/__test__/preferences-service.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| starts with an empty setting per collection | 작음 | ⚪(정렬, 열과 쪽) |
| merges what is sent into what is saved and keeps the rest | 작음 | 정렬, 열, 쪽 크기는 ⚪라 표에 두지 않는다(소유자 결정 2026-11-01) |

### `core/src/services/__test__/service-rules.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| refuses to create a translation when the site turns translations off | 겹침 | `core/domain/__test__/translation.test.ts:46` TRANS-N1 "rejects every translation when the site turns translations off" · 같은 판단 |

### `core/src/services/__test__/write-hooks.int.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| WRITE-H1 blocks a save with the failures it adds, and stores nothing | 겹침 | 507의 eachRunner "WRITE-H3 a failure a hook adds blocks it and nothing is stored"(save 러너) · 같은 저장 길, 같은 검사 |
| WRITE-H1 passes warnings through with the result and does not block | 겹침 | `write-pipeline.test.ts:179` WRITE-H1 "passes warnings through without blocking" · 발행 결과의 경고 부분은 L1이 보지 않는다(확신 낮음) |
| WRITE-H1 blocks a publish with the failures validatePublish adds, and a save of the same draft still works | 겹침 | `write-pipeline.test.ts:219`(발행을 막음), `:209`(발행에서만 돎) |
| WRITE-H1 calls validatePublish for a publish and for no other write | 겹침 | `write-pipeline.test.ts:209`, 507의 eachRunner "WRITE-H3 a transform and both validations see it" · 러너마다 `validatePublish`가 발행에서만 보이는지 본다 |

### `core/src/text-check/__test__/remote.test.ts`

| 테스트 | 판정 | 이유 |
|---|---|---|
| a response without `issues` is an error | 작음 | 잘못된 응답의 드문 경우 |
