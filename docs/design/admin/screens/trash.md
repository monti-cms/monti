# 휴지통 (Trash)

- 보드: `Trash.dc.html`. 상태와 흐름 단계: [screens.md › Trash](../screens.md#trash).
- 공통 틀: [common.md](common.md)의 왼쪽 내비게이션(`Sidebar`, 휴지통 개수는 `SidebarMenuBadge`), 페이지 단(`PageColumn width="list"`), ✦ 어시스턴트 열기, 확인 질문, 사이드 패널, 토스트, 행 오른쪽 클릭.
- 표, 열 이름 행, 일괄 막대의 쓰임은 [list.md](list.md)의 게시글 목록과 같다. 이 절은 휴지통이 다른 것만 적는다.

## 기본 틀

### 제목 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 행 | `PageHeader`(`title` "휴지통") | 폴더 안에서는 `title`이 폴더 이름, `meta`가 "30일 남음". |
| 폴더 경로 "휴지통 /" | `PageHeader`의 `trail`에 `TextButton variant="underline"` | 휴지통 안의 폴더에서만 있다. 위로 가는 길은 이것 하나다. 목록 맨 위의 "상위 폴더로" 행은 두지 않는다(2026-11-05 소유자, 원칙 8). |
| "검색" | `SearchToggle`(`label` "검색", `targets` 없음) | 그 자리에서 `SearchBox`가 열린다. 지운 폴더 안의 것도 찾는다. 검색어는 상자 안에만 있다. 보드는 "휴지통 찾기"에서도 버튼을 그렸지만 [screens.md](../screens.md#trash)를 따라 상자가 열린 채 검색어를 보인다. |
| "비우기" | `TextButton variant="danger"` | 누르면 `AlertDialog`로 묻는다. 휴지통이 비었으면 "검색"과 함께 없다. |
| 폴더 안의 "폴더 복원" · "영구 삭제" | `TextButton`, `TextButton variant="danger"` | "검색" · "비우기" 자리에 온다. 영구 삭제는 `AlertDialog`로 묻는다. |

### 표

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 표 | `ListScroll` 안의 `Table`(`TableBody`, `TableRow twoLine`, `TableCell`) | 모든 행이 두 줄 높이다. 고른 행과 패널에 열린 행은 `TableRow selected`. |
| 행 체크 | `RowCheck` | 포인터가 행 위에 있을 때와 고른 행에만 보인다. |
| 제목 칸 | `TrashRowTitle`(`title`, `address`, `folder`, `meta`, `metaTone`) | 첫 줄은 조용한 잉크의 제목과 mono 주소, 둘째 줄은 담은 것("KO · EN", "글 2", "이미지 · 2.4 MB · Blog Assets"). 할 말이 없어도 빈 줄을 지킨다. 지운 폴더는 `folder`로 앞에 폴더 아이콘, 누르면 휴지통 안에서 그 폴더가 열린다. 되돌아오지 못하게 막는 것이 있으면 `metaTone="warning"`("원문이 휴지통에 있습니다 · …"). 검색 결과의 폴더 안 항목은 `meta` 앞에 "시리즈 원고 폴더 안". |
| 종류 칸 | `Text variant="note" tone="subtle"` | "게시글", "메모", "태그", "미디어". |
| 남은 날 칸 | `TrashRowDate`(`left`, `urgent`. `date`는 주지 않는다) | 남은 날("30일 남음")만. 버린 날은 남은 날과 같은 것을 말하므로 두지 않는다(2026-11-05 소유자, 원칙 8). 사흘 이하면 `urgent`로 경고 색. 폴더 안의 행은 비운다. |
| 행 동작 | `RowActions` 안의 `TextButton` "복원"(알약이 아니다)과 `IconButton`(`label` "더보기") + `DropdownMenu`("영구 삭제", `variant="danger"`) | 원문이 휴지통에 있는 번역은 "원문 복원"(`TextButton variant="ink"`)이 된다. 다른 글이 가리켜 남은 행(비운 뒤)은 "영구 삭제"(`TextButton variant="danger"`)가 된다. ⋯는 보드에서 글자 버튼이지만 [button.md](../components/button.md)의 아이콘 버튼을 따른다. 영구 삭제는 `AlertDialog`로 묻는다. |
| 행 오른쪽 클릭 | `ContextMenu`: "복원" │ "영구 삭제"(`variant="danger"`, `MenuShortcut` Del) | 메뉴가 열린 동안 그 행은 호버 바탕을 유지한다. |
| 빈 휴지통 | `Text variant="note" tone="subtle"` "휴지통이 비었습니다." | 열 이름 행과 표 대신 이 한 줄. |

스토리: Patterns/Frame/PageHeader, Controls/Button/TextButton, Controls/Field/SearchBox, Controls/Overlay/AlertDialog, Patterns/List/Table, Patterns/List/TrashRow, Primitives/Text, Controls/Button/IconButton, Controls/Menu/DropdownMenu, Controls/Menu/ContextMenu, Patterns/List/ListHead, Patterns/List/BulkBar, Controls/Overlay/SidePanel, Patterns/Panel/DotNote, Patterns/Frame/Image, Patterns/List/FilePreview, Patterns/Frame/DescriptionList, Primitives/Label, Controls/Button/Button, Monti/Change/ChangeGroup.

## 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

### 열 이름 행과 일괄 막대

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 열 이름 행 | `ListHead`(열 셋: "제목" · "종류" · "남은 날") | 종류 탭은 없다. 종류로 거르는 것은 "종류" 열의 메뉴다. "남은 날"은 `sort="desc"`(최근에 버린 것부터). |
| "종류" 메뉴 | `ListHead`의 그 열 `menu`에 `DropdownMenuCheckboxItem box`와 개수 `MenuShortcut` | 게시글 · 메모 · 카테고리 · 태그 · 미디어. 여럿을 함께(OR) 고르고 메뉴는 열려 있다. 걸리면 `filtered`로 점. |
| "남은 날" 메뉴 | `DropdownMenuRadioGroup`("많이 남은 것부터" · "적게 남은 것부터") | 고르면 닫힌다. |
| 일괄 막대 | `BulkBar`(`label` "2개 선택", `selectAll`, `clearLabel` "선택 해제", `onClear`, `colSpan`) | 동작은 `TextButton` "복원"과 `TextButton variant="danger"` "영구 삭제" 둘뿐이다. 요청과 ⋯는 없다. |

### 옆 패널 (항목 열기, 미디어 열기)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel width="side"`(`title` 항목 이름이나 파일 이름) | 행을 누르면 열리고 머리 끝 ×로 닫는다. 열린 동안 ✦ 어시스턴트 버튼은 그 아래에 가려진다. |
| 상태 줄 | `DotNote` "3일 남음 · 읽기 전용" | 패널은 읽기만 한다. 휴지통 화면 안이므로 "휴지통"은 되풀이하지 않는다(원칙 8). |
| 미리보기 (미디어) | `Image`(4:3), 파일이면 `FilePreview framed` | |
| 정보 | `DescriptionList` + `DescriptionItem` | 항목: 컬렉션 · 이름 · 주소. 미디어: 종류 · 크기 · 폴더 · 대체 텍스트. 남은 날은 상태 줄이 말하므로 버린 날은 두지 않는다. |
| "가리키는 글 · 4" / "쓰는 곳" | `Label`, 6px 아래 글마다 한 행: 왼쪽 글 이름 `TextButton variant="ink" size="note"`(링크), 오른쪽 컬렉션 `Text variant="micro" tone="subtle"` | 행은 메모 크기(13px)이고 행 사이 선이 없다. 오른쪽은 그 글의 컬렉션("게시글", "휴지통 · 게시글"). 누르면 그 글이 열린다. 없으면 `Text variant="note" tone="faint"` "없음". |
| 발 | `SidePanel`의 `footer`: `TextButton variant="danger"` "영구 삭제", `Button variant="primary"` "복원" | 영구 삭제는 `AlertDialog`로 묻는다. |

### 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 영구 삭제 확인 | `AlertDialog`(`AlertDialogTitle` "영구 삭제할까요?", `AlertDialogDescription`), `AlertDialogCancel` "취소", `AlertDialogAction variant="danger"` "영구 삭제" | 되돌릴 수 없으므로 매번 묻는다. 한 번 공개된 주소는 남겨 둔다고 적는다. |
| 영구 삭제가 막힘 | `AlertDialogContent size="wide"` 안에 `ChangeGroup kind="drop"`(`tag` "삭제", `title` "임시", `identifier` "태그"), `ChangeLines`의 `ChangeLine`(`what` "가리키는 글 4편 · …", `then`에 `TextButton variant="inherit"` "연결 끊기" / "같이 삭제", `tone="warning"`), `ChangeNote` | 막는 것을 그 줄의 버튼으로 풀기 전까지 `AlertDialogAction`은 `disabled`. 글 링크는 `TextButton variant="underline"`. |
| 휴지통 비우기 확인 | `AlertDialog`(`AlertDialogTitle` "휴지통을 비울까요?"), `AlertDialogAction variant="danger"` "비우기" | 다른 글이 가리키는 것은 남기고 이유를 보인다고 적는다. |

## 흐름 5 · 휴지통

단계: 5.11, 5.12, 5.13, 5.14, 5.15, 5.16, 5.17, 5.19, 5.20, 5.21, 5.22, 5.23, 5.24, 5.25, 5.26, 5.27, 5.28. 단계마다 보이는 것은 [flows/05-trash.md](../flows/05-trash.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "종류 메뉴" | 5.11 | "종류" 열의 `DropdownMenuCheckboxItem` 다섯과 개수 | Controls/Menu/DropdownMenu |
| "행 메뉴" | 5.16 | 행 `ContextMenu`("복원" · "영구 삭제"), 그 행 호버 바탕 | Controls/Menu/ContextMenu |
| "어시스턴트" | 5.15 | 어시스턴트가 버린 행은 `TrashRowDate byAssistant`: 남은 날이 파란 ✦와 함께 버튼이 된다. 누르면 그 대화가 열린다 | Patterns/List/TrashRow |
| "미디어" | 5.17 | "종류" 열 `filtered`, 미디어 행만. 칩 줄은 없다 |  |
| "항목 열기" | 5.19 | 태그 행 `selected`와 항목 `SidePanel`("가리키는 글 · 4") | Controls/Overlay/SidePanel |
| "미디어 열기" | 5.20 | 파일 행 `selected`와 미디어 `SidePanel`(미리보기, "쓰는 곳" 없음) | Controls/Overlay/SidePanel |
| "복원함" | 5.21 | 복원한 행이 빠지고 `toast` "초안으로 복원했습니다"와 `action` "열기" | Controls/Status/Toast |
| "번역 막힘" | 5.22 | 번역 행 `TrashRowTitle metaTone="warning"`, 행 동작 "원문 복원" | Patterns/List/TrashRow |
| "삭제 확인" | 5.23 | 영구 삭제 `AlertDialog` | Controls/Overlay/AlertDialog |
| "삭제 막힘" | 5.24 | `AlertDialogContent size="wide"`와 `ChangeGroup kind="drop"`, 알약 `disabled` | Controls/Overlay/AlertDialog, Monti/Change/ChangeGroup |
| "선택" | 5.25 | `BulkBar`(`selectAll` 일부), 두 행 `selected` | Patterns/List/BulkBar |
| "비우기 확인" | 5.26 | 비우기 `AlertDialog` | Controls/Overlay/AlertDialog |
| "비운 뒤" | 5.27 | 막힌 행 하나만 남음(`metaTone="warning"` "가리키는 글 4편", 행 동작 "영구 삭제"), `toast` "6개를 지웠습니다 · 1개는 남겼습니다" | Controls/Status/Toast |
| "빔" | 5.28 | 빈 휴지통 한 줄, 머리 동작 없음, 사이드바 개수 없음 |  |
| "휴지통 폴더 안" | 5.12 | `PageHeader`의 `trail` "휴지통 /", 폴더 이름 제목과 `meta`, "폴더 복원" · "영구 삭제", 남은 날 칸이 빈 안쪽 행 | Patterns/Frame/PageHeader |
| "폴더에서 하나 복원" | 5.13 | 남은 안쪽 행, `toast` "시리즈 원고 폴더를 다시 만들고 초안으로 복원했습니다"와 "열기" | Controls/Status/Toast |
| "휴지통 찾기" | 5.14 | `SearchBox`, 폴더 안의 항목은 `meta` 앞에 폴더 경로 | Controls/Field/SearchBox |
