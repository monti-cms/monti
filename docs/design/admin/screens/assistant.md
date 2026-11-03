# 어시스턴트 화면

어시스턴트 패널과 제안 검토 화면이다. 부품 규칙은 [assistant.md](../components/assistant.md)와 [proposal.md](../components/proposal.md)에 있다.

## 어시스턴트 패널 (Assistant)

- 보드: `Assistant.dc.html`(목록 Main 옆에 연 패널). 상태와 흐름 단계: [screens.md › Assistant](../screens.md#assistant).
- 공통 틀: [common.md](common.md)의 사이드 패널. 패널 안의 모든 상태는 아래 AssistantPanel에 있다. 이 보드는 "제안 카드"와 "적용됨"을 목록 화면 위에서 보인다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel width="assistant"`(`title` "어시스턴트", `onClose`, `actions`에 `IconButton` "지난 대화" · "새 대화", `composer`에 입력 상자) | 화면 오른쪽에 붙고 ✦ 버튼을 가린다. |
| 대화 | `ChatThread` | 아래에 붙어 위로 쌓인다. |
| 내 말 | `ChatMessage author="user"` | 오른쪽 종이 말풍선. |
| 도구 줄 | `ToolCallLines` 안에 `ToolCallLine status="done"` | "글 목록 읽음 · 게시글 6편". |
| 어시스턴트의 답 | `ChatAnswer` 안에 `ChatMessage author="assistant"` | 바탕 없는 글. 글 이름은 `TextButton variant="underline"`(편집기로 간다)과 mono 주소 `Text variant="meta" mono`. |
| 제안 카드 | `ProposalCard`(`title` "제안", `summary` "요약 채우기 · 글 2편", `status` "검토 대기" `statusTone="warning"`, 적용 뒤 "적용됨" `statusTone="success"`) | 묶음마다 `ProposalRow` 한 줄("요약 채우기 · 고른 글 · 2편"). 보드는 글마다 "비어 있음 → 새 요약"을 그렸다. [assistant.md](../components/assistant.md)를 따라 묶음 줄만 두고, 글별 내용은 검토 화면에서 본다. |
| 카드 아래 (기다림) | `ProposalActions`: "상세 보기"(검토 화면이 있을 때) · "버리기" · [적용] | 검은 알약은 [적용] 하나다. |
| 카드 아래 (적용됨) | `ProposalResult`: "✓ 2편에 적용" · 시각 · "모두 되돌리기" | 보드의 "되돌리기"는 문서를 따라 "모두 되돌리기"로 맞춘다. |
| 입력 상자 | `ChatInput`(`label` "어시스턴트에게 묻기", `placeholder` "사이트에 대해 물어보세요", `aside`에 `ModelMenuButton`과 `ModelMenu layout="chat"`) | Enter로 보낸다. 글이 비면 보내기만 흐리다. |

### 상태

| 상태 · prop | 더해지는 것 |
|---|---|
| `proposal` "검토 대기" | `ProposalCard` 상태 "검토 대기"와 `ProposalActions` |
| `proposal` "적용됨" | 상태 "적용됨"과 `ProposalResult` |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 어시스턴트 · 처음 열었을 때 (AssistantFirst)

- 보드: `AssistantFirst.dc.html`(글 편집기 옆에 연 빈 패널). 상태와 흐름 단계: [screens.md › AssistantFirst](../screens.md#assistantfirst).
- 공통 틀: 위 Assistant와 같다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 머리 | `SidePanel width="assistant"`, `actions`에 `IconButton` "지난 대화"만 | 대화가 없으니 "새 대화"가 없다. |
| 빈 패널 | `SuggestList` | 입력 상자 바로 위, 아래에 붙는다. 설명 글이 없다. |
| 묶음 이름 "이 글에서" · "최근" | `SuggestLabel` | 첫 묶음은 지금 화면의 기본 요청이다. |
| 시작할 요청 | `Suggest request`("요약 써 줘", "영어로 옮겨 줘"), `Suggest recent`(전에 물은 것 둘) | 누르면 그 말로 바로 묻는다. |
| 입력 상자 | `ChatInput`(`placeholder` "이 글에 대해 물어보세요") | 위 Assistant와 같다. |

### 상태

| 상태 · prop | 더해지는 것 |
|---|---|
| (상태 prop 없음) | 빈 패널 하나 |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 어시스턴트 패널 · 상태 (AssistantPanel)

- 보드: `AssistantPanel.dc.html`. 상태와 흐름 단계: [screens.md › AssistantPanel](../screens.md#assistantpanel).
- 공통 틀: 위 Assistant의 패널, 대화, 입력 상자. 여기서는 상태마다 더해지는 것을 적는다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 머리 (대화) | `SidePanel width="assistant"`(`title` "어시스턴트", `actions` "지난 대화" · "새 대화", `onClose`) |  |
| 패널 머리 (지난 대화) | `SidePanel`의 `back`("대화로 돌아가기"), `title` "지난 대화" | 패널 안에서 다른 보기로 간다. |
| 다시 연 대화의 날짜 | `ChatDate` | 맨 위 가운데, mono 11. |
| 고른 행과 함께 보낸 말 | `ChatMessage author="user" context` "고른 글 2편" |  |
| 화면 버튼으로 보낸 말 | `ChatMessage author="user" request` | 앞에 파란 반짝이. |
| 하는 중인 도구 줄 | `ToolCallLine status="running"` | 돌아가는 표시와 진한 글("요약 확인 중 · 62 / 148"). |
| 멈춘 도구 줄 | `ToolCallLine status="failed"` | 빨간 ×와 "… 에서 멈춤". |
| 오류 답장 | `ChatError`(`title`, 회색 한 줄, `actions`에 `TextButton variant="underline"`) | 크레딧 부족: "Anthropic 크레딧이 부족해요" · "다른 모델로 보내기". 연결 끊김: "연결이 끊겼어요" · "이어서 하기". 보내기는 미리 막지 않고, 보낸 뒤에 이 답장으로 알린다. |
| 옮기지 못한 이동 | 답의 글 + 글 이름 `TextButton variant="underline"` + mono 주소 + `Button variant="secondary" size="sm"` "저장하고 열기" | 저장하지 않은 편집이 있어 화면을 옮기지 않았을 때. 대화 안의 답으로 알린다. |
| 여러 묶음 제안 | `ProposalCard`(`summary` "4묶음 · 19건") 안에 `ProposalRow` 넷(`name`, `detail`, `count`) | 기다림: `ProposalActions` "상세 보기" · "버리기" · [19건 적용]. 적용 뒤: `ProposalResult` "✓ 16건 적용" · "1건 못 함" · 시각 · "모두 되돌리기", `after`에 `ProposalRow tone="danger"` "못 옮김 · 겨울 사진 · 그 사이 휴지통으로 감". |
| 파일 제안 (대체 텍스트) | `ProposalCard`(`summary` "대체 텍스트 · 3개") 안에 `ProposalItem` 셋(mono 파일 이름과 `Ins` 새 글) | 셋 이하라 "상세 보기"가 없다. 넘으면 흐린 "외 N개" 줄(`ProposalRow`에 `detail`만)과 "상세 보기". |
| 지운 제안 (다시 연 대화) | `ProposalCard` 안에 `ProposalRow`(`detail`에 `Del`로 태그들, `count` "글 0편") |  |
| 설정 · 스키마 제안 | 도구 줄과 답의 글만 | 제안은 그 화면에 파랗게 표시된다. 카드는 없다. |
| 빈 패널 | `SuggestList`, `SuggestLabel` "이 목록에서" · "최근", `Suggest request` · `Suggest recent` | AssistantFirst와 같다. |
| 키가 없을 때 | `Text variant="title"` "AI 연결이 없어요", `Text variant="note" tone="subtle"`, `Button variant="primary"`(`render`로 API 키 화면 링크) "API 키 넣기" | 입력 상자는 없다. |
| 지난 대화 목록 | `ConversationList`, `ConversationGroupLabel` "오늘" · "이전", `ConversationRow`(`title`, `meta` "10:52 · 적용 16건", 지금 대화는 `current`, `menu`에 `ConversationRowMore` + `DropdownMenu` "지우기") | 행을 누르면 그 대화를 연다. 지우기는 묻지 않는다. |
| 지난 대화의 발 | `SidePanel footer`에 `Text variant="note"` "안 연 대화 지우기"와 `FilterButton filled` "30일 뒤" + `DropdownMenu`(`DropdownMenuRadioGroup` 7일 · 30일 · 90일 · 지우지 않음) | 날수는 메뉴에서 고른다. |
| 입력 상자의 고른 행 칩 | `ChatInput context`에 `Chip onRemove`("고른 글 2편") | ×로 빼면 그 행들은 가지 않는다. |
| 답을 쓰는 동안 | `ChatInput busy` | 보내기가 멈춤 버튼이 된다. |
| 모델 버튼 | `ModelMenuButton` | mono 모델 이름, 생각하는 모델이면 흐린 "· 생각 보통". 메뉴가 열리면 잉크. |
| 모델 메뉴 | `ModelMenu layout="chat"`(검색 행, `groups` "최근" · 키 이름과 개수, 지금 모델 ✓, 끝의 "기본" · 키 이름 `hint`, `thinking`의 "생각 ›" 둘째 단계 "끔" · "낮음" · "보통" · "높음") | 생각을 지원하지 않는 모델이면 `thinking`을 넘기지 않아 그 행이 없다. 목록은 키로 묶는다. 도구를 쓸 수 있는 모델만 나온다. |

### 상태

| `view` | 더해지는 것 |
|---|---|
| "처음" | `SuggestList`, 입력 상자 |
| "묻는 중" | 내 말, `ToolCallLine` done 하나와 running 하나, `ChatInput busy` |
| "목록 거름" | 도구 줄 셋과 답 |
| "글 엶" | 이어서 "첫 번째 글 열어 줘", 도구 줄 "화면 이동", 답. 플레이스홀더 "이 글에 대해 물어보세요" |
| "이동 막힘" | 이어서 옮기지 못한 이동의 답과 "저장하고 열기" |
| "실패" | `ToolCallLine status="failed"`와 `ChatError` "연결이 끊겼어요" |
| "글에서 요청" | "글 엶"에 입력 상자의 글 "더 짧게 다듬어 줘. 말투는 그대로." |
| "맡기기" | "둘 다 골라 줘" 답, 입력 상자의 긴 요청과 `Chip` "고른 글 2편" |
| "제안 카드" | 여러 묶음 `ProposalCard`와 `ProposalActions` |
| "적용됨" | 같은 카드의 `ProposalResult`와 못 한 항목 |
| "대체 텍스트" | `ChatMessage request`와 파일 `ProposalCard` |
| "설정 제안" | 설정 제안의 도구 줄과 답 |
| "스키마 변경" | 스키마 제안의 도구 줄과 답("저장하면 PR로 올라가요") |
| "키 없음" | 키가 없을 때의 줄과 "API 키 넣기". 입력 상자 없음 |
| "모델 고르기" | `ModelMenu` 열림 |
| "생각 고르기" | `ModelMenu`의 "생각 ›" 둘째 단계 열림 |
| "생각 높음" | `ModelMenuButton`에 "· 생각 높음" |
| "생각 없는 모델" | 다른 모델에 ✓, "생각" 행과 버튼의 "· 생각"이 없음 |
| "크레딧 부족" | 내 말 아래 `ChatError` "Anthropic 크레딧이 부족해요" |
| "지난 대화" | 머리 `back`, `ConversationList`, 발의 `FilterButton`. 입력 상자 없음 |
| "다시 연 대화" | `ChatDate`, 지운 제안 카드, 모델 "claude-opus-5-5 · 생각 높음" |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 어시스턴트 · 제안 검토 (ProposalReview)

- 보드: `ProposalReview.dc.html`. 상태와 흐름 단계: [screens.md › ProposalReview](../screens.md#proposalreview).
- 공통 틀: [common.md](common.md)의 사이드바, 페이지 단(`PageColumn width="content"`), 제목 행, ✦ 어시스턴트 열기. 사이드바에서 고른 행은 없다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "‹ 어시스턴트" | `PageHeader trail`에 `TextButton variant="quiet"` | 어시스턴트 대화로 돌아간다. |
| 제목 행 | `PageHeader`(`title` "제안 검토", `meta` mono 날짜) |  |
| 오른쪽 (검토) | `TextButton variant="quiet"` "버리기", `Button variant="primary"` "17건 적용"(번역은 "3편 적용") | 넣은 항목만 적용한다. |
| 오른쪽 (적용 중) | `Text variant="note"` "적용 중", `Count` "9 / 17", `Progress inline` | 알약 자리를 차지한다. |
| 오른쪽 (결과) | `Text variant="note"` "✓ 16건 적용" · "1건 못 함", `Button variant="secondary"` "모두 되돌리기" |  |
| 요청 | `ReviewQuote` | 따옴표로 인용한 요청. |
| 묶음 | `ReviewGroup`(`title` "다듬기", `meta` "발행 후 고친 글 · 3곳 · 되돌릴 수 있음", `actions`) | 묶음 전체의 일은 `actions`: `TextButton variant="underline"` "편집기에서 보기", `Separator orientation="vertical" length="control"`, 보기 전환 "한 줄 · 나란히"(`Tabs` + `TabsList variant="line"`), 또는 `TextButton` "11편 모두 빼기", "모두 펼치기". |
| 항목 (한 줄) | `ReviewItem`(`included`, `onIncludedChange`, `includeLabel` "포함", `title`, `path` mono, `end` 필드나 결과, `children`에 `Del` · `Ins`) | 체크로 넣고 뺀다. `end`: "요약", "폴더 없음 → 2024", 결과 뒤 "✓ 2024로 옮김"이나 빨간 "못 옮김 · 그 사이 휴지통으로 감". 체크는 `ReviewItem`이 그린다. |
| 그사이 바뀐 항목 | `ReviewItem muted`, `end`에 "이 사이에 고쳐짐"과 `TextButton variant="underline"` "다시 만들기" | 체크가 빠지고 흐려진다. |
| 나란히 | `ReviewCompareHead`("지금 / 제안"), 항목마다 `ReviewCompare`(`label` "문단 2", `note`에 `Count tone="warning"` "거의 다시 씀", `before`, `after`) |  |
| 긴 묶음 | `ReviewMore`(`moreLabel` "6편 더 보기", `lessLabel` "접기") | 다섯 줄이 넘을 때. |
| 번역 묶음의 항목 | `ReviewItem`(`end`에 `Count` "블록 8 · 원문 유지 1", 흐린 블록 수는 경고 톤) + `Collapsible`(`CollapsibleTrigger`에 `Caret solo`, `CollapsibleContent`) | 펼치면 `ReviewCompareHead`("원문 · 한국어 / 번역 · English")와 블록마다 `ReviewCompare`(번역 글은 `Fill`, 원문 유지 블록은 `label`에 `Marker tone="keep"`), 끝에 `ReviewMore` "블록 4개 더". 펼침 표시는 `Caret solo`다(보드 첫 항목의 글자 ▴는 이것으로 맞춘다). |
| 결과 뒤의 체크 | `ReviewItem readOnly` | 회색 체크, 바꿀 수 없다. |

### 상태

| 상태 · prop | 더해지는 것 |
|---|---|
| `view` "한 줄" | 다듬기 묶음이 `ReviewItem` + `Del` · `Ins` |
| `view` "나란히" | 다듬기 묶음이 `ReviewCompareHead` + `ReviewCompare` |
| `stage` "검토" | "버리기"와 적용 알약, "11편 모두 빼기" |
| `stage` "적용 중" | `Count` "9 / 17"과 `Progress inline` |
| `stage` "결과" | 적용 수, 못 한 수, "모두 되돌리기", 체크는 `readOnly`, 항목 결과 |
| `kind` "여러 작업" | 다듬기 · 요약 채우기 · 2024 폴더로 옮기기 · 휴지통으로 보내기 묶음 |
| `kind` "번역" | 번역 · English 묶음 하나, 글마다 펼치는 항목 |
| `withRail` | ✦ 어시스턴트 열기 |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 어시스턴트 · 제안 검토 · 나란히 (ProposalReviewSide)

- 보드: `ProposalReviewSide.dc.html`. 상태와 흐름 단계: [screens.md › ProposalReviewSide](../screens.md#proposalreviewside).

ProposalReview를 `view` "나란히"로 가져다 쓴 보드다. 자리와 부품은 위 ProposalReview와 같다. 상태 prop은 없다.

