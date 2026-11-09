# 미디어

## 미디어 (Media)

> 바뀜 (2026-11-05, 소유자): 대체 텍스트와 캡션은 글에서만 쓴다. 미디어 라이브러리는 파일 그 자체만 다룬다. 라이브러리의 대체 텍스트 칸, 대체 텍스트 거르기, 라이브러리에서 여러 장 채우기는 빠진다. [기능 설계 09](../../features/09-media.md#결정-기록) 참고.

- 보드: `Media.dc.html`. 상태와 흐름 단계: [screens.md › Media](../screens.md#media).
- 공통 틀: [common.md](common.md)의 사이드바, 페이지 단(`PageColumn width="list"`), 제목 행, ✦ 어시스턴트 열기, 사이드 패널, 토스트, 메뉴.

### 기본 틀

#### 제목 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 경로 "미디어 / Blog Assets /" | `PageHeader`의 `trail`에 `TextButton variant="underline"`(지나온 폴더마다 하나) | 누르면 그 폴더로 간다. 폴더 안에서만 보인다(최상위와 "저장소 없음"에는 없다). 위로 가는 길은 이것 하나다. 격자 첫 칸의 "상위 폴더로" 타일은 두지 않는다(2026-11-05 소유자, 원칙 8). |
| 제목 "Blog Assets" · 개수 | `PageHeader`(`title`은 연 폴더 이름, `meta`는 개수 "14개") | 필터가 걸려도 `meta`는 개수만 쓴다. |
| "올리기 ▾" | `SplitButton`(앞에 `Upload`, `menuLabel` "더 만들기", `menu`에 `DropdownMenuItem` "새 폴더"(`FolderAdd`)) | 왼쪽은 파일 고르기를 연다. 저장소가 없으면 흐리게 남기지 않고 숨는다. 그때 화면의 알약은 "연결 방법"이다(2026-11-05 소유자, 원칙 7). "새 폴더"는 폴더 타일 행 끝에 새 폴더를 만들고 이름 칸을 연다. 검색, 고르기, 저장소 없음 동안에는 "새 폴더"가 없다. (2026-11-05 소유자: 드물게 쓰는 일이라 버튼 대신 검은 알약의 메뉴에 둔다.) |
| "검색" | `SearchToggle` → `SearchBox` | 누르면 그 자리에서 검색 칸이 열리고 포커스가 간다. 검색어가 있는 동안 남는다. 미디어는 찾을 곳(`targets`)이 없다. 검색어는 검색 칸에만 있다. |

#### 도구 행 (`PageToolbar inset`)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "종류 ▾" | `FilterButton` + `DropdownMenu`(`DropdownMenuCheckboxItem` "이미지" · "파일", 끝에 개수 `MenuShortcut`) | 값을 골라도 메뉴는 열린 채로 있다. 고르면 그 자리의 버튼이 `Chip`("종류: 파일 ×", `onRemove`)이 된다. 개수는 고르면 나올 수다(지금 폴더와 그 하위, 모든 폴더면 전체). |
| "사용 여부 ▾" | `FilterButton` + `DropdownMenu` | 종류와 같다. |
| (빠짐, 2026-11-05) "대체 텍스트 ▾" | `FilterButton` + `DropdownMenu`(`DropdownMenuCheckboxItem` "없음" · "있음", 개수) | 고르면 `Chip`("대체 텍스트: 없음 ×")이 된다. 종류가 "파일"이면 이 버튼은 없다(파일에는 대체 텍스트가 없다). |
| 찾는 곳 "Blog Assets │ 모든 폴더" | `Separator orientation="vertical" length="control" flush` 뒤 `Segmented size="sm" inline` | 검색어나 필터가 걸린 동안, 폴더 안에서만 보인다. 그동안 폴더 타일은 없다. 기본은 지금 폴더와 그 하위다(2026-11-09 소유자). |
| 정렬 "최근 올린순 ▾" | `PageToolbarEnd` 안 `FilterButton` + `DropdownMenu`(`DropdownMenuRadioGroup`) | 고르면 적용하고 닫힌다. |
| 보기 "격자 │ 목록" | `Segmented size="sm" inline` | 격자와 목록을 바꾼다. |

#### 고른 동안의 막대 (도구 행 자리)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 막대 | `BulkBar`(`colSpan` 없이, `label` "2개 선택", `selectAll`, `clearLabel` "선택 해제") | 고르는 동안 도구 행을 대신한다. 모두 선택 체크는 일부만 골랐으면 `some`이다. 미디어 격자에는 열 이름 행이 없으므로 이 막대가 도구 행 자리에 온다. |
| (빠짐, 2026-11-05) "✦ 대체 텍스트" | `BulkBar`의 `request` | 고른 파일의 대체 텍스트를 어시스턴트에게 맡긴다. |
| "폴더로 ▾" | `TextButton` + `Caret` + `DropdownMenu`(`DropdownMenuItem`: "최상위" · 폴더들, 구분선, "+ 새 폴더") | 고른 파일이 모두 한 폴더에 있으면 그 행에 `MenuTick`. 고르면 옮기고 닫힌다. 글 목록의 메뉴와 같은 메뉴다(2026-11-09 소유자). |
| "휴지통으로" | `TextButton` | 곧바로 옮기고 `toast`에 "되돌리기". 쓰는 곳이 있는 파일은 남기고 `toast`에 "보기". |

#### 제안 줄 (대체 텍스트 제안이 있는 동안 도구 행 자리) (빠짐, 2026-11-05)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 줄 "✦ 제안 3 · 모두 버리기 · 모두 받기" | `ProposalBar`(`label` "제안 3", `discardAllLabel` "모두 버리기", `acceptAllLabel` "모두 받기") | 앞의 ✦와 남은 제안 수는 파랑. 끝의 둘은 모든 제안을 한 번에 다룬다. 하나씩 받기와 버리기는 메모 카드에 있다. |

#### 격자

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 놓을 곳 | `DropArea`(`over`) | 파일을 끌어 오면 지금 폴더 영역 둘레에 잉크 선이 생긴다. 아래 가운데에 `toast.dropHint` "여기에 올려요". |
| 폴더 타일 행 | `Grid columns="folders"`, 칸마다 `FolderTile`(`name`, `count`) | 누르면 그 폴더로 들어간다. 파일을 그 위로 끌면 그 타일이 `dropTarget`이 되고 영역 선은 꺼지며, 알림이 "**covers**에 올려요"가 된다. |
| 새 폴더 · 이름 바꾸기 | `FolderTile` 안 `RenameField fill` | "새 폴더"가 선택된 채 열린다. Enter나 벗어나면 이름을 지키고, Esc는 버린다. |
| 파일 격자 | `Grid columns="tiles"`, 칸마다 `Tile`(`preview`, `title`, `detail`) | 누르면 옆 패널에 그 파일이 열린다(`current`). ⋯는 `action`이고 포인터가 오면 보인다. 타일은 평평하다. |
| 고르기 | `Tile`의 `selected`, `picking`, `onSelectedChange` | 하나라도 고르면 모든 타일에 체크가 흐리게 보인다. |
| 올리는 중 | `Tile status="uploading"`(`progress`) | 세부 줄은 "올리는 중 · 64%" 또는 "대기". 이때 나가려 하면 파일을 올리는 중이라고 묻는다(`useLeaveGuard`의 `uploads`). 파일을 "바뀐 곳"이라 부르지 않는다. |
| 받지 않는 형식 · 읽을 수 없는 그림 | `Tile status="failed"`(`action`에 × "빼기") | 빨간 테를 두르고 제자리에 남는다. 세부 줄이 이유를 짧게 말한다: "지원하지 않는 형식"(HEIC도 같다), "이미지만 가능"(이미지만 받는 칸), "읽을 수 없는 파일"(OS의 폴더, 깨진 그림). 고치는 법까지 늘어놓지 않는다(2026-11-09 소유자). ×는 ⋯ 자리에서 포인터가 오면 보인다. |
| 너무 큰 파일 | `Tile status="interrupted"`(`action`에 ×) | 그림은 흐리게 남고 테는 없다. 세부 줄 "10 MB 초과". 줄인 파일은 새로 올린다(2026-11-09 소유자). |
| 이미지가 아닌 파일 | `Tile`의 `preview`에 `FilePreview`(`ext` "PDF") | 아이콘과 확장자. 세부 줄은 크기와 쓰임만("2.1 MB · 사용 안 함"). 형식은 미리보기가 이미 말한다(원칙 8). |
| (빠짐, 2026-11-05) 대체 텍스트 제안 | `Tile`의 `proposal`(세부 줄 자리) | 제안 글은 파란 연필(`Ins`)이다. 제안이 있는 고른 타일은 파랗게 두르고 체크한다. |
| (빠짐, 2026-11-05) 제안 메모 카드 | `MemoCardPopover`(`where` "대체 텍스트 · desk-morning.jpg", `onDiscard`, `onAccept`, `reply` "이어서 요청"), 안에 `MemoThread` + `MemoMessage` | 제안 표시를 누르면 그 타일에 열린다. 받기와 버리기는 머리에 있고 그 파일만 다룬다. |
| 저장소 없음 | `Text weight="semibold"` "미디어 저장소가 없어요", 그 아래 `Text variant="note" tone="subtle"` 한 줄, 머리의 `Button variant="primary"` "연결 방법"(`href`) | 상자도 빈 상태 부품도 없이 두 줄이다. 할 수 있는 일이 연결 하나뿐이라 그 일이 알약이 되고, "올리기 ▾"는 없다(2026-11-05 소유자, 원칙 7). |

#### 목록 보기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 표 | `Table`, `TableBody`, `TableRow`, `TableCell` | 열 이름 행은 없다. 조건과 순서는 위 도구 행에 있다. |
| 그림 열 | `RowThumb` | 파일은 40×30 그림, 폴더 행은 16px 아이콘. |
| 이름 | `RowTitle`(`TableCell truncate`) | 행 어디를 눌러도 열린다(`TableRow`가 연다). 폴더 행은 이름 뒤에 개수. 긴 이름은 …으로 끝나고 다른 열을 밀어내지 않는다. |
| 쓰임 · 형식 · 크기 · 치수 · 날짜 | `TableCell` 안에: 쓰임 `Text variant="note"`, 형식 · 크기 · 치수 `Text variant="meta"`, 날짜 `Count` | 치수가 없는 파일은 칸을 비운다. 날짜는 "10. 12". |
| ⋯ | `RowActions` | 파일 행에만 있다. 폴더로 할 일은 오른쪽 클릭 메뉴에 있다. |

#### 쪽 나누기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 쪽 | `Pagination`(목록 화면의 `ListPages`와 같다) | 한 쪽에 100개다. 격자와 목록 아래에 있고 한 쪽뿐이면 없다. |
| 비었을 때 | `Text variant="note" tone="subtle"` 한 줄 | "아직 파일이 없어요.", 거른 결과가 없으면 "맞는 파일이 없어요." 상자도 안내도 없다. |

#### 오른쪽 클릭과 확인

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 폴더 오른쪽 클릭 | `ContextMenu`: "열기" · "이름 바꾸기" · "옮기기"(`ContextMenuSub`) │ "폴더 지우기"(`variant="danger"`) | 열린 동안 그 타일은 선택 바탕을 유지한다. 폴더 지우기는 곧바로 옮기고 `toast`에 "되돌리기", 쓰는 곳이 있는 파일이 남으면 "보기". |
| 빈 곳 오른쪽 클릭 | `ContextMenu`: "올리기" · "새 폴더" | |
| 파일 오른쪽 클릭 | `ContextMenu`: "열기" · "쓰는 곳"(`ContextMenuSub`, 글마다 끝에 자리) · "폴더로"(`ContextMenuSub`) | 휴지통으로 옮기기는 패널의 ⋯, 일괄 막대, Del 키에 있다. Del 키는 타일의 버튼, 체크, ⋯에 포커스가 있을 때 듣고, 고른 파일이 있으면 고른 것 모두에 적용한다. 타일이 연 메뉴 안의 키는 메뉴의 것이다. |
| 파일 바꾸기 확인 | `AlertDialog`: `AlertDialogTitle` "파일을 바꿀까요?", 옛 파일과 새 파일은 `Grid columns="compare"` 안 `Tile` 둘, `AlertDialogDescription`, `AlertDialogCancel` · `AlertDialogAction` "바꾸기" | 쓰는 곳이 모두 새 파일을 쓴다. 이름, 대체 텍스트, 캡션은 그대로다. |

스토리: Patterns/Frame/PageHeader, Controls/Button/TextButton, Controls/Field/SearchBox, Controls/Button/Button, Patterns/List/FilterButton, Controls/Menu/DropdownMenu, Primitives/Separator, Controls/Choice/Segmented, Patterns/List/BulkBar, Controls/Field/Caret, Controls/Status/Toast, Primitives/Text, Primitives/AI mark, Patterns/List/DropArea, Primitives/Grid, Patterns/List/Tile, Patterns/List/RenameField, Patterns/List/FilePreview, Monti/Proposal/Marks, Monti/Proposal/MemoCard, Monti/Proposal/ProposalBar, Patterns/List/Table, Controls/Status/Count, Controls/Menu/ContextMenu, Controls/Overlay/AlertDialog, Controls/Overlay/SidePanel, Controls/Button/IconButton, Patterns/Frame/Image, Controls/Field/Field, Controls/Field/Affix, Controls/Field/Select, Controls/Field/Textarea, Controls/Field/Input, Patterns/Frame/DescriptionList, Primitives/Stack.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 옆 패널 (파일 열기)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel width="side"`(`title` 파일 이름, `onClose`, `actions`에 ⋯, `footer`에 "저장") | 격자 옆에 열리고, 열린 동안 ✦ 모서리 버튼은 가려진다. 패널의 필드는 모두 `md`(32px, 원칙 10). 그림 · 이름과 폴더 · 정보 · 쓰는 곳은 구분선 없이 32px로 떨어진다(입력칸의 밑줄이 이미 나누는 선이다, 2026-11-09 소유자). |
| ⋯ | `IconButton` + `DropdownMenu`("새 탭에서 열기" · "주소 복사" · "파일 바꾸기" · "ID 복사" · "휴지통으로" `variant="danger"`) | 이미지와 파일(PDF) 모두 같은 ⋯다. 보드의 메뉴 그림에는 휴지통 행이 빠졌지만 버튼 이름과 [screens.md](../screens.md#media)에 있으므로 둔다. |
| 미리보기 | `Image`(이미지), `FilePreview framed`(파일) | |
| 파일 이름 | `FormField` + `FormFieldLabel` + `Affix size="md" suffix=".jpg"` | 늘 입력 칸이다. 확장자는 고칠 수 없는 흐린 글자다. |
| 폴더 | `FormField` + `Select`(`SelectTrigger size="md" width="full"`) | 고른 폴더로 옮긴다(저장으로 적용). |
| (빠짐, 2026-11-05) 기본 대체 텍스트 | `FormField` + `FormFieldLabel action`(`TextButton tone="proposal" size="micro"` "✦ 채우기") + `Textarea size="md"` | 늘 입력 칸이다. 이미지에만 있다. |
| (빠짐, 2026-11-05) 기본 캡션 | `FormField` + `Input size="md"`(플레이스홀더 "비어 있음") | 늘 입력 칸이다. 이미지에만 있다. |
| 종류 · 크기 · 올린 날 | `DescriptionList` + `DescriptionItem` | 크기는 웹용과 원본 두 줄. |
| 어시스턴트의 이름 제안 | 파일 이름 `Affix`의 `proposal`, 패널 안 `ProposalBubbleDock` + `ProposalBubble` | 분류 패널과 같다. 받거나 버린다. |
| "쓰는 곳 · 2" | `FormFieldLabel` 아래 `Stack`, 행마다 `FileUseRow`(`title`과 `href`는 그 글, `places`는 자리 "대표 이미지") | 쓰는 곳이 없으면 "없음"(`Text variant="note" tone="faint"`). 글이 많으면 패널이 스크롤한다. 긴 제목은 …로 잘리고 자리는 한 줄로 남는다(스토리 `FilePanelManyUses`). |
| 저장 | `SidePanel footer`의 `Button variant="primary"` | 바뀐 것이 있을 때만 있다(원칙 7). 이미지와 파일이 같다. "파일 바꾸기" · "휴지통으로"는 둘 다 ⋯ 안에 있고 발에 두지 않는다(2026-11-05). |

### 흐름 2 · 어시스턴트

단계: 2.19. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

함께 열리는 화면: `AssistantPanel`([assistant.md](assistant.md)).

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| (빠짐, 2026-11-05) `mode` "대체 텍스트 없는 것 고름" | 2.19 | `BulkBar`(3개, `request` "✦ 대체 텍스트") | Patterns/List/BulkBar |
| `withRail` | 2.19 | 켜져 있고 옆 패널이 없을 때만 ✦ 모서리 버튼이 보인다. 다른 보드가 이 보드를 가져다 쓸 때 끈다 |  |

### 흐름 6 · 미디어

단계: 6.01, 6.02, 6.03, 6.04, 6.07, 6.08, 6.09, 6.10, 6.13, 6.14, 6.15, 6.16, 6.17, 6.11, 6.12, 6.18, 6.19, 6.20, 6.21, 6.22, 6.23, 6.24, 6.25, 6.26, 6.27, 6.28, 6.32, 6.33, 6.34, 6.35, 6.36, 6.31. 단계마다 보이는 것은 [flows/06-media.md](../flows/06-media.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `mode` "최상위" | 6.07 | 경로 없음, `FolderTile` 행(상위 폴더 없음), 어느 폴더에도 없는 파일 `Tile` | Patterns/List/Tile |
| `mode` "폴더 안" | 6.08 | 경로, 하위 폴더, 파일 `Tile`(기본값). "상위 폴더로" 타일은 없다 | Patterns/List/Tile |
| (빠짐, 2026-11-05) `mode` "필터 열기" | 6.22 | "대체 텍스트 ▾" `DropdownMenu` | Controls/Menu/DropdownMenu |
| `mode` "새 폴더" | 6.09 | 폴더 행 끝 `FolderTile` + `RenameField` | Patterns/List/Tile, Patterns/List/RenameField |
| `mode` "폴더 우클릭" | 6.10 | 폴더 `ContextMenu` | Controls/Menu/ContextMenu |
| `mode` "폴더 지움" | 6.11 | 폴더가 빠지고 `toast` "…휴지통으로 옮겼어요" + "되돌리기" | Controls/Status/Toast |
| `mode` "폴더 일부 남김" | 6.12 | `toast` "…4개는 쓰는 곳이 있어 남겼어요" + "보기" | Controls/Status/Toast |
| `mode` "빈 곳 우클릭" | 6.13 | 빈 곳 `ContextMenu` | Controls/Menu/ContextMenu |
| `mode` "파일 메뉴" | 6.17 | 파일 `ContextMenu`와 "쓰는 곳" `ContextMenuSub` | Controls/Menu/ContextMenu |
| `mode` "목록 보기" | 6.14 | 격자 대신 `Table`, 보기 `Segmented`가 "목록" | Patterns/List/Table, Controls/Choice/Segmented |
| `mode` "끌어 놓기" | 6.01 | `DropArea over`, `toast.dropHint` "여기에 올려요" | Patterns/List/DropArea, Controls/Status/Toast |
| `mode` "폴더 위로 끌기" | 6.02 | 그 `FolderTile dropTarget`, `toast.dropHint` "covers에 올려요" | Patterns/List/Tile, Controls/Status/Toast |
| `mode` "올리는 중" | 6.03 | `Tile status="uploading"`과 대기 타일 | Patterns/List/Tile |
| `mode` "올리기 실패" | 6.04 | `Tile status="failed"`, `Tile status="interrupted"`, 둘 다 `action`에 × | Patterns/List/Tile |
| `mode` "파일 열기" | 6.16 | 옆 패널 `SidePanel`, 그 타일 `current` | Controls/Overlay/SidePanel |
| `mode` "바꾸기 메뉴" | 6.18 | 패널 ⋯ `DropdownMenu` | Controls/Menu/DropdownMenu |
| `mode` "파일 바꾸기" | 6.19 | `AlertDialog`(옛 파일 → 새 파일) | Controls/Overlay/AlertDialog |
| `mode` "여러 개 선택" | 6.20 | `BulkBar`, 고른 `Tile selected` | Patterns/List/BulkBar, Patterns/List/Tile |
| `mode` "폴더로 옮기기" | 6.21 | `BulkBar`의 "폴더로" `DropdownMenu` | Patterns/List/BulkBar, Controls/Menu/DropdownMenu |
| `mode` "찾는 중" | 6.15 | `SearchBox`(검색어 "cover"), 찾는 곳 `Segmented`가 "모든 폴더", 세부 줄 앞에 폴더 경로, 폴더 행 없음 | Controls/Field/SearchBox, Controls/Choice/Segmented |
| (빠짐, 2026-11-05) `mode` "필터 걸림" | 6.23 | `Chip` "대체 텍스트: 없음 ×", 찾는 곳 `Segmented` | Controls/Choice/Segmented |
| (빠짐, 2026-11-05) `mode` "대체 텍스트 없는 것 고름" | 6.24 | `BulkBar`(3개, `request` "✦ 대체 텍스트") | Patterns/List/BulkBar |
| (빠짐, 2026-11-05) `mode` "대체 텍스트 제안" | 6.25 | `ProposalBar`, `Tile proposal` 셋 | Monti/Proposal/ProposalBar, Patterns/List/Tile |
| (빠짐, 2026-11-05) `mode` "대체 텍스트 메모" | 6.26 | `MemoCardPopover`가 한 타일에 열림 | Monti/Proposal/MemoCard |
| `mode` "휴지통으로 옮김" | 6.27 | 그 타일이 빠지고 `toast` + "되돌리기" | Controls/Status/Toast |
| `mode` "일부 남김" | 6.28 | `toast` "…1개는 쓰는 곳이 있어 남겼어요" + "보기" | Controls/Status/Toast |
| `mode` "저장소 없음" | 6.31 | 저장소 없음의 두 줄, 머리의 알약 "연결 방법", 도구 행 없음, "올리기 ▾" 없음 | Primitives/Text, Controls/Button/Button |
| `mode` "종류 열기" | 6.32 | "종류 ▾" `DropdownMenu` | Controls/Menu/DropdownMenu |
| `mode` "종류 파일" | 6.33 | `Chip` "종류: 파일 ×", 파일 `Tile`만, "대체 텍스트 ▾" 없음 | Patterns/List/Tile |
| `mode` "PDF 올리는 중" | 6.34 | `FilePreview`가 든 `Tile status="uploading"`과 대기 타일 | Patterns/List/FilePreview, Patterns/List/Tile |
| `mode` "받지 않는 형식" | 6.35 | `FilePreview`가 든 `Tile status="failed"`(빼기) | Patterns/List/FilePreview, Patterns/List/Tile |
| `mode` "PDF 열기" | 6.36 | 파일용 옆 패널(대체 텍스트와 캡션 없음, "파일 바꾸기" · "휴지통으로"는 이미지처럼 ⋯ 안) |  |

## 이미지 넣기 (ImageInsert)

- 보드: `ImageInsert.dc.html`. 상태와 흐름 단계: [screens.md › ImageInsert](../screens.md#imageinsert).
- 공통 틀: 뒤의 편집기는 [editor.md](editor.md). 창은 [common.md](common.md)의 작은 폼 창과 같은 표면이다.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 창 | `MediaPicker`(`open`, `title` "라이브러리" · "대표 이미지" · "파일") | 760px 모달 하나가 전부다. 폴더를 바꿔도 높이가 그대로이고, 폴더 목록과 타일이 각각 안에서 스크롤한다(2026-11-09 소유자). 편집기의 "/ 이미지" · "/ 파일"과 대표 이미지 필드가 연다. 탭 없이 라이브러리 한 화면이다. |
| 폴더 목록 | `MediaPicker`의 `folders`(`depth`, `count`), `allLabel` "모든 이미지" · "모든 파일", `folder` | 사이드바의 트리를 그대로 쓴다(2026-11-09 소유자): 맨 위 행은 `NAV_ROW`(아이콘 없음. 창 자체가 라이브러리다), 그 아래는 `SidebarMenuSub`와 `SidebarMenuSubButton`이다. 깊이, 선, 개수, 고른 폴더의 모양(잉크와 굵은 글자, 바탕 없음)이 사이드바와 같다. 열 너비는 216px이다. |
| 검색 | `MediaPicker`의 `search`, `onSearchChange`, `searchLabel` "파일 이름 검색" | 늘 입력 칸이다. |
| 타일 | `MediaPicker`의 `children`에 `Tile`(파일은 `preview`에 `FilePreview`) | 하나를 고르면 고름 테가 생긴다. 고른 채 알약을 누르면 바로 들어간다. 대체 텍스트와 캡션은 넣은 뒤 편집기에서 쓴다. |
| "더 보기" | `MediaPicker`의 `children` 끝에 `TextButton` | 100개를 넘을 때만 있다. 눌러 100개를 더 읽는다(2026-11-09). 1000개까지 읽고, 그보다 많으면 `Text variant="note" tone="subtle"` "더 있어요. 검색으로 찾아 주세요."가 대신한다. |
| "올리기" | `MediaPicker`의 `uploadLabel`, `onUpload` | 왼쪽 아래, 올리기 아이콘이 붙은 ghost 버튼이다(`button.md`). 고른 파일은 붙여넣기처럼 페이지에 넘긴다. |
| "취소" · "넣기"/"고르기" | `MediaPicker`의 `confirmLabel`("넣기", 대표 이미지는 "고르기"), `onConfirm` | 아무것도 고르지 않았으면 알약이 없다(`confirmHidden`). 타일을 고르면 나타난다(원칙 7, 2026-11-05 소유자). |

스토리: Patterns/Sheet/MediaPicker, Patterns/List/Tile, Patterns/List/FilePreview.

### 흐름 6 · 미디어

단계: 6.29, 6.30, 6.37. 단계마다 보이는 것은 [flows/06-media.md](../flows/06-media.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "라이브러리" | 6.29 | 제목 "라이브러리", "모든 이미지", 이미지 `Tile`, 알약 "넣기" | Patterns/List/Tile |
| `stage` "대표 이미지" | 6.30 | 제목 "대표 이미지", "모든 이미지"에서 시작, 알약 "고르기" |  |
| `stage` "파일" | 6.37 | 제목 "파일", "모든 파일", 파일 `Tile`(`FilePreview`), 알약 "넣기" | Patterns/List/Tile, Patterns/List/FilePreview |
