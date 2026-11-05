# 목록 화면

## 게시글 목록 (Main)

- 보드: `Main.dc.html`. 상태와 흐름 단계: [screens.md › Main](../screens.md#main).
- 공통 틀: [common.md](common.md)의 왼쪽 내비게이션(`Sidebar`, 자리는 [sidebar.md](sidebar.md)), 페이지 단(`PageColumn width="list"`), ✦ 어시스턴트 열기, 확인 질문, 토스트, 메뉴, 행 오른쪽 클릭.

### 기본 틀

#### 제목 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 행 | `PageHeader`(`title` "게시글", `meta` "/posts/:slug") | 폴더 안에서는 `title`이 폴더 이름이고 `meta`가 없다. |
| 폴더 경로 "게시글 /" | `PageHeader`의 `trail`에 `TextButton variant="underline"` | 지나온 폴더마다 버튼 하나. 누르면 그 폴더로 간다. |
| "+ 새 글 쓰기 ▾" | `SplitButton`(`menuLabel` "더 만들기", `menu`에 `DropdownMenuItem` "새 폴더"(`FolderAdd`) · "가져오기"(`Upload`) · `DropdownMenuSub` "템플릿으로 쓰기"(`Template`, 둘째 단계에 템플릿마다 한 줄)) | 화면의 검은 알약 하나. 왼쪽은 새 글 편집기로 간다. "새 폴더"는 그 자리에서 맨 위 폴더 행에 새 폴더를 만들고 이름 칸을 연다(아래 "새 폴더"). 검색이나 필터가 걸려 있으면 먼저 지운다. "폴더 사용"을 끈 컬렉션에는 "새 폴더"가 없다. "가져오기"는 이 컬렉션에 글을 가져오는 시트를 연다([tools.md](tools.md)의 가져오기 시트). "템플릿으로 쓰기"는 고른 템플릿으로 새 글을 만들어 편집기로 간다(T40). 메뉴에 남는 줄이 없으면(새 폴더 07, 가져오기 14가 아직 없을 때, 템플릿도 없을 때) 나뉘지 않은 검은 알약 `Button`이다. (2026-11-05 소유자: 드물게 쓰는 일이라 버튼 대신 검은 알약의 메뉴에 둔다.) |
| "검색" | `SearchToggle`(`label` "검색", `targets` 제목·주소 · 전체, 처음 값은 제목·주소, `placeholder` "제목·주소 검색") | 누르면 그 자리에서 `SearchBox`가 열리고 검색어에 포커스. 비우고 벗어나거나 비우고 Esc면 다시 버튼. 검색어는 상자 안에만 있다. |
| 찾을 곳 "전체 ▾" | `SearchBox`의 `targets` · `target` · `onTargetChange` | 상자 앞부분에 있다. 고르면 바로 적용, 지금 값에 ✓. |

#### 열 이름 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 열 이름 행 | `ListHead`(`columns`, `end`, `selectAll`, `add`, `moveLabel`, `onPlace`, `onStep`, `onPreview`) | `columns`의 열마다 `id`, `label`, `size`, `sort`, `filtered`, `menu`. 필터, 정렬, 열 숨기기는 모두 이름을 누르면 열리는 그 열의 메뉴에서 한다. 필터가 걸린 열은 `filtered`로 점, 정렬된 열은 `sort`로 화살표. |
| 모두 선택 | `ListHead`의 `selectAll`(`state` `none`·`some`·`all`) | 포인터가 머리 위에 있을 때 보인다. 지금 쪽만 고른다. |
| 열 메뉴의 정렬 (제목, 날짜) | `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` | 제목은 "오름차순 · 내림차순", 날짜는 "최근부터 · 오래전부터". 고르면 닫힌다. |
| 열 메뉴의 거를 값 | `DropdownMenuCheckboxItem box`, 끝에 개수 `MenuShortcut` | 상태: 발행됨 · 수정 중 · 초안 · 보관됨. 관계(카테고리, 태그): 맨 위 `DropdownMenuSearch`, "없음", `DropdownMenuSeparator`, 항목(많으면 `DropdownMenuScroll`). 언어: 언어들, 구분선, `DropdownMenuLabel` "번역", 번역 없음 · 원문 바뀜 · 최신. 텍스트 필드(검색 설명): "비어 있음" 하나. 골라도 메뉴는 열려 있다. |
| 날짜 열의 거를 값 | `DropdownMenuRadioItem`(오늘 · 최근 7일 · 최근 30일 · 기간 고르기) | 한 번에 하나. "기간 고르기"는 옆에 달력을 연다. |
| 기간 달력 | 날짜 메뉴의 `DropdownMenuSub`, `DropdownMenuSubContent bare` 안에 `Calendar`(기간) | 처음 누른 날이 시작, 다음 날이 끝. 끝을 누르면 적용하고, 달력은 기간을 보이며 열려 있다. |
| "열 숨기기" | `DropdownMenuItem` | 거를 값 아래, 구분선 뒤. 제목 열에는 없다. |
| 열 추가 + | `ListHead`의 `add`(`label` "열 추가", `columns`는 숨긴 열, `onAdd`) | 숨긴 열만 체크 없이 나열한다. 고르면 그 열이 생기고 목록에서 빠진다. 숨긴 열이 없으면 +도 없다. |
| 열 옮기기 | `ListHead`의 `onPlace` · `onStep` · `onPreview` | 이름을 끌면 들려서 따라오고 다른 열이 비켜난다. 놓으면 저장. 키보드는 Alt + ←→. |

#### 표

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 표 | `ListScroll` 안의 `Table`(`TableBody`, `TableRow`, `TableCell`) | 고른 행은 `TableRow selected`, 어시스턴트가 고른 행은 `proposal`도. 오른쪽 클릭 메뉴가 열린 동안 그 행은 호버 바탕을 유지한다. |
| 행 체크 | `RowCheck`(`checked`, `onCheckedChange`, `label` "고르기", 어시스턴트가 고른 행은 `proposal`과 이름 "AI가 고름") | 포인터가 행 위에 있을 때와 고른 행에만 보인다. |
| 상태 칸 | `EntryStatus`, 발행됨만 `quiet` | 발행됨은 조용한 색, 수정 중과 초안은 제 색이다. |
| 제목 칸 | `RowLink` 안의 `RowTitle`(`title`, `address`) | 제목 뒤 같은 줄에 주소. 행 어디를 눌러도 글이 열린다. |
| 카테고리 · 태그 · 텍스트 필드 칸 | `TableCell tone="subtle" truncate`, 셀 `title`에 전부 | 끝은 늘 "…". 값 여럿은 " · "로 잇는다. |
| 언어 · 수정일 칸 | `Text mono variant="meta"`(날짜는 `tone="muted"`, 칸은 `align="end"`) | 언어는 "KO +1", 날짜는 올해면 "10. 26", 지난해면 "25. 10. 26". 기준 화면(`Screens/Reference/Lists` › Main)과 같다. |
| 행 ⋯ | `RowActions` 안의 `IconButton`(`label` "행 메뉴") + `DropdownMenu` | 늘 보인다. 항목은 오른쪽 클릭과 같다. 보드는 글자 버튼으로 그렸지만 [button.md](../components/button.md)의 아이콘 버튼을 따른다. |
| 행 오른쪽 클릭 | `ContextMenu`: "열기" · "새 탭에서 열기" · "복제" │ `ContextMenuSub` "폴더로" · "카테고리" · "태그" │ "보관" · "휴지통으로"(`variant="danger"`, `MenuShortcut` Del) | 행마다 앞에 아이콘. 둘째 단계까지. |
| 여러 행 오른쪽 클릭 | `ContextMenu`: `ContextMenuLabel` "2개 항목" · "발행" · "보관" · `ContextMenuSub` "폴더로" │ "카테고리" · "태그" │ "내보내기" │ "휴지통으로" | 일괄 막대와 같은 이름. 관계 필드가 바로 놓인다. 아이콘은 없다. 여러 행에 되는 것만 담는다. |
| 폴더 행 | `RowTitle folder`(`title` 폴더 이름, `address` "글 2"), 끝에 `IconButton` ⋯ | 상태 칸은 비운다. 누르면 폴더 안으로. "상위 폴더로" 행도 같다. |
| 폴더 오른쪽 클릭 | `ContextMenu`: "열기" · "이름 바꾸기" · `ContextMenuSub` "옮기기" │ "폴더 지우기"(`variant="danger"`) | |
| 새 폴더 · 이름 바꾸기 | `RenameField`(`value`, `onValueChange`, `onCommit`, `onCancel`, `label` "폴더 이름") | 행 안에서 "새 폴더"가 선택된 채 열린다. Enter나 벗어나면 지키고 Esc는 버린다. 행 높이가 변하지 않는다. |
| "상위 폴더로" | 폴더 행 모양 | 폴더 안의 첫 행. |

#### 표 아래 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 행 | `ListFooter` | 왼쪽 범위, 오른쪽 페이지 나누기. |
| 범위 "1–25 / 148" | `Count` | |
| "25개씩 ▾" | `PageSizeMenu`(`label`, `value`, `options` 25 · 50 · 100, `onValueChange`) | 위로 열리고 고르면 닫힌다. |
| 맞는 글 없음 | 표 안의 한 행: `Text tone="subtle"` "맞는 글이 없어요." 뒤에 `TextButton` "거르기 풀기" | 거르기나 찾기 때문에 행이 없을 때. 빈 컬렉션(아래 Empty)과 다르다(06번 문서, 빈 목록). "거르기 풀기"는 찾기와 거르기를 모두 푼다. |
| 페이지 나누기 | `Pagination`(`PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`) | 늘 버튼 7개. 첫 쪽의 이전, 마지막 쪽의 다음은 흐리고 누를 수 없다. 쪽이 하나뿐이면 페이지 나누기가 없다. |

스토리: Patterns/Frame/PageHeader, Controls/Button/TextButton, Controls/Field/SearchBox, Controls/Button/Button, Patterns/List/ListHead, Controls/Menu/DropdownMenu, Controls/Field/Calendar, Patterns/List/Table, Controls/Status/EntryStatus, Primitives/Text, Controls/Button/IconButton, Controls/Menu/ContextMenu, Patterns/List/RenameField, Patterns/List/Pagination, Controls/Status/Count, Controls/Choice/Segmented, Primitives/Separator, Patterns/List/BulkBar, Controls/Field/Caret.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 찾는 곳 행 (폴더 안 검색, 어시스턴트가 건 필터)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 행 | `PageToolbar inset` | 폴더 안에서 검색할 때와 어시스턴트가 필터를 걸었을 때만 있다. 사람이 건 필터는 열 이름 뒤의 점으로만 보인다. |
| "시리즈 원고 · 모든 폴더" | `Segmented size="sm" inline`(이름 "찾는 곳"), 뒤에 `Separator orientation="vertical" length="control"` | 폴더 안에서만 있다. "모든 폴더"는 주소에 `scope=all`. |
| AI가 건 필터 "✦ 요약 비어 있음 ×" | `Chip proposal`(`onRemove`, `removeLabel` "필터 지우기") | ✦와 파랑은 `Chip`이 그린다. 바꾸거나 지우면 AI 표시가 끝난다. |

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

### 흐름 1 · 글 쓰고 발행하기

단계: 1.01. 단계마다 보이는 것은 [flows/01-write-and-publish.md](../flows/01-write-and-publish.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "처음 화면" | 1.01 | 기본 `ListHead`, 폴더 행, 글 행, `ListFooter`와 `Pagination` | Patterns/List/ListHead, Patterns/List/Pagination |

### 흐름 2 · 어시스턴트

단계: 2.01, 2.02, 2.03, 2.10, 2.11, 2.16, 2.22, 2.23, 2.23b, 2.23c, 2.23d, 2.25, 2.26, 2.06, 2.24. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

함께 열리는 화면: `AssistantPanel`([assistant.md](assistant.md)).

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "처음 화면" | 2.01, 2.02, 2.22, 2.23, 2.23b, 2.23c, 2.23d, 2.25, 2.26, 2.06, 2.24 | 기본 `ListHead`, 폴더 행, 글 행, `ListFooter`와 `Pagination` | Patterns/List/ListHead, Patterns/List/Pagination |
| "어시스턴트가 거름" | 2.03, 2.11, 2.16 | `PageToolbar inset`에 `Chip proposal` "요약 비어 있음", 두 행 | Patterns/Frame/PageHeader |
| "AI가 고름" | 2.10 | `BulkBar`, 두 행 `TableRow selected proposal`과 `RowCheck proposal` | Patterns/List/BulkBar, Patterns/List/Table |
| `withRail` | 2.01, 2.02, 2.03, 2.10, 2.11, 2.16, 2.22, 2.23, 2.23b, 2.23c, 2.23d, 2.25, 2.26, 2.06, 2.24 | 꺼지면 ✦ 어시스턴트 열기 버튼이 없다(어시스턴트 패널이 이미 열린 화면에서 가져다 쓸 때) |  |

### 흐름 3 · 번역

단계: 3.12. 단계마다 보이는 것은 [flows/03-translation.md](../flows/03-translation.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "언어 메뉴" | 3.12 | 언어 열 메뉴(언어, `DropdownMenuLabel` "번역", 번역 상태), 언어 열 `filtered` | Controls/Menu/DropdownMenu |

### 흐름 5 · 휴지통

단계: 5.01, 5.02, 5.03, 5.04, 5.05, 5.06, 5.07, 5.08, 5.09, 5.10. 단계마다 보이는 것은 [flows/05-trash.md](../flows/05-trash.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "휴지통 확인" | 5.10 | `AlertDialog`("휴지통으로 옮길까요?", `AlertDialogAction` `variant="danger"` "휴지통으로") | Controls/Overlay/AlertDialog |
| "휴지통으로 옮김" | 5.09 | `toast` "휴지통으로 옮겼어요"와 `action` "되돌리기" | Controls/Status/Toast |
| "행 메뉴" | 5.07 | 행 `ContextMenu`와 "폴더로" `ContextMenuSubContent`, 그 행은 호버 바탕 유지 | Controls/Menu/ContextMenu |
| "여러 행 메뉴" | 5.08 | `BulkBar`와 여러 행 `ContextMenu`, 태그 둘째 단계(`DropdownMenuSearch`와 `DropdownMenuCheckboxItem box`, 일부 글에만 있는 태그는 `mixed`와 `MenuShortcut` "1/2") | Patterns/List/BulkBar, Controls/Menu/ContextMenu › SeveralTags |
| "폴더 우클릭" | 5.04 | 폴더 `ContextMenu`, 폴더 행 호버 바탕 유지 | Controls/Menu/ContextMenu |
| "새 폴더" | 5.01 | 맨 위 새 폴더 행의 `RenameField` | Patterns/List/RenameField |
| "폴더 안" | 5.02 | `PageHeader`의 `trail` "게시글 /", 제목은 폴더 이름, "상위 폴더로" 행 | Patterns/Frame/PageHeader |
| "폴더 안 검색" | 5.03 | `SearchBox`, 찾는 곳 행의 `Segmented` "시리즈 원고 · 모든 폴더" | Controls/Field/SearchBox, Controls/Choice/Segmented |
| "폴더 지우기 확인" | 5.05 | `AlertDialog`("시리즈 원고를 휴지통으로 옮길까요?"). 발행된 글이 든 폴더만 묻는다 | Controls/Overlay/AlertDialog |
| "폴더 지움" | 5.06 | `toast`("… 휴지통으로 옮겼어요", "되돌리기"), 사이드바에서 폴더가 빠진다 | Controls/Status/Toast |

### 흐름 7 · 목록 정리

단계: 7.01, 7.01b, 7.02, 7.02b, 7.02c, 7.03, 7.04, 7.04b, 7.04c, 7.04d, 7.04e, 7.05, 7.05b, 7.05c, 7.10. 단계마다 보이는 것은 [flows/07-list-tidy-up.md](../flows/07-list-tidy-up.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "바꾸기 메뉴" | 7.10 | "바꾸기 ▾" `DropdownMenu`와 태그 `DropdownMenuSub`(검색, 세 상태 체크) | Controls/Menu/DropdownMenu |
| "상태 메뉴" | 7.04 | 상태 열 메뉴(`DropdownMenuCheckboxItem` 넷과 개수, "열 숨기기"), 상태 열 `filtered` | Controls/Menu/DropdownMenu |
| "여러 필터" | 7.04e | 상태 열과 수정일 열이 함께 `filtered`. 찾는 곳 행은 없다 |  |
| "태그 메뉴" | 7.04b | 태그 열 메뉴(`DropdownMenuSearch`, "없음", `DropdownMenuScroll`) | Controls/Menu/DropdownMenu |
| "언어 메뉴" | 7.04c | 언어 열 메뉴(언어, `DropdownMenuLabel` "번역", 번역 상태), 언어 열 `filtered` | Controls/Menu/DropdownMenu |
| "수정일 메뉴" | 7.05 | 수정일 열 메뉴(정렬과 기간 `DropdownMenuRadioItem`), `filtered` | Controls/Menu/DropdownMenu |
| "기간 고르기" | 7.05b | 날짜 메뉴 옆 `Calendar`, 시작 날만 | Controls/Field/Calendar |
| "기간 걸림" | 7.05c | `Calendar`가 기간을 보이며 열려 있음, 수정일 열 `filtered` | Controls/Field/Calendar |
| "검색 설명 메뉴" | 7.04d | +로 켠 검색 설명 열과 그 메뉴("비어 있음"), `filtered` |  |
| "제목 메뉴" | 7.01 | 제목 열 메뉴(오름차순 · 내림차순) |  |
| "제목 오름차순" | 7.01b | 메뉴 닫힘, 제목 열 `sort="asc"` |  |
| "열 추가" | 7.02 | `ListHead`의 `add` 메뉴(숨긴 열만) | Patterns/List/ListHead |
| "열 옮기는 중" | 7.02b | 들린 열 이름, 비켜난 열 |  |
| "쪽마다" | 7.02c | `PageSizeMenu` 열림 | Patterns/List/Pagination |
| "찾을 곳 고르기" | 7.03 | `SearchBox`의 찾을 곳 메뉴 열림(지금 값 ✓) | Controls/Field/SearchBox |

### 흐름 9 · 데이터

단계: 9.04. 단계마다 보이는 것은 [flows/09-data.md](../flows/09-data.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "고른 글 내보냄" | 9.04 | `BulkBar`와 `toast` "2편을 내보냈어요" | Patterns/List/BulkBar, Controls/Status/Toast |

## 빈 목록 (Empty)

- 보드: `Empty.dc.html`. 상태와 흐름 단계: [screens.md › Empty](../screens.md#empty).
- 공통 틀: [common.md](common.md)의 왼쪽 내비게이션, 페이지 단, ✦ 어시스턴트 열기.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 행 | `PageHeader`(`title` 컬렉션 이름, `meta` 주소 규칙), `children`에 위의 "+ 새 글 쓰기 ▾" 나뉜 알약(메모는 "+ 새 메모 쓰기 ▾") | 빈 목록에서도 같은 알약이다. |
| 빈 상태 | `Empty`(`title` "아직 글이 없어요.", 메모는 "아직 메모가 없어요.") 한 줄, 그 아래 `EmptyStep` 셋("01 첫 메모 쓰기", "02 쓰던 글 가져오기", "03 템플릿으로 쓰기"). "템플릿으로 쓰기"는 `DropdownMenu`로 템플릿을 고른다. 아직 없는 길(가져오기, 14)은 빠지고 번호는 보이는 것만 센다 | 상자는 없다. 둘째 줄 "어디서부터 시작할까요?"는 두지 않는다. 시작하는 길은 머리의 나뉜 알약에도 있지만, 빈 화면에서는 눈이 가는 자리에 셋을 펼쳐 둔다(한 줄만 두니 화면이 비어 보였다, 2026-11-05 소유자). |

스토리: Patterns/Frame/PageHeader, Controls/Button/SplitButton, Patterns/List/Empty.

### 흐름 8 · 처음 설치

단계: 8.03. 단계마다 보이는 것은 [flows/08-first-install.md](../flows/08-first-install.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "게시글" | 8.03 | `title` "게시글", `meta` "/posts/:slug", "아직 글이 없어요." 한 줄, 머리의 "+ 새 글 쓰기 ▾", 사이드바는 첫 방문 모양(`fresh`) |  |
