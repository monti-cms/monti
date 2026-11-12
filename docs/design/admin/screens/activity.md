# 활동 기록 (Events)

- 기준 화면: `Screens/Reference/Lists` › Events…. 실제 화면의 상태는 `Screens/Activity`. 상태와 흐름 단계: [screens.md › Events](../screens.md#events), [흐름 12](../flows/12-activity-log.md).
- 공통 틀: [common.md](common.md)의 왼쪽 내비게이션(`Sidebar`, 실패한 전송 수는 "활동 기록" 행의 `SidebarMenuBadge tone="warning"`), 페이지 단(`PageColumn width="list"`), 화면의 알림 띠(`PageBanner`), ✦ 어시스턴트 열기, 확인 질문, 사이드 패널, 토스트, 행 오른쪽 클릭.
- 표와 열 이름 행의 쓰임은 [list.md](list.md)의 게시글 목록, [trash.md](trash.md)의 휴지통과 같다. 이 절은 활동 기록이 다른 것만 적는다.
- 무엇을 하는 화면인지는 [기능 설계 13](../../features/13-activity-and-delivery.md)에 있다. 이 화면의 결정은 코드를 쓰기 전에 시안으로 정했다(2026-11-12 소유자).
- 활동 기록은 사이드바에 제 행이 있는 화면이다. 도구의 탭이 아니다(2026-11-12 소유자). 주소는 `#/activity`이고 찾는 말 · 거르기 · 정렬 · 쪽 · 열린 줄이 주소에 든다.
- 이 화면만의 부품은 없다. 휴지통과 게시글 목록이 쓰는 부품과 코드를 그대로 쓴다(기능 설계 13의 "다른 목록에서 가져다 쓴 것").

## 기본 틀

### 제목 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 행 | `PageHeader`(`title` "활동 기록") | 탭 줄이 없다. 제목 바로 아래가 표다(휴지통과 같다). |
| "검색" | `SearchToggle`(`label` "검색", `targets` 없음) | 그 자리에서 `SearchBox`가 열린다. 글 이름, 어시스턴트에게 한 요청, 파일 이름으로 찾는다. 기록이 하나도 없으면 없다. |

### 표

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 표 | `Table`(`layout="fixed"`) + `TableBody` + `TableRow` + `TableCell` | 행은 게시글 목록과 같은 한 줄이다. 한 줄은 쓰기 하나, 또는 어시스턴트가 요청 하나로 한 일 전부다. 새것이 위다. 패널에 열린 행은 `TableRow selected`. 여러 줄을 골라 하는 일이 없어 행 체크는 없다. 날짜 묶음도 없다. 시각 열이 말한다. |
| 작업 칸 | `RowTitle`(`title`, `address`) | 게시글 목록의 제목 칸이다. `title`은 한 일("\"첫 번째 글\" 발행"), 어시스턴트의 줄은 요청 인용("“더 짧게 다듬어 줘.”"). 뒤의 회색 글(`address`)은 어디서("post/first-post", "미디어 · Blog Assets"), 어시스턴트의 줄은 한 일. 명령줄이나 플러그인이 한 줄은 그 뒤에 "명령줄"이나 플러그인 이름, 되돌린 줄은 "되돌림 10:44"가 붙는다. 좁아서 잘리면 `title`이 온전히 말한다. |
| 어시스턴트의 줄 | 작업 칸의 글 앞에 `Text tone="proposal"` 안의 `Icon icon={Spark}`(이름 "어시스턴트") | "한 사람" 열은 없다. 관리자는 한 사람이므로 사람이 한 줄에는 아무 표시가 없다(2026-11-12 소유자). |
| 작업을 누르면 | `RowLink` | 옆 패널이 열린다. |
| 전송 칸 | `EntryStatus`: 실패 `status="failed"` "3번 실패", 보내는 중 `status="draft" quiet` "보내는 중", 취소 `status="archived" quiet` "취소됨" | 잘 간 줄과 보낼 것이 없던 줄은 비운다. 받는 곳이 없는 사이트에는 열이 없다. 폭은 `LIST_COLUMN_SIZE.one`. |
| 시각 칸 | `TableCell align="end" truncate`(`title`) 안의 `Text mono variant="meta" tone="muted"` | "10. 26 10:58". 폭은 `LIST_COLUMN_SIZE.measure`. |
| 행 동작 | `RowActions` 안의 `RowMore` + `DropdownMenu`: "자세히" · "다시 보내기" · "되돌리기", 행마다 앞에 아이콘 | 행의 동작은 모두 ⋯ 안에 있다. "다시 보내기"는 실패한 전송이 있는 줄에만, "되돌리기"는 되돌릴 수 있는 줄에만 있다. 사람이 한 줄도 되돌릴 수 있다(2026-11-12 소유자). "되돌리기"는 묻지 않고 바로 하며 토스트로 알린다. 보내는 동안에는 "다시 보내기"가 없다. |
| 행 오른쪽 클릭 | `ContextMenu` | ⋯와 같은 행이다. |
| 빈 기록 | `Empty`(`title` "아직 기록이 없습니다.") | 열 이름 행과 표 대신 이 한 줄. 휴지통의 빈 목록과 같은 부품이다. |
| 맞는 것이 없음 | `TableRow` 한 줄: `Text tone="subtle"` "맞는 것이 없습니다."와 `TextButton` "필터 해제" | 찾거나 걸렀는데 없을 때. 게시글 목록, 휴지통과 같다. |
| 쪽 | `ListFooter`(`Count`, `ListPages`) | 50줄이 넘을 때만 있다. 쪽을 넘기는 동안 새로 생긴 줄 때문에 줄이 밀리지 않는다. |

스토리: Patterns/Frame/PageHeader, Controls/Field/SearchBox, Patterns/List/Table, Patterns/List/ListHead, Primitives/AI mark, Primitives/Icon, Controls/Status/EntryStatus, Primitives/Text, Controls/Menu/DropdownMenu, Controls/Menu/ContextMenu, Patterns/List/Empty, Patterns/List/Pagination, Patterns/Frame/Banner, Patterns/Frame/PageBanner, Controls/Button/TextButton, Controls/Overlay/SidePanel, Patterns/Frame/DescriptionList, Controls/Overlay/AlertDialog, Controls/Status/Toast.

## 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

### 열 이름 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 열 이름 행 | `ListHead`(`columns`, `end`, `onResize`, `resizeLabel`). 열: "작업" · "전송" · "시각" | 모든 표의 열 규칙을 따른다([list.md](../components/list.md)): 열 사이를 끌어 너비를 바꾸고(이 브라우저에 남는다), 열마다 메뉴가 정렬이나 거르기를 담는다. 걸린 거르기는 열 이름 뒤의 점(`filtered`)이다. 칩과 필터 버튼은 없다. 처음에는 "시각"이 `sort="desc"`(최근부터). |
| "작업" 메뉴 | 그 열 `menu`에 `DropdownMenuCheckboxItem box`와 개수 `MenuShortcut` | 종류마다 한 줄: "AI 제안" · "글 저장" · "글 발행" · "휴지통" · "설정" · "미디어". 여럿을 함께(OR) 고르고 메뉴는 열려 있다. 개수는 다른 열의 거르기와 찾는 말을 적용한 수다. |
| "전송" 메뉴 | 같은 행 | "보내는 중" · "보냄" · "실패" · "취소됨". |
| "시각" 메뉴 | `SortRows`("최근부터" · "오래전부터"), 구분선, 날짜 행(게시글 목록의 날짜 열과 같은 행) | 고르면 닫힌다. 날짜로 걸면 열 이름 뒤에 점이 붙는다. |

### 알림 띠

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 실패 알림 | `PageBanner` 안의 `Banner tone="danger"`(`title` "전송 실패 3건", `meta` "10. 26부터"), 끝에 "보기" `TextButton variant="underline"`(실패로 이미 걸렀으면 없다)과 "모두 다시 보내기" `TextButton` | 실패가 둘 이상일 때만 뜬다. 화면 맨 위, 제목보다 위에 선다([common.md](common.md)의 "화면의 알림 띠"). 실패 하나는 그 행의 빨간 상태가 말하므로 띠가 없다(2026-11-05 소유자). 보내는 동안 "모두 다시 보내기"는 `TextButton loading` "보내는 중…"이고 다시 누를 수 없다. |
| 읽지 못함 | `PageBanner` 안의 `Banner tone="danger"`(`title` "기록을 불러오지 못했습니다", `plainMeta`), "다시 시도" `TextButton variant="underline"` | 표 대신 이 띠만 있다. |

### 옆 패널 (자세히)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel width="side"`(`title`은 그 줄의 작업, 머리 끝 닫기) | 목록 옆에 붙고 ✦ 버튼을 가린다. 미디어와 휴지통이 여는 옆 패널과 같다. |
| 머리의 ⋯ | `IconButton` + `DropdownMenu`: "다시 보내기" · "되돌리기" | 그 행의 ⋯와 같은 동작이다. 할 것이 없으면 ⋯가 없다. |
| 묶음 "요청" | `Heading variant="label"` + `Text` | 어시스턴트의 줄에만. 머리에서 잘린 요청을 온전히 보인다. |
| 묶음 "이벤트" | `DescriptionList` + `DescriptionItem`("시각" · "한 사람" · "되돌림" · "ID") | 누가 했는지는 여기서 말한다("관리자" · "어시스턴트" · "명령줄" · 플러그인 이름). 시각과 ID는 `mono`. |
| 묶음 "한 일 · 4" | `Text variant="note" tone="muted"` 여러 줄 | 어시스턴트의 줄에만: 그 요청으로 한 쓰기 하나하나. |
| 묶음 "항목" | `DescriptionList`("글" · "컬렉션" · "언어" · "주소"). 여럿이면 "항목 · 9"와 이름 목록 | 글 이름은 `TextButton variant="underline"`(`href`)로 그 글을 연다. 영구 삭제되어 없는 것은 글자만이다. |
| 묶음 "전송 · 2" | 받는 곳마다 `DescriptionList`("받는 곳" · "이벤트" · "상태" · "마지막 오류" · "다음 시도") | 상태는 `EntryStatus`(이 패널은 줄 하나의 이야기라 "보냄"도 적는다). 받는 곳, 이벤트 이름(`entry.published`), 오류는 `mono`. 받는 곳이 없는 사이트에는 묶음이 없다. |
| 전송 동작 | "다시 보내기" `TextButton variant="underline"`, "취소" `TextButton variant="quiet"` | 받는 곳마다 그 아래. 실패했거나 기다리는 전송에만. |
| 전송 취소 확인 | `AlertDialog`(`AlertDialogTitle` "이 전송을 취소할까요?", `AlertDialogDescription`의 받는 곳 `mono`), `AlertDialogCancel` "닫기", `AlertDialogAction variant="danger"` "취소하기" | 취소는 되돌릴 수 없어 묻는다. |

## 흐름 2 · 어시스턴트

단계: 2.17, 2.18. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "기본" | 2.17 | 어시스턴트의 줄(✦와 요청 인용), 그 줄 ⋯의 "되돌리기", 되돌린 줄 뒤의 "되돌림 10:44" | Primitives/AI mark |
| "찾음" | 2.18 | 검색 상자에 글 이름, 그 글에 한 일만 남은 표 | Controls/Field/SearchBox |

## 흐름 9 · 데이터

단계: 9.10. 단계마다 보이는 것은 [flows/09-data.md](../flows/09-data.md)에 있다. 가져오기의 줄과 그 자세히 패널은 가져오기를 만드는 14번에서 더한다(T142).

## 흐름 12 · 활동 기록

단계: 12.01, 12.01b, 12.02, 12.02b, 12.03, 12.04, 12.04b, 12.05, 12.06, 12.07, 12.08, 12.09, 12.09b, 12.10, 12.11. 단계마다 보이는 것은 [flows/12-activity-log.md](../flows/12-activity-log.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "실패 알림" | 12.01 | 실패한 행 하나: 전송 칸 `EntryStatus` "3번 실패". 띠는 없다(실패가 하나라서). 사이드바 "활동 기록 1" |  |
| "실패만" | 12.01b | "전송" 열 이름 뒤의 점, 실패한 행만 | Patterns/List/ListHead |
| "다시 보내는 중" | 12.02 | 그 행의 전송 칸이 "보내는 중", ⋯에 "다시 보내기" 없음 |  |
| "다시 보냄" | 12.02b | 표의 한 줄 "맞는 것이 없습니다." + "필터 해제", `toast` "보냈습니다", 사이드바 숫자 없음 | Controls/Status/Toast |
| "자세히" | 12.03 | 자세히 `SidePanel`(이벤트 · 항목 · 전송 · 2), 그 행 `selected`, ✦ 가려짐 | Controls/Overlay/SidePanel |
| "취소 확인" | 12.04 | 자세히 패널 위 `AlertDialog` | Controls/Overlay/AlertDialog |
| "취소됨" | 12.04b | 그 행의 전송 칸 "취소됨"(흐림), `toast` "전송을 취소했습니다" | Controls/Status/Toast |
| "실패 3건" | 12.05 | 실패한 행 셋(각 "N번 실패"), 화면 맨 위 `Banner` "전송 실패 3건", 사이드바 "활동 기록 3" | Patterns/Frame/Banner |
| "모두 보내는 중" | 12.06 | `Banner`의 "모두 다시 보내기"가 "보내는 중…", 실패한 행들의 전송 칸이 "보내는 중" | Patterns/Frame/Banner |
| "모두 보냄" | 12.07 | 띠와 사이드바 숫자 없음, `toast` "3건 보냈습니다" | Controls/Status/Toast |
| "일부 실패" | 12.08 | 남은 실패 행 하나 "1번 실패"(띠는 사라진다), `toast` "2건 보냈습니다 · 1건 실패" | Controls/Status/Toast |
| "열 메뉴" | 12.09 | "작업" 메뉴(종류와 개수), "전송" 메뉴(상태와 개수) | Controls/Menu/DropdownMenu |
| "걸림" | 12.09b | 걸린 열 이름 뒤의 점, 맞는 행만 | Patterns/List/ListHead |
| "받는 곳 없음" | 12.10 | "전송" 열, 띠, 패널의 전송 묶음, ⋯의 "다시 보내기"가 없다 |  |
| "비어 있음" | 12.11 | `Empty` "아직 기록이 없습니다." | Patterns/List/Empty |
