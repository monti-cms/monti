# 번역 화면

번역 편집기와 원문 나란히 보기다. 부품 규칙은 [translation.md](../components/translation.md)에 있다.

## 글 편집기 · 번역 (EditorTranslate)

- 보드: `EditorTranslate.dc.html`. 상태와 흐름 단계: [screens.md › EditorTranslate](../screens.md#editortranslate).
- 공통 틀: [common.md](common.md)의 ✦ 어시스턴트 열기, 토스트, 알림 띠, 메뉴. 머리 줄, 블록 손잡이, 속성 패널, 상태 표시줄 틀은 [editor.md](editor.md)와 같다. 아래에는 번역에서 다른 것만 적는다.

### 기본 틀

#### 머리 줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 주소 `/en/first-post` | `Text variant="meta" tone="faint"` | 번역 글의 주소. 읽기만 한다. |
| 발행 상태 | `EntryStatus` | 이 언어 글의 상태(초안 · 발행됨 · 수정 중). |
| "저장" · "미리보기" · "발행하기 ▾" · 속성 | [editor.md](editor.md)의 머리 줄과 같다 | 발행은 흐린 블록이 남아 있으면 막힌다(할 일로 알린다). 라벨은 "저장". 단축키는 툴팁에만 있다. 보드의 "⌘S"는 [button.md](../components/button.md)를 따라 뺀다. |
| ⋯ | `IconButton` + `DropdownMenu` | 행: "AI가 바꾼 기록"(활동 기록으로 간다) · "내보내기" │ "이 번역 휴지통으로"(`variant="danger"`, 아래 줄 "한국어 원문은 그대로"). 보드는 "이 번역 휴지통으로"를 보통 행으로 그렸다. 메뉴 규칙을 따라 맨 아래 위험 행으로 둔다. |

#### 글 단

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 언어 탭 | `TabLinks` + `TabLink`, 원문이 바뀐 언어는 `ChangeDot` | [editor.md](editor.md)와 같다. "+ 언어"도 같다. |
| "✦ 번역" (탭 줄 오른쪽) | `TextButton tone="proposal"`(`Spark`) 뒤에 `Separator orientation="vertical" length="control"` | 흐린 블록이 남아 있을 때만 보인다. 남은 흐린 블록을 모두 번역한다. |
| 원문 보기 "끔 · 옆 창 · 나란히" | 앞에 `Text variant="note"` "원문", 그 뒤 `Segmented size="sm" inline` | "나란히"는 나란히 보기(TranslatePaired)로 바꾼다. |
| 제목 | [editor.md](editor.md)의 제목 칸 | 흐린 동안에는 `Untranslated` 안의 원문 글. 치면 흐림이 사라진다. |
| 흐린 블록 | `Untranslated` | 아직 정하지 않은 블록. 원문이 옅게 깔려 있다. 발행되지 않는다. 블록마다 보고 정한다. |
| 흐린 블록의 메뉴 | `BlockHandle` + `DropdownMenu`: `DropdownMenuItem` "✦ 번역"(`Spark`) · "원문 유지" │ `DropdownMenuSeparator` │ "지우기" | 블록마다 셋 중 하나를 고른다. |
| "원문 유지" 표시 | `Marker tone="keep" margin` "원문" | 왼쪽 여백에 붙는다. |
| 번역 제안 (블록이 비었을 때 채운 것) | `Fill` | 바탕 없는 파란 글자. 받거나 버리기는 버블에서. |
| 다시 번역한 제안 | `CurrentProposal` 안에 `Del` · `Ins` | 바뀐 블록의 새 번역. |
| 원문 바뀜 표시 | `Marker tone="changed" margin` "바뀜" · "새로" · "지워짐"(카드가 열리면 `active`) | "바뀜"을 누르면 카드가 열린다. "새로"는 흐린 블록(`Untranslated`)으로 들어온다. "지워짐"은 블록 메뉴로 지우거나 둔다. |
| 바뀜 카드 | `MemoCardPopover`의 `MemoCard`(`where` "원문 바뀜", `discardLabel` "확인", `acceptLabel` "다시 번역", `acceptSpark`) 안에 `MemoDiff`(`beforeLabel` "전", `afterLabel` "후") | 머리에 "확인" · [✦ 다시 번역]. 바뀐 말은 `Highlight`. 바깥을 누르거나 Esc로 닫는다. |
| 제안 버블 | `ProposalBubbleDock` 안에 `ProposalBubble`(`name` "번역" 또는 "다시 번역", `position`, `total`) | 버블에는 이전 · 다음, "모두 버리기", [모두 받기]만 있다. |

#### 상태 표시줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "할 일 N" | `StatusBarCell` + `StatusBarList`(`TodoItem blocking` "흐린 블록 1" + 끝 동작 "✦ 번역"은 `proposal`, 아래 `TodoDone` "제목 · 주소 · 원문 유지 1") | 흐린 블록이 발행을 막는 할 일이다. 행을 누르면 그 블록으로 간다. 제안이 도착한 동안 칸은 "제안 6". |
| "원문 바뀜 3" | `StatusBarCell tone="warning"` + `StatusBarList`(`TodoItem`마다 `marker`로 `Marker tone="changed"`, 끝 동작 "✦ 다시 번역" · "✦ 번역" · "지우기", `footer`에 `TextButton` "모두 확인") | 발행을 막지 않는 알림이라 할 일과 다른 칸이다. 할 일 칸과 따로 있는 칸이다. |
| 글자 수 | [editor.md](editor.md)와 같다 | 흐린 동안 "0자". |

스토리: Primitives/Text, Controls/Status/EntryStatus, Controls/Button/IconButton, Controls/Menu/DropdownMenu, Controls/Tabs/Tabs, Controls/Status/ChangeDot, Controls/Button/TextButton, Primitives/AI mark, Primitives/Separator, Controls/Choice/Segmented, Monti/Translation/Marks, Monti/EditorTools/BlockHandle, Monti/Proposal/Marks, Monti/Proposal/MemoCard, Monti/Proposal/ProposalBubble, Patterns/Frame/StatusBar, Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem, Patterns/Frame/Banner, Patterns/Frame/ResizablePane, Primitives/Box.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 알림 띠

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 원문이 바뀜 | `Banner`(`title` "원문이 바뀌었어요", `meta` "10. 26 · 3곳") | 끝에 `TextButton` "모두 확인"이 바뀜 표시를 한 번에 모두 확인한다. 바뀐 블록은 블록마다 "바뀜" 표시의 카드로 본다. |

#### 원문 옆 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 창 | `ResizablePane` 안의 `Box background="tool"` | 원문 보기가 "옆 창"일 때 왼쪽에 도구 바탕으로 원문을 놓는다. 위에 "한국어 원문 · 읽기 전용"(`Text variant="meta"`), 제목은 `Heading variant="display"`, 본문은 읽기 크기. 고칠 수 없다. 원문은 글로만 보인다. |
| 원문에서 바뀐 말 | `Highlight` | 원문이 바뀐 동안 새 글에 강조 바탕. |

### 흐름 3 · 번역

단계: 3.02, 3.03, 3.04, 3.06, 3.07, 3.09, 3.10, 3.11, 3.15. 단계마다 보이는 것은 [flows/03-translation.md](../flows/03-translation.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "새 번역" | 3.02 | 제목과 모든 블록이 `Untranslated`, "✦ 번역" 버튼, 할 일 칸 "할 일 1" | Monti/Translation/Marks |
| `stage` "번역 제안" | 3.03 | 블록이 `Fill`, `ProposalBubble`("번역", 1 / 6), 할 일 칸 "제안 6" | Monti/Proposal/Marks, Monti/Proposal/ProposalBubble |
| `stage` "블록 고르기" | 3.04 | 흐린 블록 둘, 그중 하나에 `BlockHandle`과 흐린 블록 메뉴 | Monti/EditorTools/BlockHandle |
| `stage` "발행 막힘" | 3.06 | 흐린 블록 하나, 할 일 `StatusBarList` 열림, `toast.error`와 "이동" | Patterns/Frame/StatusBarList, Controls/Status/Toast |
| `stage` "발행됨" | 3.07 | "원문 유지" `Marker`, `EntryStatus` 발행됨, `toast` "발행되었어요"와 "보기" | Monti/Translation/Marks, Controls/Status/EntryStatus, Controls/Status/Toast |
| `stage` "원문 바뀜" | 3.09 | 원문 바뀜 `Banner`, 언어 탭 `ChangeDot`, 원문 창의 `Highlight`, 블록마다 `Marker tone="changed"`, "원문 바뀜" `StatusBarList` 열림 | Patterns/Frame/Banner, Controls/Status/ChangeDot, Monti/Proposal/Marks, Monti/Translation/Marks, Patterns/Frame/StatusBarList |
| `stage` "바뀜 카드" | 3.10 | "바뀜" `Marker active`와 `MemoCard` + `MemoDiff` | Monti/Translation/Marks, Monti/Proposal/MemoCard |
| `stage` "다시 번역" | 3.11 | 바뀐 블록이 `CurrentProposal` + `Del` · `Ins`, `ProposalBubble`("다시 번역", 1 / 1), `EntryStatus` 수정 중 | Monti/Proposal/Marks, Monti/Proposal/ProposalBubble, Controls/Status/EntryStatus |
| `stage` "번역 지우기" | 3.15 | ⋯ `DropdownMenu` 열림 | Controls/Menu/DropdownMenu |

### 보드의 이름을 부품으로

- `.mt-tool` 원문 옆 창: `ResizablePane` 안의 `Box background="tool"`.
- `.mt-doc-callout`, `.mt-doc-code`, `.mt-doc-table` 본문 블록: 블록 패키지가 편집기에 그리는 블록 그대로.

## 번역 · 원문 나란히 (TranslatePaired)

- 보드: `TranslatePaired.dc.html`. 상태와 흐름 단계: [screens.md › TranslatePaired](../screens.md#translatepaired).
- 공통 틀: [common.md](common.md). 머리 줄과 상태 표시줄은 위 EditorTranslate와 같다.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 언어 탭 | `TabLinks` + `TabLink` | EditorTranslate와 같다. 보드는 여기만 창 맨 위 탭(`.mt-tabs--bar`)으로 그렸다. 편집기의 언어 탭과 같은 부품으로 맞춘다. |
| 원문 보기 | `Segmented size="sm" inline`, "나란히"가 골라짐 | "끔"과 "옆 창"은 EditorTranslate로 돌아간다. |
| 머리 행 (원문 · 한국어 · 10. 26 수정 / 번역 · English · 09. 20 수정) | `CompareRows`의 첫 행 `CompareRow head` | 양쪽 이름은 잉크 선 아래 mono 작은 줄. |
| 블록 한 행 | `CompareRow`(`name` 블록 종류, `source` 원문, `translation` 번역) | 원문은 도구 바탕이고 고칠 수 없다. 번역 칸은 편집기와 같은 블록이고 그 자리에서 쓴다. 쓰고 있는 행은 `current`. 원문 칸은 글로만 보인다. |
| 제목 행 | `CompareRow title` 안에 `Heading variant="page"` 둘 | 번역 제목은 그 자리에서 고친다. |
| 여백의 상태 "원문 바뀜" · "원문에 추가" | `CompareRow`의 `note` | 둘 다 주황. 원문 쪽 바뀐 말은 `Highlight`. |
| 이미지 블록의 캡션과 대체 텍스트 | 원문 칸은 `Label` + `Text`, 번역 칸은 `FormField` 안에 `Input`(번역 안 한 값은 플레이스홀더 "아직 번역하지 않았어요") | 번역 칸은 늘 입력 칸이다. 그림은 원문과 같은 파일. |
| 코드 블록의 번역 칸 | `CompareShared`(children 원문 블록 `CompareCode`, `action` `TextButton variant="underline"` "English에서만 따로 고치기") | 원문 블록이 흐린 글자로 보인다. 누르는 순간 이 언어용 사본을 만든다. |
| 흐린 블록 | `Untranslated` | EditorTranslate와 같다. |
| 상태 표시줄 | "할 일 1", 글자 수 | EditorTranslate와 같다. |

스토리: Controls/Tabs/Tabs, Controls/Choice/Segmented, Monti/Change/Compare, Monti/Proposal/Marks, Primitives/Text, Primitives/Label, Controls/Field/Field, Controls/Field/Input, Controls/Button/TextButton, Monti/Translation/Marks.

### 흐름 3 · 번역

단계: 3.05. 단계마다 보이는 것은 [flows/03-translation.md](../flows/03-translation.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| (상태 prop 없음) | 3.05 | 한 화면뿐이다. 바뀐 문단, 원문에 더해진 문단, 이미지, 코드, 표, 목록을 한 번에 보인다. |  |

### 보드의 이름을 부품으로

- `.mt-pair` 짝 행: `CompareRows`와 `CompareRow`(`head`, `name`, `note`, `current`). 제목 행(`.mt-pair--title`)은 `CompareRow title`이다.
- `.mt-src-changed` 원문에서 바뀐 말: `Highlight`.
- `.mt-shared` 원문과 같음: `CompareShared`. 원문 블록을 흐린 글자로, 아래 "English에서만 따로 고치기" `TextButton`.
- 본문 블록: 블록 패키지의 블록 그대로.
