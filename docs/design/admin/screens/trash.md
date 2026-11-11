# 휴지통 (Trash)

- 기준 화면: `Screens/Reference/Lists` › Trash. 실제 화면의 상태는 `Screens/Trash`. 상태와 흐름 단계: [screens.md › Trash](../screens.md#trash).
- 공통 틀: [common.md](common.md)의 왼쪽 내비게이션(`Sidebar`, 휴지통 개수는 `SidebarMenuBadge`), 페이지 단(`PageColumn width="list"`), ✦ 어시스턴트 열기, 확인 질문, 사이드 패널, 토스트, 행 오른쪽 클릭.
- 표, 열 이름 행, 일괄 막대의 쓰임은 [list.md](list.md)의 게시글 목록과 같다. 이 절은 휴지통이 다른 것만 적는다.
- 무엇을 하는 화면인지는 [기능 설계 11](../../features/11-trash.md)에 있다. 이 화면의 결정은 코드를 쓰기 전에 시안으로 정했다(2026-11-11 소유자).

## 기본 틀

### 제목 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 행 | `PageHeader`(`title` "휴지통") | 폴더 안에서는 `title`이 폴더 이름, `meta`가 "30일 남음"(7일 아래면 `Text tone="warning"`). |
| 폴더 경로 "휴지통 /" | `PageHeader`의 `trail`에 `TextButton variant="underline"` | 휴지통 안의 폴더에서만 있다. |
| "상위 폴더로" | 폴더 행 모양(`RowTitle folder`), 체크와 ⋯ 없음 | 폴더 안의 첫 행. 누르면 한 단계 위(지운 폴더 안의 폴더면 그 폴더, 아니면 휴지통)로 간다. 게시글 목록과 같다(2026-11-11 소유자: 미디어에서 뺀 것을 휴지통까지 뺀 것은 잘못이었다). 찾는 동안에는 없다. 고를 수 없고 개수에 들지 않는다. |
| "검색" | `SearchToggle`(`label` "검색", `targets` 없음) | 그 자리에서 `SearchBox`가 열린다. 지운 폴더 안의 것도 찾는다. 지운 폴더 안에서는 게시글 목록처럼 상자 앞 칩(`scopes`)이 그 폴더와 "모든 폴더" 가운데 고른다(2026-11-11 소유자). |
| "비우기" | `TextButton variant="danger"` | 누르면 `AlertDialog`로 묻는다. 휴지통이 비었으면 "검색"과 함께 없다. |
| 폴더 안의 "폴더 복원"과 ⋯ | `TextButton`, `IconButton` + `DropdownMenu`("영구 삭제" `variant="danger"`) | "비우기" 자리에 온다. 영구 삭제는 `AlertDialog`로 묻는다. |

### 표

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 표 | `ListScroll` 안의 `Table`(`TableBody`, `TableRow`, `TableCell`) | 행은 게시글 목록의 행과 같은 한 줄이다(2026-11-11 소유자: 둘째 줄이 비는 행이 생기고, 휴지통만 다를 까닭이 없다). 고른 행과 패널에 열린 행은 `TableRow selected`. |
| 행 체크 | `RowCheck` | 포인터가 행 위에 있을 때와 고른 행, 패널에 열린 행에 보인다(항목 화면과 같다). |
| 제목 칸 | `RowTitle`(`title`, `address`, `folder`) | 게시글 목록과 같은 칸이다. 제목 뒤 `address` 자리에 글은 공개 주소, 폴더는 담은 수("글 2", "파일 3"), 그리고 있던 폴더가 온다("Blog Assets"). 찾은 것이 지운 폴더 안에 있으면 "시리즈 원고 폴더 안"이다. 지운 폴더는 `folder`로 앞에 폴더 아이콘, 누르면 휴지통 안에서 그 폴더가 열린다. 글 하나는 한 줄이다: 원문과 번역이 따로 버려졌어도 한 줄에 모인다. |
| 제목을 누르면 | `RowLink` | 글은 편집기로 간다(읽기 전용). 항목과 미디어는 옆 패널이 열린다. 폴더는 그 안으로 들어간다. |
| 언어 칸 | `LocaleCodes`(`codes`, `names`) | 글과 항목의 줄에만: 휴지통에 든 그 글의 언어. 기본 너비에서는 "KO +1", 열을 넓히면 "KO · EN". 세기만 한 언어가 있으면 가리킬 때 툴팁이 이름으로 말한다("한국어, 영어"). 게시글 목록의 언어 칸과 같은 부품이다. 언어가 하나인 사이트에는 열이 없다. 처음 폭은 `LIST_COLUMN_SIZE.locale`. |
| 종류 칸 | `TableCell tone="subtle"` | 컬렉션의 이름("게시글", "메모", "태그")과 "미디어". 폭은 `LIST_COLUMN_SIZE.one`. |
| 남은 날 칸 | `TrashRowDate`(`left`, `urgent`, `byAssistant`. `date`는 주지 않는다) | 남은 날("30일 남음")만. 버린 날은 남은 날과 같은 것을 말하므로 두지 않는다(2026-11-05 소유자, 원칙 8). 7일 아래면 `urgent`로 경고 색(2026-11-11 소유자). 폴더 안의 행은 폴더와 남은 날이 같으면 비운다. 폭은 `LIST_COLUMN_SIZE.measure`. |
| 행 동작 | `RowActions` 안의 `RowMore` + `DropdownMenu`: "복원" │ "영구 삭제"(`variant="danger"`), 행마다 앞에 아이콘 | 행의 동작은 모두 ⋯ 안에 있다. 보이는 "복원" 버튼은 없다(2026-11-11 소유자). 글의 줄은 휴지통에 든 그 글의 언어 모두를 함께 복원하고 함께 지운다. 영구 삭제는 `AlertDialog`로 묻는다. |
| 행 오른쪽 클릭 | `ContextMenu`: "복원" │ "영구 삭제"(`variant="danger"`, `MenuShortcut` Del) | ⋯와 같은 행이다. 고른 행 중 하나에서 열면 `ContextMenuLabel` "2개 항목"으로 시작하고 아이콘 없이 고른 행 모두에 한다(게시글 목록과 같다). 행에서 Delete를 눌러도 영구 삭제를 묻는다. |
| 빈 휴지통 | `Empty`(`title` "휴지통이 비었습니다.") | 열 이름 행과 표 대신 이 한 줄. 도구 화면의 빈 목록과 같은 부품이다. |
| 맞는 것이 없음 | `TableRow` 한 줄: `Text tone="subtle"` "맞는 것이 없습니다."와 `TextButton` "필터 해제" | 찾거나 걸렀는데 없을 때. 게시글 목록과 같다. |
| 쪽 | `ListFooter`(`Count`, `ListPages`) | 50줄이 넘을 때만 있다. |

스토리: Patterns/Frame/PageHeader, Controls/Button/TextButton, Controls/Field/SearchBox, Controls/Overlay/AlertDialog, Patterns/List/Table, Patterns/List/TrashRow, Primitives/Text, Controls/Button/IconButton, Controls/Menu/DropdownMenu, Controls/Menu/ContextMenu, Patterns/List/ListHead, Patterns/List/BulkBar, Controls/Overlay/SidePanel, Patterns/Panel/DotNote, Patterns/Frame/Image, Patterns/List/FilePreview, Patterns/Frame/DescriptionList, Patterns/List/FileUseRow, Controls/Button/Button, Patterns/List/Empty.

## 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

### 열 이름 행과 일괄 막대

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 열 이름 행 | `ListHead`(`columns`, `end`, `selectAll`, `onResize`, `resizeLabel`). 열: "제목" · "언어" · "종류" · "남은 날" | 모든 표의 열 규칙을 따른다([list.md](../components/list.md), 2026-11-11 소유자): 열 사이를 끌어 너비를 바꾸고(이 브라우저에 남는다), 열마다 메뉴가 정렬이나 거르기를 담는다. 종류 탭은 없다. 처음에는 "남은 날"이 `sort="desc"`(최근에 버린 것부터). |
| "제목" 메뉴 | `SortRows`("오름차순" · "내림차순") | 고르면 닫힌다. |
| "언어" 메뉴 | 그 열 `menu`에 `DropdownMenuCheckboxItem box`와 개수 `MenuShortcut` | 여기 휴지통에 든 언어마다 한 줄, 이름으로("한국어 5"). 고르면 그 언어가 휴지통에 든 글만 남는다. 폴더와 파일은 언어가 없어 빠진다. 걸리면 `filtered`로 점. |
| "종류" 메뉴 | `ListHead`의 그 열 `menu`에 `DropdownMenuCheckboxItem box`와 개수 `MenuShortcut` | 컬렉션마다 한 줄과 "미디어". 0개인 종류도 보인다. 여럿을 함께(OR) 고르고 메뉴는 열려 있다. 걸리면 `filtered`로 점. |
| "남은 날" 메뉴 | `SortRows`(`words` "많이 남은 것부터" · "적게 남은 것부터") | 고르면 닫힌다. |
| 일괄 막대 | `BulkBar`(`label` "2개 선택", `selectAll`, `clearLabel` "선택 해제", `onClear`, `colSpan`) | 동작은 `TextButton` "복원"과 `TextButton variant="danger"` "영구 삭제" 둘뿐이다. 요청과 ⋯는 없다. |

### 옆 패널 (항목 열기, 미디어 열기)

읽기만 하는 패널이다. 미디어는 미디어 화면의 패널과, 항목은 항목 화면의 패널과 같은 순서로 보인다(2026-11-11 소유자).

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel width="side"`(`title` 항목 이름이나 파일 이름) | 행을 누르면 열리고 머리 끝 ×로 닫는다. 열린 동안 ✦ 어시스턴트 버튼은 그 아래에 가려진다. |
| ⋯ | `SidePanel`의 `actions`에 `IconButton` + `DropdownMenu`("영구 삭제" `variant="danger"`) | 영구 삭제는 `AlertDialog`로 묻는다. |
| 미리보기 (미디어) | `Image`(4:3), 파일이면 `FilePreview framed` | |
| 정보 | `DescriptionList` + `DescriptionItem` | 첫 행은 "남은 날"("3일 남음", 7일 아래면 경고 색)이다. 목록의 열과 같은 이름, 같은 말이다. 정보 위에 따로 뜬 상태 줄("3일 남음 · 읽기 전용")은 두지 않는다(2026-11-11 소유자: 자리가 애매했다. 값이 글자뿐이라 "읽기 전용"은 보이는 것을 되풀이한다, 원칙 8). 미디어: 남은 날 · 폴더 · 종류 · 크기 · 올린 날. 대체 텍스트는 없다(09). 항목: 남은 날 · 컬렉션 · 주소. 이름은 패널 제목이 이미 말하므로 되풀이하지 않는다(원칙 8). 언어가 여럿인 항목만 언어마다 이름과 주소를 적는다. 값은 글자이고 입력 부품이 아니다. |
| "쓰는 곳 · 0" / "가리키는 글 · 4" | `FormFieldLabel`, 아래 `FileUseList`에 글마다 `FileUseRow`(글 이름 링크, 끝에 컬렉션. 휴지통의 글은 "휴지통 · 게시글") | 누르면 그 글이 열린다. 없으면 `Text variant="note" tone="faint"` "없음". 많으면 패널이 스크롤한다. |
| 발 | `SidePanel`의 `footer`: `Button variant="primary"` "복원" | 알약은 복원 하나다. |

### 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 영구 삭제 확인 | `AlertDialog`(`AlertDialogTitle` "영구 삭제할까요?", `AlertDialogDescription`), `AlertDialogCancel` "취소", `AlertDialogAction variant="danger"` "영구 삭제" | 되돌릴 수 없으므로 매번 묻는다. 발행된 적이 있으면 남길 주소를 적는다("되돌릴 수 없습니다. 주소 /posts/about-old는 다시 쓸 수 없습니다."). 여럿이면 몇 개인지("2개를 영구 삭제합니다."), 폴더면 안의 것도 간다고("폴더 안의 것도 함께 삭제합니다.") 먼저 말한다. 가리키는 글이 있어도 막지 않는다(2026-11-11 소유자). |
| 휴지통 비우기 확인 | `AlertDialog`(`AlertDialogTitle` "휴지통을 비울까요?", "9개를 영구 삭제합니다."), `AlertDialogAction variant="danger"` "비우기" | |

## 흐름 5 · 휴지통

단계: 5.11, 5.12, 5.13, 5.14, 5.15, 5.16, 5.17, 5.19, 5.20, 5.21, 5.23, 5.25, 5.26, 5.28. 단계마다 보이는 것은 [flows/05-trash.md](../flows/05-trash.md)에 있다. 스토리는 모두 `Screens/Trash` 아래다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "보통" | 5.11 | 표와 행 | Top |
| "종류 메뉴" | 5.11 | "종류" 열의 `DropdownMenuCheckboxItem`과 개수 | KindMenu |
| "행 메뉴" | 5.16 | 행의 ⋯ `DropdownMenu`("복원" · "영구 삭제"), 고른 행의 `ContextMenu` | RowMenu, PickedRightClick |
| "어시스턴트" | 5.15 | 어시스턴트가 버린 행은 `TrashRowDate byAssistant`: 남은 날이 파란 ✦와 함께 선다 | ByAssistant |
| "미디어" | 5.17 | "종류" 열 `filtered`, 미디어 행만. 칩 줄은 없다 | OnlyMedia |
| "항목 열기" | 5.19 | 태그 행 `selected`와 항목 `SidePanel`("가리키는 글 · 4") | ItemPanel |
| "미디어 열기" | 5.20 | 파일 행 `selected`와 미디어 `SidePanel`(미리보기, "쓰는 곳 · 0") | FilePanel |
| "복원함" | 5.21 | 복원한 행이 빠지고 `toast` "초안으로 복원했습니다"와 `action` "열기" | |
| "삭제 확인" | 5.23 | 영구 삭제 `AlertDialog` | PurgeConfirm |
| "선택" | 5.25 | `BulkBar`(`selectAll` 일부), 두 행 `selected` | Picked |
| "비우기 확인" | 5.26 | 비우기 `AlertDialog` | EmptyConfirm |
| "빔" | 5.28 | 빈 휴지통 한 줄, 머리 동작 없음, 사이드바 개수 없음 | Empty |
| "휴지통 폴더 안" | 5.12 | `PageHeader`의 `trail` "휴지통 /", 폴더 이름 제목과 `meta`, "폴더 복원"과 ⋯, 남은 날 칸이 빈 안쪽 행 | InFolder, FolderMenu |
| "폴더에서 하나 복원" | 5.13 | 폴더가 휴지통을 떠나 화면이 휴지통 맨 위로 돌아오고, 남은 글은 폴더 이름과 함께 한 줄이 된다. `toast` "시리즈 원고 폴더와 함께 복원했습니다"와 "열기" | |
| "휴지통 찾기" | 5.14 | `SearchBox`, 폴더 안의 항목은 `meta` 앞에 "시리즈 원고 폴더 안". 지운 폴더 안에서는 찾는 곳 칩. 맞는 것이 없으면 한 줄과 "필터 해제" | Searching, SearchingInFolder, NoMatch |
