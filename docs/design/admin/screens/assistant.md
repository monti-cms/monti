# 어시스턴트 화면

어시스턴트 패널과 제안 검토 화면이다. 부품 규칙은 [assistant.md](../components/assistant.md)와 [proposal.md](../components/proposal.md)에 있다.

- 이 화면들만 쓰는 부품은 대화와 입력란뿐이다. 목록, 줄, 묶음 머리, 빈 상태, 오류 답장은 다른 화면이 쓰는 부품 그대로다(2026-11-12 만들며 정함: 같은 일을 하는 것은 같은 부품으로).
- 기준 그림은 따로 없다. 만든 화면의 상태가 `Screens/Assistant`의 이야기로 있고(진짜 사이트 위에서 시킨 말만 하는 모델로 돈다), 그것이 모습의 기준이다. 캔버스 보드(`AssistantPanel.dc.html`, `Assistant.dc.html`, `ProposalReview.dc.html`)는 흐름의 순서만 보인다.
- 무엇을 하는 화면인지는 [기능 설계 10](../../features/10-assistant.md)에 있다.

## 어시스턴트 패널

- 공통 틀: [common.md](common.md)의 사이드 패널. 페이지 옆에 서고 페이지가 줄어든다. 화면을 옮겨도 열린 채이고 대화도 그대로다. 사이드바가 있는 화면에서는 틀의 오른쪽 끝에, 글 편집기와 템플릿 편집기에서는 그 페이지 옆에 선다.
- 어시스턴트를 넣지 않은 사이트에는 ✦ 버튼이 없다. 흐려 두지 않는다.

### 패널의 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 여는 버튼 | 틀의 모서리 `IconButton`(`label` "어시스턴트 열기", `Spark`) | 패널이 열려 있으면 없다. 패널을 닫으면 포커스가 이 버튼으로 돌아온다. |
| 패널 | `SidePanel width="assistant"`(`title` "어시스턴트", `onClose`) | 폭은 끌어서 바꾸고 브라우저가 기억한다. 열려 있었는지와 지금 대화도 브라우저가 기억한다. |
| 머리의 버튼 | `actions`에 `IconButton` "지난 대화"(`RecentlyViewed`), "새 대화"(`Add`) | "새 대화"는 대화가 있을 때만 있다. 돌던 실행은 계속 돌고 지난 대화에 있다(그 실행이 하는 말과 끝은 새 대화에 아무것도 바꾸지 않는다). 그 대화에서 기다리던 말은 함께 사라진다. 다른 대화를 읽는 동안에는 턴도 처음 요청도 보이지 않는다. 키가 없으면 둘 다 없다. |
| 지난 대화의 머리 | `SidePanel`의 `back`("대화로 돌아가기"), `title` "지난 대화" | 패널 안의 다른 보기다. |

### 대화

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 대화 | `ChatThread` | 패널 높이를 채우고 입력란 바로 위에서 위로 쌓인다. 간격은 24px이고, 말 아래 줄(`ChatMessageActions`)이 있는 말에서 다음 것까지는 그 줄을 품어 36px다. 보내면 맨 아래가 보이고, 사람이 올려 보는 동안은 새 글이 끌어내리지 않는다. 맨 위에 닿으면 앞의 요청을 더 읽는다(버튼 없음). |
| 처음 | `ChatThread` 안의 `Stack gap={4}`에 `Suggest kind="request"`(이 화면의 기본 요청), `Suggest kind="recent"`(전에 물은 것 둘) | 누르면 그 말로 묻는다. 묶음 이름은 없다. 반짝이와 시계가 둘을 가른다. 기본 요청은 화면마다 정해져 있다: 목록 "요약이 비어 있는 글 찾아 줘" · "한 달 넘게 안 고친 초안 찾아 줘", 글 "요약 써 줘", 미디어 "쓰지 않는 파일 찾아 줘". |
| 내 말 | `ChatMessage author="user"`(`context`에 함께 간 것: "이 목록", "이 글 · 고른 글자") | 오른쪽의 종이 말풍선. |
| 말 아래 | `ChatMessageActions`(`time`) 안의 `IconButton` "복사", 마지막 말에만 "고쳐서 다시 보내기"(내 말) · "다시 하기"(답) | 시각은 오늘이면 "10:58", 그 전이면 "10. 24 10:58"(활동 기록과 같은 꼴). 다시 연 대화의 날짜 줄은 따로 없다. "고쳐서 다시 보내기"는 그 말을 입력란에 넣고 포커스를 준다. |
| 답 하나 | `Stack gap={12}` | 도구 줄 묶음, 답의 글, 카드, 오류 답장이 이 순서로 선다. |
| 도구 줄 | `Stack gap={0}` 안의 `ToolCallLine`(`status` running · done · failed, `details`에 "보낸 값") | 읽기는 "글 목록 읽는 중" → "글 목록 읽음 · 148편", 여럿이면 "글 읽는 중 · 62 / 148". 쓰기는 그 묶음의 이름과 이어진 호출 수("요약 채우기 · 2건"). 화면 도구는 "글 엶" · "목록 거름" · "목록에서 고름 · 2편". 관리자 화면이 말을 모르는 기능은 그 이름이다. 끊긴 실행에서 하던 줄은 빨간 ×와 "… · 여기서 멈춤". 사람이 멈춘 실행에서 하던 줄은 사라진다. 줄을 열면 보낸 값만 보인다(결과는 저장하지 않는다). |
| 답의 글 | `ChatMessage`(어시스턴트, 쓰는 동안 `streaming`) | 문단마다 하나. 목록은 표시와 함께 `Stack`, 코드는 `CodeBlock`. 굵게 · 기울임 · 글자 코드는 `Text`. 글 속의 관리자 화면 주소(`#/…`)는 `TextButton variant="underline"`이고 누르면 그 화면이 열린다(답이 가리키는 글의 이름). 바깥 주소는 누를 때만 새 탭으로 열리고 어디서 왔는지 알리지 않는다. 그림은 그리지 않는다: 그 이름과 주소가 글자로 보인다. 그 밖의 것(`javascript:`)은 적힌 그대로다. |
| 일하는 표시 | 글이 아직 없는 `ChatMessage streaming` | 보낸 순간부터 글이나 도는 도구 줄이 나올 때까지 답 자리에 캐럿만 깜박인다. "생각 중" 같은 말은 없다. |
| 일하는 동안 한 말 | `ChatMessage author="user"` | 실행이 받아들인 말은 그 자리에 말풍선으로 선다. |
| 기억의 끝 | `Text as="div" variant="micro" tone="subtle" align="center"` "여기부터 기억합니다" | 대화가 길어 모델에 보내지 않는 오래된 요청이 생기면, 아직 보내는 첫 요청 위에 선다. 없으면 없다. |
| 제안 카드 | 아래 "제안 카드" | 그 요청이 만든 제안. 설정과 열린 글의 제안은 그 화면에 파랗게 표시되고 카드가 없다. |
| 오류 답장 | `ErrorNote`(`title`, 회색 한 줄, `actions`에 `Button variant="ghost" size="sm"`: 그 부품의 규칙대로) | 아래 표. 할 수 있는 일은 마지막 요청에만 붙는다. 보내기는 미리 막지 않는다. |

오류 답장의 말:

| 일 | 제목 | 회색 줄 | 할 수 있는 일 |
|---|---|---|---|
| 서비스가 거절 | "서비스가 거절했습니다" | 키 이름 · 서비스가 한 말 그대로 | "다른 모델로 보내기": 모델 메뉴가 열리고, 고르면 같은 말을 그 모델로 다시 보낸다 |
| 서비스가 답하지 않음 | "서비스가 답하지 않습니다" | 키 이름 | "다시 시도": 같은 말을 다시 보낸다 |
| 답이 오다 끊김 | "연결이 끊겼습니다" | 없음 | "이어서 하기": 새 말 없이 하던 곳에서 잇는다. 끊긴 답의 글은 다시 온 답이 대신한다 |
| 턴이나 토큰 한도 | "한도에 닿아 멈췄습니다" | 없음 | "이어서 하기": 그만큼을 다시 준다 |
| 우리 서버에 닿지 못함 | "연결이 끊겼습니다" | 없음 | "다시 시도" |
| 실행의 키가 지워짐 | "AI 연결이 없습니다" | 없음 | 없음. 그 대화의 다음 요청은 사이트에 남은 키의 처음 모델로 간다. 패널이 열려 있을 때 쓰던 모델이 없어진 것을 알면 토스트로 한 번 말한다: "쓰던 모델이 없어졌습니다. 지금 모델: claude-sonnet-5-5" |

요청 하나의 시간 한도는 사람에게 보이지 않는다. 브라우저가 스스로 이어 부른다. 호스트가 요청을 도중에 끊어도 같다. 같은 자리에서 두 번 끊기면 스스로 잇기를 멈추고 "연결이 끊겼습니다 · 이어서 하기"를 보인다.

### 입력란

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 입력란 | `SidePanel composer`에 `ChatInput`(`label` "어시스턴트에게 묻기", `placeholder` "사이트에 대해 물어보세요", `aside`에 모델 버튼) | 흐린 글은 어느 화면에서나 같다. 무엇이 함께 가는지는 칩이 말한다. Enter로 보내고 Shift+Enter로 줄을 바꾼다. 비었으면 보내지 않는다. |
| 칩 | `ChatInput context`에 `Chip onRemove` | 함께 가는 것 모두: 열린 것 하나("이 글" · "이 목록" · "미디어" · "설정")와 고른 것 하나("고른 글 2편" · "고른 파일 3개" · "고른 글자"). ×로 빼면 그것은 가지 않는다. 다른 글을 열거나 다른 행을 고르면 다시 생긴다. |
| 일하는 동안 | `ChatInput busy`, `busyPlaceholder` "더 말하기" | 보내기가 멈추기가 된다. 더 보낸 말은 줄에 쌓인다. 멈추기를 누른 뒤에는 브라우저가 그 실행을 스스로 이어 가지 않고(화면 도구가 끝났을 때도, 요청 하나의 시간이 다 됐을 때도), 화면 도구는 화면을 옮기지 않는다. 한글을 조합하는 중의 Enter는 보내지 않는다. |
| 기다리는 말 | `ChatInput queue`에 `ChatQueueItem`("지금 보내기" · "고치기" · "취소") | "지금 보내기"는 다음 턴에 들어간다. "고치기"는 말을 입력란으로 돌리고 포커스를 준다. 실행이 끝나면 남은 말이 차례로 간다. 키보드로 "지금 보내기"나 "취소"를 누르면 포커스는 다음 줄의 첫 버튼으로, 없으면 입력란으로 간다. 줄이 생기고 사라져도 입력란은 같은 요소다(치던 글의 커서가 그대로다). |
| 모델 버튼 | `ModelMenuButton`(`label` "모델 고르기") | mono 모델 이름, 생각하는 모델이면 흐린 "· 생각 보통". 실행 중에도 눌린다. |
| 모델 메뉴 | `ModelMenu layout="chat"`(검색 "모델 찾기", `groups` "최근" · 키 이름과 개수, 지금 모델 ✓, 처음 모델에 `hint` "기본", `thinking`의 "생각 ›" "끔" · "낮음" · "보통" · "높음") | 생각하지 않는 모델이면 `thinking`을 넘기지 않아 그 행이 없다. 새 대화는 처음 모델과 "보통"에서 시작한다. |
| 키가 없을 때 | `Empty`(`title` "AI 연결이 없습니다") 안의 `EmptyStep`(`href` API 키 화면) "API 키 넣기" | 빈 목록과 같은 부품이다. 입력란과 머리의 버튼이 없다. |

### 제안 카드

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 카드 | `ProposalCard`(`title` "제안", `summary` "2묶음 · 3건" 또는 "2건", 버렸으면 `muted`) | 머리에 상태는 없다. 상태는 발 한 줄이 말한다. |
| 묶음이 여럿 | 공용 `Table container="none"`의 `TableRow`: `RowTitle`(`title` 묶음 이름, 대상이 하나면 `address`에 그 이름), 끝에 `Count` "2건" | 묶음마다 한 줄. |
| 묶음이 하나 | `TableRow twoLine`: `RowTitle`(`title` 대상, `address` 주소), 아래 `Text variant="note" lines={2}` 안의 `Ins` 새 값 | 처음 셋. 더 있으면 `Text tone="subtle"` "외 N건" 한 줄. 검토 화면의 줄에서 체크만 뺀 같은 줄이다. |
| 못 한 것 | 적용 뒤, `TableRow`: `RowTitle`(`title` 대상, `address` 쓰기가 말한 까닭) | |
| 발 | 아래 "제안의 상태 한 줄" | `footer`. |

### 제안의 상태 한 줄

카드의 발과 검토 화면 머리 끝이 같은 한 줄이다(화면 코드 `ProposalState` 하나). 둘은 같은 제안을 읽으므로 수가 늘 같다. 이 줄의 버튼을 키보드로 눌러 그 버튼이 사라지면(적용 중에는 버튼이 없고, 버림과 되돌림 뒤에도 없다) 포커스는 줄에 남은 첫 버튼으로, 없으면 줄 다음의 첫 컨트롤로 간다(카드와 검토 화면이 같다).

| 상태 | 보이는 것 |
|---|---|
| 기다림 | (카드만, 더 볼 것이 있을 때) `Button variant="ghost"` "검토", 끝에 `Button variant="ghost"` "버리기", `Button variant="primary"` "3건 적용". 넣은 줄이 없으면 "0건 적용"이고 눌리지 않는다. 버리기는 묻지 않는다. |
| 적용 중 | `Text variant="note"` "적용 중", `Count` "2 / 3", `Progress inline` |
| 적용됨 | `Text variant="note" tone="success"` "✓ 2건 적용", 못 한 것이 있으면 `tone="danger"` "1건 못 함", 끝에 "검토"(카드)와 "되돌리기". 되돌리기는 묻지 않는다. |
| 되돌림 · 버림 | `Text variant="note" tone="subtle"` "되돌림" · "버림" |

카드의 버튼은 `size="sm"`, 검토 화면의 것은 페이지의 크기다.

### 지난 대화

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 목록 | 공용 `Table container="none"`, `TableRow twoLine`. 열 이름 행은 없다 | API 키 목록, 템플릿 목록과 같은 줄이다. 날짜 묶음은 없다(활동 기록과 같다. 시각이 말한다). 50줄씩, 끝에 닿으면 더 읽는다. |
| 한 줄 | 첫 줄 `RowLink`(버튼) 안의 `Text truncate` 처음 물은 말, 둘째 줄 `Text variant="note" tone="subtle"` "10:58 · 검토 대기" | 한 일은 "검토 대기" · "적용 16건" · "받음 5곳" · "되돌림" · "버림". 줄을 누르면 그 대화가 그때 그대로 열린다. 지금 열린 대화는 `TableRow selected`. |
| 줄의 ⋯ | `RowActions` 안 `RowMore`(`label` "(말) 더 보기") + `DropdownMenu` "지우기" `variant="danger"` | 늘 보인다. 묻지 않고 줄이 사라진다. 그 대화의 대기 제안도 지워진다. 키보드로 지우면 포커스는 메뉴가 닫히며 다음 줄의 ⋯로, 없으면 앞 줄의 ⋯로 간다(`DropdownMenuContent finalFocus`). 줄이 하나도 남지 않으면 패널의 입력란(없으면 첫 컨트롤)으로 간다. |
| 없을 때 | `Empty`(`title` "지난 대화가 없습니다") | |
| 발 | `SidePanel footer`에 `Text variant="note"` "안 연 대화 지우기"와 `Select`(화면의 `PickOne`, `size="sm"`): "7일 뒤" · "30일 뒤" · "90일 뒤" · "지우지 않음" | 설정은 칸 부품으로 고른다. 고르는 대로 저장된다. |

스토리: Screens/Assistant(만든 화면), Controls/Overlay/SidePanel, Monti/Assistant/ChatThread, Monti/Assistant/ChatMessage, Monti/Assistant/ToolCallLine, Monti/Assistant/Suggest, Monti/Assistant/ChatInput, Controls/Menu/ModelMenu, Controls/Status/ErrorNote, Monti/Proposal/ProposalCard, Patterns/List/Table, Patterns/List/Empty, Controls/Field/Select, Controls/Menu/DropdownMenu.

### 만든 화면의 상태

| 상태 | 흐름 | 이야기 (`Screens/Assistant`) |
|---|---|---|
| 처음 | 2.01 | `First` |
| 키 없음 | 2.22 | `NoKey` |
| 묻는 중 | 2.02 | `Asking` |
| 답이 오는 중 | | `Writing` |
| 답함(글의 링크) | 2.03 | `Answered` |
| 연 도구 줄 | | `ToolOpen` |
| 더 말하기 | | `Queued` |
| 서비스가 거절 | 2.24 | `Refused` |
| 서비스 답 없음 | | `NoAnswer` |
| 끊김 | 2.06 | `Dropped` |
| 한도 | | `Limit` |
| 제안 카드(한 묶음) | 2.11 | `Card` |
| 제안 카드(여러 묶음) | 2.11 | `CardOfKinds` |
| 적용됨 | 2.16 | `Applied` |
| 버림 | | `Discarded` |
| 모델 고르기 | 2.23 | `Models` |
| 지난 대화 | 2.25 | `PastConversations`, 없을 때 `NoPastConversations` |
| 제안 검토 | 2.12 | `Review` |

## 제안 검토

- 주소 `#/ai/review/<제안 id>`. 공통 틀: [common.md](common.md)의 사이드바, 페이지 단(`PageColumn width="content"`), 제목 행. 사이드바에서 고른 행은 없다.

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "‹ 어시스턴트" | `PageHeader trail`에 `TextButton variant="quiet"` | 떠나온 화면으로 돌아가고 패널이 그 대화로 열린다. |
| 제목 행 | `PageHeader`(`title` "제안 검토", `meta` 시각), 끝에 "제안의 상태 한 줄" | 넣은 줄만 적용한다. 버리면 떠나온 화면으로 돌아간다. |
| 요청 | `PageBody` 안 `Stack gap={32}`의 첫 줄, `Text as="p" variant="title" tone="muted"` | 따옴표로 인용한 요청. |
| 묶음 | `ListSection table`(`title` 묶음 이름, `count` "3건", `actions`) | 도구 화면의 제목 있는 목록과 같은 머리다. `actions`: 글이 바뀌는 묶음이면 보기 전환 `Tabs` + `TabsList variant="line"` "한 줄" · "나란히", 기다리는 줄이 둘 이상이면 `TextButton` "3건 모두 빼기"(하나라도 빠져 있으면 "3건 모두 넣기"). 보기 전환은 묶음마다 따로다: 한 묶음을 "나란히"로 바꿔도 다른 묶음은 그대로다. |
| 줄 | 공용 `Table container="none"`의 `TableRow`(바뀌는 글이 있으면 `twoLine`): `Checkbox`(`aria-label` "(대상) 넣기"), `RowTitle`(`title` 대상, `address` 주소), 줄 끝에 결과 | 체크는 늘 보인다(목록의 여백 체크 `RowCheck`가 아니다: 거기서 체크는 "일괄 작업에 고름"이고 줄을 물들인다. 여기서는 모든 줄이 넣은 채로 시작한다). 누르는 대로 저장되고 알약과 카드의 수가 따라 바뀐다. 적용이 시작되면 `readOnly`다. |
| 바뀌는 글 | 줄 안의 `CompareRows` + `CompareRow`(`name` 자리 이름: "제목" · "주소" · 필드 이름 · "블록 3" · "새 블록") | 번역 화면의 나란히 줄과 같은 부품이다. "한 줄"은 `CompareRow single`: 한 칸에 빠지는 말(`Del`)과 들어오는 말(`Ins`)이 제자리에. "나란히"는 두 칸: 지금(빠지는 말 표시) · 제안(들어오는 말 표시). 옛 값이 비었으면 새 값만 보인다. 본문 바꿈은 그 글의 지금 본문에 바꿈을 얹어 블록마다 견준다. |
| 줄 끝의 결과 | `EntryStatus`: 적용 `status="published"` "적용", 되돌림 `status="archived" quiet` "되돌림", 못 함 `status="failed"` "못 함"과 `Text variant="note" tone="danger"` 까닭 | 활동 기록의 전송 칸과 같은 부품이다. |
| 그 사이 고쳐진 줄 | 줄 끝에 `Text variant="note" tone="subtle"` "그 사이 고쳐짐"과 `TextButton variant="underline"` "다시 만들기" | 체크가 빠지고 수에서 빠진다. 누르면 "다시 만드는 중…" 뒤에 새 값이 오고 체크가 켜진다. |
| "편집기에서 보기" | 기다리는 줄 끝의 `TextButton variant="underline"`(`href` 그 글) | 그 글의 편집기를 연다. |

스토리: Screens/Assistant › Review, Patterns/Frame/PageHeader, Patterns/List/ListSection, Patterns/List/Table, Controls/Field/Checkbox, Monti/Translation/Compare, Monti/Proposal/Marks, Controls/Status/EntryStatus, Controls/Tabs/Tabs, Controls/Button/TextButton.


## 누른 것이 사라질 때의 포커스

키보드로 누른 컨트롤이 그 누름으로 사라지면 포커스를 넘긴다([tokens.md](../tokens.md) 상태, `useFocusHandOff`. 포인터로 누르면 아무것도 옮기지 않는다).

| 누른 것 | 포커스가 가는 곳 |
|---|---|
| "새 대화", 처음 요청, "다시 하기", "다시 시도", "이어서 하기" | 입력란 |
| 기다리는 말의 "지금 보내기" · "취소" | 다음 줄의 첫 버튼, 없으면 입력란 |
| 제안의 상태 줄("버리기" · "n건 적용" · "되돌리기") | 줄에 남은 첫 버튼, 없으면 줄 다음의 첫 컨트롤 |
| 검토 화면 줄의 "다시 만들기" | 그 줄의 체크 |
| 지난 대화 ⋯의 "지우기" | 다음 줄의 ⋯, 없으면 앞 줄의 ⋯, 없으면 입력란(없으면 패널의 첫 컨트롤) |
| 편집기와 설정의 제안 버블 "모두 받기" · "모두 버리기" | 버블이 덮고 있던 것: 편집기는 본문, 설정은 그 화면의 첫 컨트롤 |

제안 버블의 이름(요청한 말)을 누르면 패널이 그 대화로 열린다([proposal.md](../components/proposal.md) 버블).