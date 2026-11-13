# 글 편집기 · 제안과 비교

## 글 편집기 · AI 제안 (EditorProposal)

- 보드: `EditorProposal.dc.html`. 상태와 흐름 단계: [screens.md › EditorProposal](../screens.md#editorproposal).
- 공통 틀: 머리 줄, 언어 탭, 제목, 본문 블록, 속성 패널의 틀, 상태 표시줄은 [editor.md](editor.md)와 같다. 여기에는 제안이 더하는 자리만 적는다. 보드의 머리 "저장 ⌘S"도 editor.md를 따라 라벨 "저장"이다.

### 기본 틀

#### 본문의 제안

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 보고 있는 제안의 선 | `CurrentProposal` | 지금 가리킨 제안이 다루는 블록의 왼쪽 여백에 파란 세로선. |
| 빠지는 글자 | `Del` | 파란 취소선. 문단 전체가 빠지면 문단 전체를 감싼다. |
| 들어오는 글자 | `Ins` | 옅은 파란 바탕, 파란 글자. |
| 요청 표시 "✦ 1" | `EditorMargin` 안 `Marker tone="request"`(카드가 열리면 `active`. 이름 "제안: (요청의 말)", 고른 글자의 요청은 "요청") | 본문에 그려진 제안마다, 그리고 고른 글자에 남긴 요청마다 그 블록 왼쪽 여백에 선다(그 사이 고쳐진 제안의 표시, 번역의 표시와 같은 자리이고, 한 블록에 여럿이면 4px 띄워 나란히 선다). 수는 그 자리에서 한 요청의 수다. 누르면 그 블록 아래에 메모 카드가 열리고 다시 누르면 닫힌다. 어시스턴트가 고치는 동안 개수 대신 "…"가 보인다. 포커스 고리는 표시 안쪽에 그린다(글 단의 스크롤 가장자리에 서기 때문이다). |
| 요청이 걸린 글자 | `RequestAnchor`의 모양(`PROPOSAL_MARK_CLASSES.anchor`) | 요청을 단 평범한 본문 글 아래에 파란 점선 밑줄을 긋는다. 바탕은 없다. AI가 넣은 글자(`Ins`의 파란 바탕)로 보이지 않게 하려는 것이다. 편집기 본문은 이 모양을 decoration 클래스로 입힌다. 보드의 베이지 바탕 대신이다(2026-11-04 소유자 결정). |
| 메모 카드 (기다리는 제안) | `MemoCardPopover`(`anchor` 그 블록, `onDiscard` "버리기", `onAccept` "받기", `reply` "이어서 요청"), 안에 `MemoThread` + `MemoMessage`("나", 어시스턴트는 `ai`) | 머리에 "버리기"와 검은 알약 "받기"가 늘 있고 그 제안 하나만 다룬다. 대화는 그 요청의 말과, 이 자리에서 이어 한 요청과 답이다. 카드는 그 글자 바로 아래에 붙으므로 `where`는 비운다. 바깥, Esc, 표시를 다시 누르면 닫힌다. 열려도 포커스는 글에 남는다. 어시스턴트가 없는 사이트에는 입력 줄이 없다. |
| 메모 카드 (보내기 전) | `MemoCardPopover`(`reply` "어시스턴트에게 요청", `reply.focus`) | 방금 고른 글자에 대한 요청이다(서식 카드의 "✦ 요청", ⌘J). 머리와 대화 없이 입력 줄 하나만 있고 커서가 그 안에 있다. 아무것도 보내지 않고 닫으면 표시와 밑줄이 사라진다. |
| 메모 카드 (고치는 중) | `MemoCardPopover`(머리 없음), `MemoThread` + `MemoMessage ai`("고치는 중…"), `reply.stop` "멈추기" | 어시스턴트가 일하는 동안 보내기 버튼이 멈추기가 된다. |
| 메모 카드 (말뿐인 답) | `MemoCardPopover`(`onDiscard` "버리기", `reply` "이어서 요청"), `MemoThread`(가지 못한 요청은 그 아래 `Text variant="note" tone="danger"` 까닭 한 줄) | 고른 글자의 요청에 어시스턴트가 제안 없이 말로만 답했을 때다. 그 말이 카드에 남고, 버리면 표시와 밑줄이 사라진다. |
| 버블 | `ProposalBubbleDock` 안 `ProposalBubble`(`name` "더 짧게 다듬기", `position` 1, `total` 5, `previousLabel` · `nextLabel`, `discardAllLabel` "모두 버리기", `acceptAllLabel` "모두 받기") | 상태 표시줄 12px 위 가운데에 뜬다. 이름을 누르면 그 대화로 간다. 하나씩 받기와 버리기는 메모 카드에서 한다. |

#### 속성 패널의 제안

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제안이 있는 탭 | `PropertyPanel`의 `tabs`(`dot` "proposal") | 다른 탭에 제안이 있으면 탭 이름 뒤에 파란 점. 보드의 "SEO" 탭이 그렇다. |
| 제안을 기다리는 값 (요약, SEO 설명) | 그 입력칸(`Textarea size="md"`) 안에 제안 값, `proposal` | 제안은 입력칸 안의 파란 글자다. 바로 고칠 수 있고, 고치면 보통 색이 된다. 받기와 버리기는 버블과 메모 카드에서 한다. 버리면 옛 값으로 돌아간다. 보드는 `Del` + `Ins` 글자로 그렸지만 입력칸을 따른다(2026-11-03 소유자 결정). |
| 그 밖의 속성 | [editor.md](editor.md)의 속성 패널과 같다 | |

#### 상태 표시줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "할 일 2" | [editor.md](editor.md)의 "할 일 N" 칸 | |
| "요청 1 · 고치는 중 1" | `StatusBarCell` | 이 글의 자리에 남긴 요청 수(아직 제안이 되지 않은 요청, 답을 기다리는 "이어서 요청", 이 자리에서 한 요청이 있는 제안)와 고치는 중인 수. 남긴 요청이 없으면 칸이 없다. 고치는 중인 것이 없으면 "요청 1"만 선다. 누르면 다음 요청으로 가서 그 메모 카드를 연다. 스크린 리더 이름은 "요청 1개, 고치는 중 1개, 다음 요청 열기"(고치는 중이 없으면 "요청 1개, 다음 요청 열기"). |
| 글자 수 | `StatusBarSpacer` 뒤 `StatusBarCell end` | |

스토리: Monti/Proposal/Marks, Monti/Translation/Marks, Monti/Proposal/MemoCard, Monti/Proposal/ProposalBubble, Monti/Proposal/PropertyPanel, Controls/Field/Textarea, Patterns/Frame/StatusBar.

### 흐름 2 · 어시스턴트

단계: 2.08, 2.09. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `request` "고치는 중" | 2.08, 2.09 | 첫 문단의 기다리는 제안과 요청 표시 "1", 마지막 문단의 요청 표시 "…"(고치는 중), 상태 표시줄 "요청 1 · 고치는 중 1" |  |
| `memoCard` | 2.09 | `request` "고치는 중"일 때 첫 문단의 기다리는 제안 `MemoCardPopover`와 그 표시 `active` | Monti/Proposal/MemoCard |
| `panelTab` "기본" | 2.08, 2.09 | 속성 기본 탭, 요약 입력칸에 제안 값(`proposal`) |  |

## 글 편집기 · 비교 (EditorCompare)

- 보드: `EditorCompare.dc.html`. 상태와 흐름 단계: [screens.md › EditorCompare](../screens.md#editorcompare).
- 틀: 글 편집기와 같은 `StandalonePage`다. 알림 띠는 그 `banner` 자리에 선다.
- 공통 틀: 상태 표시줄은 없다. 제목이 무엇의 비교인지 말하고 "다른 곳 3"은 머리에 한 번만 있다(2026-11-05, 원칙 8). 편집기 주소에 `?compare=conflict`나 `?compare=draft`가 붙은 화면이고, 편집기의 저장하지 않은 입력은 그대로 남는다.

### 기본 틀

#### 머리 줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "‹ 편집기로" | `TextButton variant="quiet"`(앞 아이콘) | 비교하지 않고 편집기로 돌아간다. 같은 글의 같은 주소 안에서 보기만 바뀌므로 링크가 아니라 버튼이다. 키보드로 누르면 포커스는 쓰던 본문으로 간다(답 버튼들과 같다, `useFocusHandOff`). |
| 제목 "서버 최신본과 비교" · "임시 저장본과 비교" | `Text variant="title"` | 이 화면의 제목이다. |
| 주소 `/posts/first-post` | `Text variant="meta" tone="faint"` | 읽기만 한다. 비교할 글을 읽지 못해 띠("글을 불러오지 못했습니다 · 다시 시도")만 있는 동안에도 "편집기로", 제목과 함께 머리 줄에 있다. |
| "다른 곳 3" | `Text variant="note"` | 서로 다른 속성, 제목, 본문 블록의 수. |
| 구분선 | `Separator orientation="vertical" length="control"` | |
| 곁 동작 "서버 최신본 불러오기" · "버리기" | `TextButton` | 아래 주 동작의 칸에 적었다. |
| 주 동작 "내 입력으로 저장" · "불러오기" | `Button variant="primary"` | 화면의 검은 알약 하나. "내 입력으로 저장"은 서버 최신본을 다시 읽어 그 버전 위에 내가 바꾼 칸만 저장한다: 내가 건드리지 않은 칸은 서버 최신본의 값 그대로다. 저장되면 편집기로 돌아가고, 저장하는 동안 알약은 `loading`이다. 그 사이 또 저장됐거나 최신본을 읽지 못하면 비교 화면이 그대로 남는다. 곁 동작 "서버 최신본 불러오기"는 내 입력을 버리고 최신본을 편집기에 넣는다(읽지 못하면 비교가 남는다). 임시 저장본의 "불러오기"는 이 브라우저에 남은 입력을 편집기에 넣고, "버리기"는 그 입력을 지운다. |

#### 비교 본문

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 두 단 | `Compare` 안 `CompareSide` 둘(`label` "내 입력 · 저장 안 됨" · "서버 최신본 · v4 · 10:41 저장", 또는 "브라우저 임시 저장본 · 10. 26 10:12" · "서버 사본 · 10. 26 09:58") | 틈 없이 선 하나를 두고 나란히 놓는다. 높이는 화면 아래까지 채운다. |
| 다른 속성 "요약" | `CompareSide`의 `properties`에 `CompareProperty`(값이 없으면 `empty` "비어 있음") | 서로 다른 속성만 나열한다. |
| 두 쪽이 다른 선택지를 고른 조건부 필드(문서 19) | 같은 `CompareProperty`: 고르기(선택지 라벨로), 그 아래 그 쪽이 고른 선택지의 필드들 | 쪽마다 제 선택지의 필드만 보이고 통째로 다른 것으로 칠한다. "다른 곳"은 고르기 하나로 센다. 필드가 적은 쪽은 모자란 줄만큼 빈 자리(`CompareProperty blank`: 보이지 않고 자리만 차지한다)를 두어, 두 쪽의 제목과 본문이 같은 높이에서 시작한다. 만들며 정함 (2026-11-13). |
| 제목 | `CompareTitle` | 페이지 크기 글자. |
| 본문 | `CompareBody` 안 `CompareHeading`, `CompareParagraph`, 코드 블록은 `CompareCode` | 읽히는 모양 그대로(읽기 크기). |
| 다른 말 | `CompareText changed` | 양쪽 모두 같은 강조 바탕. 한쪽에만 있는 블록은 그 블록 전체가 `changed`다. |

스토리: Controls/Button/TextButton, Primitives/Text, Primitives/Separator, Controls/Button/Button, Monti/Change/Compare.

### 흐름 1 · 글 쓰고 발행하기

단계: 1.17, 1.19. 단계마다 보이는 것은 [flows/01-write-and-publish.md](../flows/01-write-and-publish.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `mode` "편집 충돌" | 1.17 | 제목 "서버 최신본과 비교", 왼쪽 "내 입력 · 저장 안 됨", 오른쪽 "서버 최신본 · v4 · 10:41 저장", 곁 동작 "서버 최신본 불러오기", 주 동작 "내 입력으로 저장" |  |
| `mode` "임시 저장본" | 1.19 | 제목 "임시 저장본과 비교", 왼쪽 "브라우저 임시 저장본 · 10. 26 10:12", 오른쪽 "서버 사본 · 10. 26 09:58", 곁 동작 "버리기", 주 동작 "불러오기" |  |
