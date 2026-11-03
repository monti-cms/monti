# 목록 화면

## 게시글 목록 (Main)

- 보드: `Main.dc.html`. 상태와 흐름 단계: [screens.md › Main](../screens.md#main).
- 공통 틀: [common.md](common.md)의 왼쪽 내비게이션(`Sidebar`, 자리는 [sidebar.md](sidebar.md)), 페이지 단(`PageColumn width="list"`), ✦ 어시스턴트 열기, 확인 질문, 토스트, 메뉴, 행 오른쪽 클릭.

### 자리

#### 제목 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 행 | `PageHeader`(`title` "게시글", `meta` "/posts/:slug") | 폴더 안에서는 `title`이 폴더 이름이고 `meta`가 없다. |
| 폴더 경로 "게시글 /" | `PageHeader`의 `trail`에 `TextButton variant="underline"` | 지나온 폴더마다 버튼 하나. 누르면 그 폴더로 간다. |
| "+ 폴더" | `TextButton` | 누르면 그 자리에서 맨 위 폴더 행에 새 폴더가 생기고 이름 칸이 열린다(아래 "새 폴더"). 검색이나 필터가 걸려 있으면 먼저 지운다. |
| "검색" | `SearchToggle`(`label` "검색", `targets` 전체 · 제목 · 주소 · 본문) | 누르면 그 자리에서 `SearchBox`가 열리고 검색어에 포커스. 비우고 벗어나거나 비우고 Esc면 다시 버튼. 검색어는 상자 안에만 있다. |
| 찾을 곳 "전체 ▾" | `SearchBox`의 `targets` · `target` · `onTargetChange` | 상자 앞부분에 있다. 고르면 바로 적용, 지금 값에 ✓. |
| "+ 새 글 쓰기" | `Button variant="primary"` | 화면의 검은 알약 하나. 새 글 편집기로 간다. |

#### 찾는 곳 행 (폴더 안 검색, 어시스턴트가 건 필터)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 행 | `PageToolbar inset` | 폴더 안에서 검색할 때와 어시스턴트가 필터를 걸었을 때만 있다. 사람이 건 필터는 열 이름 뒤의 점으로만 보인다. |
| "시리즈 원고 · 모든 폴더" | `Segmented size="sm" inline`(이름 "찾는 곳"), 뒤에 `Separator orientation="vertical" length="control"` | 폴더 안에서만 있다. "모든 폴더"는 주소에 `scope=all`. |
| AI가 건 필터 "✦ 요약 비어 있음 ×" | `Chip proposal`(`onRemove`, `removeLabel` "필터 지우기") | ✦와 파랑은 `Chip`이 그린다. 바꾸거나 지우면 AI 표시가 끝난다. |

#### 열 이름 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 열 이름 행 | `ListHead`(`columns`, `end`, `selectAll`, `add`, `moveLabel`, `onPlace`, `onStep`, `onPreview`) | `columns`의 열마다 `id`, `label`, `size`, `sort`, `filtered`, `menu`. 필터, 정렬, 열 숨기기는 모두 이름을 누르면 열리는 그 열의 메뉴에서 한다. 필터가 걸린 열은 `filtered`로 점, 정렬된 열은 `sort`로 화살표. |
| 모두 선택 | `ListHead`의 `selectAll`(`state` `none`·`some`·`all`) | 포인터가 머리 위에 있을 때 보인다. 지금 쪽만 고른다. |
| 열 메뉴의 정렬 (제목, 날짜) | `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` | 제목은 "오름차순 · 내림차순", 날짜는 "최근부터 · 오래전부터". 고르면 닫힌다. |
| 열 메뉴의 거를 값 | `DropdownMenuCheckboxItem box`, 끝에 개수 `MenuShortcut` | 상태: 발행됨 · 수정 중 · 초안 · 보관됨. 관계(카테고리, 태그): 맨 위 `DropdownMenuSearch`, "없음", `DropdownMenuSeparator`, 항목(많으면 `DropdownMenuScroll`). 언어: 언어들, 구분선, `DropdownMenuLabel` "번역", 번역 없음 · 원문 바뀜 · 최신. 텍스트 필드(검색 설명): "비어 있음" 하나. 골라도 메뉴는 열려 있다. |
| 날짜 열의 거를 값 | `DropdownMenuRadioItem`(오늘 · 최근 7일 · 최근 30일 · 기간 고르기) | 한 번에 하나. "기간 고르기"는 옆에 달력을 연다. |
| 기간 달력 | `Popover`의 `PopoverContent padding="none"` 안에 `Calendar`(기간) | 처음 누른 날이 시작, 다음 날이 끝. 끝을 누르면 적용하고, 달력은 기간을 보이며 열려 있다. |
| "열 숨기기" | `DropdownMenuItem` | 거를 값 아래, 구분선 뒤. 제목 열에는 없다. |
| 열 추가 + | `ListHead`의 `add`(`label` "열 추가", `columns`는 숨긴 열, `onAdd`) | 숨긴 열만 체크 없이 나열한다. 고르면 그 열이 생기고 목록에서 빠진다. 숨긴 열이 없으면 +도 없다. |
| 열 옮기기 | `ListHead`의 `onPlace` · `onStep` · `onPreview` | 이름을 끌면 들려서 따라오고 다른 열이 비켜난다. 놓으면 저장. 키보드는 Alt + ←→. |

#### 일괄 막대 (행을 고른 동안, 열 이름 행 자리)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 막대 | `BulkBar`(`label` "2개 선택", `selectAll`, `request`, `more`, `clearLabel` "선택 해제", `onClear`, `colSpan`) | 열 이름 행과 같은 40px 자리에 온다. 다 풀면 열 이름이 돌아온다. 모든 컬렉션에서 같은 막대다. |
| "✦ 요청" | `BulkBar`의 `request` | 고른 글을 담아 어시스턴트에게 묻는다. |
| "발행" | `TextButton` | 고른 행 중 발행할 것(초안, 수정 중)이 있을 때만 보인다. |
| "보관" / "보관 풀기" | `TextButton` | 모두 보관됐으면 "보관 풀기". |
| "폴더로 ▾" | `TextButton` + `Caret`, `DropdownMenu`(최상위와 폴더 트리, 지금 값 `MenuTick`) | 고르면 옮기고 닫힌다. |
| "바꾸기 ▾" | `TextButton` + `Caret`, `DropdownMenu` 첫 단계는 관계 필드마다 `DropdownMenuSub` | 스키마의 관계 필드는 모두 이 메뉴 하나에 있다. 값 여럿(태그): `DropdownMenuSearch`와 `DropdownMenuCheckboxItem box`(모두 가짐은 켬, 일부는 `mixed`와 끝의 "1/2" `MenuShortcut`), 메뉴는 열려 있다. 값 하나(카테고리): `DropdownMenuRadioGroup`, 필수가 아니면 맨 위 "없음", 고르면 닫힌다. |
| ⋯ | `BulkBar`의 `more` | "내보내기", 구분선, "휴지통으로"(`variant="danger"`). |

#### 표

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 표 | `ListScroll` 안의 `Table`(`TableBody`, `TableRow`, `TableCell`) | 고른 행은 `TableRow selected`, 어시스턴트가 고른 행은 `proposal`도. 오른쪽 클릭 메뉴가 열린 동안 그 행은 호버 바탕을 유지한다. |
| 행 체크 | `RowCheck`(`checked`, `onCheckedChange`, `label` "고르기", 어시스턴트가 고른 행은 `proposal`과 이름 "AI가 고름") | 포인터가 행 위에 있을 때와 고른 행에만 보인다. |
| 상태 칸 | `EntryStatus quiet` | 발행됨도 조용한 색으로 적는다. |
| 제목 칸 | `RowLink` 안의 `RowTitle`(`title`, `address`) | 행 어디를 눌러도 글이 열린다. |
| 카테고리 · 태그 · 텍스트 필드 칸 | `Text variant="note" truncate`, 셀 `title`에 전부 | 끝은 늘 "…". |
| 언어 · 수정일 칸 | `Text variant="meta" mono tone="subtle"` | 언어는 "KO +1", 날짜는 "10. 26". |
| 행 ⋯ | `RowActions` 안의 `IconButton`(`label` "행 메뉴") + `DropdownMenu` | 늘 보인다. 항목은 오른쪽 클릭과 같다. 보드는 글자 버튼으로 그렸지만 [button.md](../components/button.md)의 아이콘 버튼을 따른다. |
| 행 오른쪽 클릭 | `ContextMenu`: "열기" · "새 탭에서 열기" · "복제" │ `ContextMenuSub` "폴더로" · "카테고리" · "태그" │ "보관" · "휴지통으로"(`variant="danger"`, `MenuShortcut` Del) | 행마다 앞에 아이콘. 둘째 단계까지. |
| 여러 행 오른쪽 클릭 | `ContextMenu`: `ContextMenuLabel` "2개 항목" · "발행" · "보관" · `ContextMenuSub` "폴더로" │ "카테고리" · "태그" │ "내보내기" │ "휴지통으로" | 일괄 막대와 같은 이름. 관계 필드가 바로 놓인다. 아이콘은 없다. 여러 행에 되는 것만 담는다. |
| 폴더 행 | 폴더 행 모양(아래 "빠진 부품"), 끝에 `IconButton` ⋯ | 상태 칸은 비운다. 16px 폴더 아이콘, 이름, "글 2". 누르면 폴더 안으로. |
| 폴더 오른쪽 클릭 | `ContextMenu`: "열기" · "이름 바꾸기" · `ContextMenuSub` "옮기기" │ "폴더 지우기"(`variant="danger"`) | |
| 새 폴더 · 이름 바꾸기 | `RenameField`(`value`, `onValueChange`, `onCommit`, `onCancel`, `label` "폴더 이름") | 행 안에서 "새 폴더"가 선택된 채 열린다. Enter나 벗어나면 지키고 Esc는 버린다. 행 높이가 변하지 않는다. |
| "상위 폴더로" | 폴더 행 모양 | 폴더 안의 첫 행. |

#### 표 아래 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 행 | `ListFooter` | 왼쪽 범위, 오른쪽 페이지 나누기. |
| 범위 "1–25 / 148" | `Count` | |
| "25개씩 ▾" | `PageSizeMenu`(`label`, `value`, `options` 25 · 50 · 100, `onValueChange`) | 위로 열리고 고르면 닫힌다. |
| 페이지 나누기 | `Pagination`(`PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`) | 늘 버튼 7개. 첫 쪽의 이전, 마지막 쪽의 다음은 흐리고 누를 수 없다. |

### 상태

| 상태 (`mode`) | 더해지는 것 |
|---|---|
| "처음 화면" | 기본 `ListHead`, 폴더 행, 글 행, `ListFooter`와 `Pagination` |
| "찾는 중" | `SearchBox`(검색어 "리액트"), 맞는 행만. 폴더 행과 페이지 나누기는 없다 |
| "여러 개 선택" | `BulkBar`가 `ListHead` 자리에, 고른 행 `TableRow selected` |
| "바꾸기 메뉴" | "바꾸기 ▾" `DropdownMenu`와 태그 `DropdownMenuSub`(검색, 세 상태 체크) |
| "어시스턴트가 거름" | `PageToolbar inset`에 `Chip proposal` "요약 비어 있음", 두 행 |
| "거른 뒤 선택" | 위에 더해 `BulkBar`, 두 행 `selected` |
| "AI가 고름" | `BulkBar`, 두 행 `TableRow selected proposal`과 `RowCheck proposal` |
| "상태 메뉴" | 상태 열 메뉴(`DropdownMenuCheckboxItem` 넷과 개수, "열 숨기기"), 상태 열 `filtered` |
| "여러 필터" | 상태 열과 수정일 열이 함께 `filtered`. 찾는 곳 행은 없다 |
| "태그 메뉴" | 태그 열 메뉴(`DropdownMenuSearch`, "없음", `DropdownMenuScroll`) |
| "언어 메뉴" | 언어 열 메뉴(언어, `DropdownMenuLabel` "번역", 번역 상태), 언어 열 `filtered` |
| "수정일 메뉴" | 수정일 열 메뉴(정렬과 기간 `DropdownMenuRadioItem`), `filtered` |
| "기간 고르기" | 날짜 메뉴 옆 `Calendar`, 시작 날만 |
| "기간 걸림" | `Calendar`가 기간을 보이며 열려 있음, 수정일 열 `filtered` |
| "검색 설명 메뉴" | +로 켠 검색 설명 열과 그 메뉴("비어 있음"), `filtered` |
| "제목 메뉴" | 제목 열 메뉴(오름차순 · 내림차순) |
| "제목 오름차순" | 메뉴 닫힘, 제목 열 `sort="asc"` |
| "열 추가" | `ListHead`의 `add` 메뉴(숨긴 열만) |
| "열 옮기는 중" | 들린 열 이름, 비켜난 열 |
| "쪽마다" | `PageSizeMenu` 열림 |
| "휴지통 확인" | `AlertDialog`("휴지통으로 옮길까요?", `AlertDialogAction` `variant="danger"` "휴지통으로") |
| "휴지통으로 옮김" | `toast` "휴지통으로 옮겼어요"와 `action` "되돌리기" |
| "행 메뉴" | 행 `ContextMenu`와 "폴더로" `ContextMenuSubContent`, 그 행은 호버 바탕 유지 |
| "여러 행 메뉴" | `BulkBar`와 여러 행 `ContextMenu`, 태그 둘째 단계(아래 "빠진 부품") |
| "폴더 우클릭" | 폴더 `ContextMenu`, 폴더 행 호버 바탕 유지 |
| "새 폴더" | 맨 위 새 폴더 행의 `RenameField` |
| "폴더 안" | `PageHeader`의 `trail` "게시글 /", 제목은 폴더 이름, "상위 폴더로" 행 |
| "폴더 안 검색" | `SearchBox`, 찾는 곳 행의 `Segmented` "시리즈 원고 · 모든 폴더" |
| "폴더 지우기 확인" | `AlertDialog`("시리즈 원고를 휴지통으로 옮길까요?"). 발행된 글이 든 폴더만 묻는다 |
| "폴더 지움" | `toast`("… 휴지통으로 옮겼어요", "되돌리기"), 사이드바에서 폴더가 빠진다 |
| "고른 글 내보냄" | `BulkBar`와 `toast` "2편을 내보냈어요" |
| "찾을 곳 고르기" | `SearchBox`의 찾을 곳 메뉴 열림(지금 값 ✓) |
| "주소로 찾음" | `SearchBox`(찾을 곳 "주소", 검색어 "-2"), 두 행 |
| `withRail` | 꺼지면 ✦ 어시스턴트 열기 버튼이 없다(어시스턴트 패널이 이미 열린 화면에서 가져다 쓸 때) |
| `dark` | 어두운 테마 |

### 빠진 부품

- **폴더 행** `.mt-row-folder`: 제목 칸 앞의 16px 폴더 아이콘, 8px 뒤 이름, 그 뒤 같은 줄의 개수("글 2", mono `fg-faint`). `RowTitle`은 주소를 제목 아래 줄에 두므로 맞지 않는다. "상위 폴더로" 행도 이 모양이다.
- **오른쪽 클릭 메뉴의 세 상태 체크와 검색** `.mt-menu--ctx` 안의 `.mt-menu-search`와 `.mt-check.is-mixed`: 여러 행 메뉴의 "태그 ▸"가 쓴다. `ContextMenu`에는 `DropdownMenuCheckboxItem mixed`와 `DropdownMenuSearch`에 해당하는 행이 없다.

## 빈 목록 (Empty)

- 보드: `Empty.dc.html`. 상태와 흐름 단계: [screens.md › Empty](../screens.md#empty).
- 공통 틀: [common.md](common.md)의 왼쪽 내비게이션, 페이지 단, ✦ 어시스턴트 열기.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 행 | `PageHeader`(`title` 컬렉션 이름, `meta` 주소 규칙), `children`에 `Button variant="primary"` "+ 새 글 쓰기"(메모는 "+ 새 메모 쓰기") | |
| 빈 상태 | `Empty`(`title` "아직 글이 없어요.") | 할 수 있는 일을 늘어놓는다. 상자는 없다. 보드의 둘째 줄 "어디서부터 시작할까요?"는 [list.md](../components/list.md)를 따라 뺀다(`description`은 단계로 말할 수 없을 때만). |
| 할 일 "첫 글 쓰기" · "쓰던 글 가져오기" · "템플릿으로 쓰기" | `EmptyStep`(`href`, 앱 링크는 `render`) | 각각 편집기, 도구 › 데이터, 도구 › 템플릿으로 간다. 이름은 선택지 크기, 끝에 화살표. 세 일은 고르는 것이라 보드의 번호 "01 · 02 · 03"은 [list.md](../components/list.md)를 따라 뺀다(`number`는 순서가 정말 있을 때만). |

### 상태

| 상태 (`collection`) | 더해지는 것 |
|---|---|
| "메모" | `title` "메모", `meta` "/notes/:slug", "아직 메모가 없어요.", "첫 메모 쓰기", 사이드바 현재 위치 메모 |
| "게시글" | `title` "게시글", `meta` "/posts/:slug", "아직 글이 없어요.", "첫 글 쓰기", 사이드바는 첫 방문 모양(`fresh`) |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 대화상자 (Dialogs)

- 보드: `Dialogs.dc.html`. 상태와 흐름 단계: [screens.md › Dialogs](../screens.md#dialogs).
- 공통 틀: [common.md](common.md)의 확인 질문과 작은 폼 창. 이 보드는 화면이 아니라 여러 화면이 여는 창 셋을 모은 견본이다.

### 자리

#### 고른 글 내보내기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 창 | `Dialog`(`DialogContent`, `DialogHeader`, `DialogTitle` "고른 글 2개 내보내기") | 목록의 일괄 막대 ⋯ › "내보내기"와 여러 행 메뉴가 연다. 입력이 둘뿐이라 창이다. |
| "보관 파일의 용도" | `FormFieldSet`과 `FormFieldLegend variant="field"`, `RadioGroup` + `RadioItem`("백업용" `description` "초안 포함", "공개용" `description` "발행본만") | 하나를 고른다. 기본은 백업용. |
| "담을 파일" | `FormFieldSet`과 `FormFieldLegend variant="field"`, 줄마다 `Option` + `Checkbox` | "JSON 문서"는 늘 담기므로 켠 채 바꿀 수 없다(`Checkbox readOnly`, 덧말 "항상 담겨요"). "MDX 파일"은 켜고 끈다(mono 메모 ".mdx"). |
| "담기는 것" | `Label`, 줄마다 `Inline justify="between"`에 `Text variant="note" tone="muted"`와 `Text variant="meta"` | 글과 분류 · 번역 · 폴더 · 주소 · 미디어 정보의 개수. 읽기만 한다. |
| 발 | `DialogFormFooter`("취소", "내보내기") | 내보내는 동안 알약은 `busyLabel`. |

#### 휴지통으로 옮길까요?

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 창 | `AlertDialog`(`AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription` "글 2개가 사이트에서 바로 내려가요.") | 발행된 글을 옮길 때만 묻는다. 초안은 곧바로 옮기고 토스트에 "되돌리기". |
| 발 | `AlertDialogFooter`: `AlertDialogCancel` "취소", `AlertDialogAction variant="danger"` "휴지통으로" | |

#### 저장하지 않은 변경이 있어요

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 창 | `AlertDialog`(`AlertDialogTitle` "저장하지 않은 변경이 있어요", `AlertDialogDescription` "10:42 백업은 이 브라우저에 남아 있어요.") | 편집기를 떠날 때 묻는다. |
| 발 | `AlertDialogCancel variant="danger"` "저장하지 않고 나가기", `AlertDialogAction` "저장하고 나가기"(primary) | 위험한 쪽은 빨간 글자 버튼, 검은 알약은 지키는 쪽이다. |

### 상태

| prop | 더해지는 것 |
|---|---|
| `dark` | 어두운 테마. 상태 prop은 없다. |

### 빠진 부품

- **520px 폼 창**: 내보내기 창은 보드에서 520px이다. `DialogContent`의 `size`는 `default`(420px), `lg`, `xl`뿐이다(`AlertDialogContent`에는 `size="wide"` 520px이 있다).
