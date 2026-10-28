# Flow 2: Assistant

This file lists every row and step of canvas flow 2, "흐름 2 · 어시스턴트". Asking the assistant, editing the current post, editing many posts, undoing, default requests, writing rules, settings changes, first connection and finding old chats.

Canvas note: "흐름 2 · 어시스턴트 — 묻기 · 지금 글 고치기 · 여러 글 · 되돌리기 · 기본 요청 · 규칙 · 설정 · 처음 · 다시 찾기"

Screens used: [`Main`](../screens.md#main), [`AssistantPanel`](../screens.md#assistantpanel), [`EditorNotion`](../screens.md#editornotion), [`EditorProposal`](../screens.md#editorproposal), [`ProposalReview`](../screens.md#proposalreview), [`Events`](../screens.md#events), [`Media`](../screens.md#media), [`Settings`](../screens.md#settings), [`SettingsProposal`](../screens.md#settingsproposal).

Steps are the contract for the flow test. Each step names its board file, the screen and state it renders, and what the user does and sees. A step number with a letter (for example 04b) is a variant or next moment of the step before it.

## "목록에서 묻기 · 화면 옮기기" · Ask from the list, move the screen

### Step 01: "묻기 · 목록에서 ✦ 열기 → 이 목록에서 할 일 · 최근"

- Board: `Flow2Step01.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "처음")
- The user opens the assistant (✦) from the post list. The panel opens on the right with "이 목록에서" (in this list) starter requests such as "요약이 비어 있는 글 찾아 줘", a "최근" (recent) section, the input box, and the model button "claude-sonnet-5-5 · 생각 보통".

### Step 02: "묻기 · 찾는 중 → 도구 줄 · 멈추기"

- Board: `Flow2Step02.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "묻는 중")
- The user sends "요약이 비어 있는 글 찾아 줘". The assistant works: a tool line shows "글 목록 읽음 · 게시글 148편" and "요약 확인 중 · 62 / 148", with a stop control.

### Step 03: "묻기 · 답 → 목록이 걸러지고 AI가 건 필터(파랑)가 붙음"

- Board: `Flow2Step03.dc.html`
- Renders: `Main` (mode "어시스턴트가 거름"; with-rail off) + `AssistantPanel` (view "목록 거름")
- The answer arrives: two posts have an empty summary. The list is filtered to those two, and the filter chip "요약 비어 있음" is blue because the AI set it. The panel shows the tool lines and the reply.

### Step 04: "화면 옮기기 · “첫 번째 글 열어 줘” → 그 글로 이동, 대화는 이어짐"

- Board: `Flow2Step04.dc.html`
- Renders: `EditorNotion` (todo-open off; panel off; state "아무것도 안 할 때"; pub "발행됨"; save "저장됨") + `AssistantPanel` (view "글 엶")
- The user asks "첫 번째 글 열어 줘". The screen moves to that post's editor and the conversation continues in the panel, whose input now asks about "this post". A line records the move ("화면 이동 · 첫 번째 글").

## "지금 글 고치기" · Edit the current post

### Step 07: "지금 글 고치기 · 이 글에 요청"

- Board: `Flow2Step07.dc.html`
- Renders: `EditorNotion` (todo-open off; panel off; state "아무것도 안 할 때"; pub "발행됨"; save "저장됨") + `AssistantPanel` (view "글에서 요청")
- The user is in a post's editor and types a request in the panel: "더 짧게 다듬어 줘. 말투는 그대로." (make it shorter, keep the tone). The earlier conversation is above it.

### Step 08: "지금 글 고치기 · 글에 파란 연필 → 말풍선으로 고르기"

- Board: `Flow2Step08.dc.html`
- Renders: `EditorProposal` (memo-card off)
- The assistant's edits appear in the post as blue pencil marks. The user picks one from a speech bubble to review it. The memo card is not shown yet.

### Step 09: "지금 글 고치기 · 제안에 메모 → 그 자리에서 다시 고침"

- Board: `Flow2Step09.dc.html`
- Renders: `EditorProposal`
- The user adds a memo to a proposal ("끝은 원래대로 두고 앞만 줄여 줘") and the assistant redoes that spot in place ("끝은 그대로 두고 ‘만들기로 한’만 ‘만든’으로 줄였어요"). The proposal still has discard and accept actions.

## "여러 글 고치기" · Edit many posts

### Step 10: "여러 글 · “둘 다 골라 줘” → AI가 고른 행(파랑) → ✦ 요청"

- Board: `Flow2Step10.dc.html`
- Renders: `Main` (mode "AI가 고름"; with-rail off) + `AssistantPanel` (view "맡기기")
- The user asks "둘 다 골라 줘" (select both). The assistant selects the two posts in the list; the rows are blue because the AI picked them, and the bulk bar shows "2개 선택". The user then sends a ✦ request on the selection.

### Step 11: "여러 글 · 대화 안 제안 카드 · 되돌릴 수 없는 건 빠짐"

- Board: `Flow2Step11.dc.html`
- Renders: `Main` (mode "어시스턴트가 거름"; with-rail off) + `AssistantPanel` (view "제안 카드")
- For a multi-post request, the panel shows a proposal card inside the conversation: "4묶음 · 16건" (4 groups, 16 changes), pending review. The groups are polish a post (3 places), fill summaries (2 posts), move 11 posts to the 2024 folder, and delete media. The media deletion is left out because it cannot be undone ("되돌릴 수 없어 뺐어요", 3 files). The card offers details ("상세 보기") and discard; the apply button reads "16건 적용".

### Step 12: "여러 글 · 상세 보기 → 검토 (한 줄)"

- Board: `Flow2Step12.dc.html`
- Renders: `ProposalReview` (default stage "검토")
- The user opens the details of the proposal. A review screen lists the changes in one line each, with the count "14건 적용" (apply 14) and a discard action.

### Step 13: "여러 글 · 나란히 보기 · 항목 빼기"

- Board: `Flow2Step13.dc.html`
- Renders: `ProposalReview` (default stage "검토"; view "나란히")
- The review in side-by-side view: each item shows "지금" (now) and "제안" (proposal) next to each other, so changed code and the reason are visible at once. The user can remove an item from the proposal.

### Step 14: "여러 글 · 적용 중"

- Board: `Flow2Step14.dc.html`
- Renders: `ProposalReview` (stage "적용 중")
- The user applies the proposal. The review shows progress, "적용 중" (applying), 9 of 14.

### Step 15: "여러 글 · 결과 → 일부 못 함"

- Board: `Flow2Step15.dc.html`
- Renders: `ProposalReview` (stage "결과")
- The result: "13건 적용" (13 applied) and "1건 못 함" (1 failed), with "모두 되돌리기" (undo all). The failed item says why, for example it could not be moved because the post went to the trash in the meantime.

## "되돌리기" · Undo

### Step 16: "되돌리기 · 패널의 카드에서"

- Board: `Flow2Step16.dc.html`
- Renders: `Main` (mode "어시스턴트가 거름"; with-rail off) + `AssistantPanel` (view "적용됨")
- Undo, first way: from the applied card in the assistant panel. The card is marked applied and offers undo.

### Step 17: "되돌리기 · 도구 › 활동 기록"

- Board: `Flow2Step17.dc.html`
- Renders: `Events` (default stage "기본")
- Undo, second way: the user opens Tools › Activity log ("활동 기록"), where the AI changes are listed as events and can be undone from there.

### Step 18: "되돌리기 · 편집기 ⋯ › AI가 바꾼 기록 → 이 글만"

- Board: `Flow2Step18.dc.html`
- Renders: `Events` (default stage "기본"; filter "글 하나")
- Undo, third way: in the editor the user opens ⋯ › "AI가 바꾼 기록" (changes the AI made). The activity log opens filtered to this post only (chips "글: 첫 번째 글", "종류: AI 제안").

## "기본 요청" · Default requests

### Step 19: "기본 요청 · 미디어에서 고르고 “대체 텍스트 채우기”"

- Board: `Flow2Step19.dc.html`
- Renders: `Media` (mode "대체 텍스트 없는 것 고름"; with-rail off) + `AssistantPanel` (view "대체 텍스트")
- A default request. In the media library the user selects images without alt text and asks "대체 텍스트 채우기" (fill alt text). The panel shows the request for 3 images, the tool lines (images viewed, posts using them checked) and a pending proposal of 3 alt texts.

## "글 쓰는 규칙" · Writing rules

### Step 20: "규칙 · 설정 › 사이트 › 글 쓰는 방식"

- Board: `Flow2Step20.dc.html`
- Renders: `Settings` (default stage "기본")
- Writing rules. The user opens Settings › Site › how to write ("글 쓰는 방식"), where the rules the assistant follows are written down.

## "설정에서 고치기" · Change settings

### Step 21: "설정에서 고치기 · 요청 → 설정에 제안 표시 → 저장하고 적용"

- Board: `Flow2Step21.dc.html`
- Renders: `SettingsProposal` (with-rail off) + `AssistantPanel` (view "설정 제안")
- The user asks the assistant to change settings. The settings screen shows the proposed changes ("바뀐 곳" with suggestions) in the settings, with "모두 되돌리기" and "저장하고 적용". The user saves and applies.

## "처음 연결 · 모델 고르기" · First connection, choose a model

### Step 22: "처음 · AI 연결 없음 → API 키 넣기"

- Board: `Flow2Step22.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "키 없음")
- First use, no AI connection. The panel says "AI 연결이 없어요" and offers "API 키 넣기" (add an API key), which leads to the API keys screen (flow 10).

### Step 23: "처음 · 모델 고르기 · 찾기 · 키별 묶음 · 생각 정도"

- Board: `Flow2Step23.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "모델 고르기")
- First use, choosing a model. The model menu opens from the model button with a search box ("모델 찾기") and models grouped by key, for example the default "claude-sonnet-5-5", "openai/gpt-5" from OpenRouter, and Anthropic key models. Each model that can think also has a thinking row.

### Step 23b: "처음 · 모델 메뉴의 생각 › → 옆 둘째 단 · 끔 · 낮음 · 보통 · 높음 (지금 값에 ✓)"

- Board: `Flow2Step23b.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "생각 고르기")
- In the model menu the user opens "생각 ›" (thinking). A second column opens to the side with off, low, medium, high; the current value has a check.

### Step 23c: "처음 · 높음을 고르면 메뉴가 닫히고 입력창 모델 버튼이 “claude-sonnet-5-5 · 생각 높음”"

- Board: `Flow2Step23c.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "생각 높음")
- The user picks high. The menu closes and the model button in the input now reads "claude-sonnet-5-5 · 생각 높음".

### Step 23d: "처음 · 생각을 못 하는 모델을 고르면 메뉴에 생각 줄이 없고 버튼에도 생각이 빠짐"

- Board: `Flow2Step23d.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "생각 없는 모델")
- The user picks a model that cannot think. The menu has no thinking row and the model button drops the thinking part.

## "지난 대화" · Past chats

### Step 25: "다시 찾기 · 지난 대화 · 지우기 · 안 연 대화 자동 삭제"

- Board: `Flow2Step25.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "지난 대화")
- Finding past chats. The panel shows the history: "지난 대화" grouped by day (today, earlier dates), each with time and what it did (for example "받음 5곳", "적용 13건", "되돌림", "검토 대기"), a delete action, and a note that chats not opened for 30 days are deleted.

### Step 26: "다시 찾기 · 다시 연 대화 → 그때 제안 그대로"

- Board: `Flow2Step26.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "다시 연 대화")
- The user reopens an old chat. The conversation shows as it was (10. 24), including the proposal exactly as it was then: delete 4 unused tags, status pending review, with the details and discard actions.

## "예외" · Exceptions

### Step 05: "예외 · 저장 안 한 편집이 있으면 옮기지 않음"

- Board: `Flow2Step05.dc.html`
- Renders: `EditorNotion` (todo-open off; panel off; state "아무것도 안 할 때"; pub "수정 중"; save "저장 전 변경사항") + `AssistantPanel` (view "이동 막힘")
- Exception: the user asks to open another post while the current post has unsaved edits. The assistant does not move the screen and says so, and offers "저장하고 열기" (save and open).

### Step 06: "예외 · 하다가 끊김 → 어디까지 했는지 · 이어서 하기"

- Board: `Flow2Step06.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "실패")
- Exception: the connection drops mid-task. The panel shows "연결이 끊겼어요", how far it got (checked 62 of 148 posts, stopped at 62 / 148), and "이어서 하기" (continue).

### Step 24: "예외 · 서비스 크레딧이 부족함 → 대화 안에서 알림 · 다른 모델로 보내기"

- Board: `Flow2Step24.dc.html`
- Renders: `Main` (mode "처음 화면"; with-rail off) + `AssistantPanel` (view "크레딧 부족")
- Exception: the service account is out of credit. The conversation shows a notice "Anthropic 크레딧이 부족해요" naming the key and saying to top up at the Anthropic site, with "다른 모델로 보내기" (send to another model).
