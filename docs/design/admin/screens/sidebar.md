# 사이드바 (Sidebar, SidebarRail, SidebarTheme)

[common.md](common.md)의 "왼쪽 내비게이션"이 가리키는 지도다. 모든 화면이 이 사이드바 하나를 쓴다. 규칙은 [sidebar.md](../components/sidebar.md)에 있다.

## 사이드바 (Sidebar)

- 보드: `Sidebar.dc.html`. 상태: [screens.md › Sidebar](../screens.md#sidebar).
- 공통 틀: 툴팁, 메뉴.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 틀 | `SidebarProvider`(`rail`, `onRailChange`, `resizeKey`, `fixed`) + `Sidebar`(`label` "관리 메뉴") | 폭 232px에서 시작하고 가장자리를 끌어 200–400px로 바꾼다. 접힌 상태와 폭은 이 브라우저에 기억한다. 좁은 화면에서는 서랍이 된다. |
| 머리: 사이트 이름 | `SidebarHeader` 안의 `Text variant="title" truncate` | 긴 이름은 말줄임표. 사이트로 가는 링크는 없다. |
| 머리: 접기 | `SidebarRailToggle` | 이름과 툴팁이 "사이드바 접기" / "사이드바 펼치기"를 말하고, 툴팁에 ⌘B. |
| 위 묶음: 컬렉션 | `SidebarContent` > `SidebarGroup` > `SidebarMenu` > `SidebarMenuItem` > `SidebarMenuButton`(`href`, 아이콘, 이름, `isActive`, `tooltip` "게시글 148") | 스키마의 컬렉션마다 한 행(게시글, 메모, 카테고리, 태그, 시리즈, 노트 …), 스키마 순서. 지금 위치는 `isActive`(`bg-current`, 600). 포인터 아래 행은 `bg-selected`. |
| 컬렉션의 글 수 "148" | `SidebarMenuBadge` | mono, 행 오른쪽 끝. 접히면 숨는다. |
| 글 폴더 트리 "시리즈 원고 2" | `SidebarMenuSub` > `SidebarMenuSubButton`(`depth`, `isActive`), 개수는 `Count` | 그 컬렉션이 열려 있을 때만 그 아래에 보인다. 폴더 안이면 컬렉션 행은 현재 위치로 남고, 열린 폴더가 `isActive`로 굵어진다. 36px 들여쓰기는 행 안쪽 여백이라 바탕은 위 행과 같은 폭이다. |
| "미디어" | `SidebarMenuButton`(`href`, `isActive`) | |
| 미디어 폴더 트리 "Blog Assets 14 · covers 6 · …" | `SidebarMenuSub` > `SidebarMenuSubButton`(`depth`, `isActive`, 파일을 끌어 올 때 `dropTarget`), 개수는 `Count` | 미디어가 열려 있을 때만 보인다. 파일을 폴더 행 위로 끌면 그 폴더로 옮긴다. 밖에서 끌어 온 파일을 놓으면 그 폴더에 올리고, 위에 있는 동안 아래 알약이 "**covers**에 올리기"를 말한다(폴더 카드와 같다, 07번 문서). 올리는 일은 열린 미디어 화면이 한다. 저장소가 없어 올릴 수 없는 동안에는 파일을 받지 않는다. |
| 아래 묶음 "휴지통 · 도구 · 설정" | `SidebarFooter` > `SidebarMenu` > `SidebarMenuButton` | 휴지통 개수는 `SidebarMenuBadge`, 도구 개수(실패한 전송)는 경고 색 `SidebarMenuBadge tone="warning"`. 새로 설치한 사이트는 개수가 없다. |
| 접힌 동안의 이름 | `SidebarMenuButton`의 `tooltip`("도구 1") | 이름과 개수를 툴팁이 말한다. |
| 접힌 동안의 도구 표시 | `SidebarMenuButton`의 `railDot`("실패한 전송") | 도구에 실패가 있으면 아이콘 오른쪽 위에 점. 휴지통 개수는 점으로 바꾸지 않는다. |
| 화면 모드 | `SidebarFoot` 안의 `SidebarScreenMode`(`value`, `onValueChange`, `labels`) | 펼치면 세 칸 토글(`Segmented tone="tool"`: 시스템 · 밝게 · 어둡게, 아이콘 화면 · 해 · 달), 지금 모드는 눌린 칸(`bg-current`). 접히면 아이콘 버튼 하나가 지금 모드를 보이고, 누르면 위로 작은 메뉴가 열려 지금 모드에 ✓. 한 번 누르면 바뀐다. 이름은 [sidebar.md](../components/sidebar.md)의 "시스템 · 밝게 · 어둡게"를 따른다. 보드의 "라이트 · 다크"는 바꾼다. |

### 화면마다 달라지는 것

사이드바는 흐름의 화면이 아니라 모든 화면의 틀이다. 각 화면은 아래 값 중 하나로 사이드바를 그린다(현재 위치 `active` 등).

| 상태 · prop | 더해지는 것 |
|---|---|
| `active` "posts" | "게시글" `isActive`, 글 폴더 트리 |
| "memo" · "category" · "tag" · "series" | 그 행 `isActive` |
| "media" | "미디어" `isActive`, 미디어 폴더 트리 |
| "media-folder" | "미디어" `isActive`, 트리의 "Blog Assets" `isActive` |
| "media-covers" | "미디어" `isActive`, 트리의 "covers" `isActive` |
| "trash" · "tools" · "settings" | 그 행 `isActive` |
| "none" | 어떤 행도 `isActive`가 아니다(템플릿 편집기처럼 사이드바 밖의 페이지) |
| `rail` | `SidebarProvider rail`: 아이콘만, 이름과 개수 숨김, 트리 숨김, 머리에는 펼치기만, 화면 모드는 아이콘 버튼, 도구에 `railDot` |
| `railTip` | 접힌 "도구" 행의 툴팁 "도구 1" |
| `theme` "system" · "light" · "dark" | `SidebarScreenMode`의 눌린 칸(접히면 아이콘) |
| `themeMenu` | 접힌 화면 모드의 메뉴가 열림(✓는 지금 모드) |
| `trashCount` · `toolsCount` · `blogCount` · `coversCount` | 그 행의 `SidebarMenuBadge` 또는 `Count` 숫자 |
| `noMemo` · `withNote` | 메모 행이 없다 · 노트 행이 더해진다(컬렉션 행은 스키마를 따른다) |
| `noPostFolders` | 글 폴더 트리가 없다 |
| `postFolderOn` | 글 폴더 행 `isActive` |
| `noDiagrams` | 미디어 트리에 "diagrams"가 없다 |
| `fresh` | 새로 설치한 사이트: 글 수, 휴지통, 도구 개수가 없고 글 폴더 트리가 없다 |

## 사이드바 · 접힘 (SidebarRail)

- 보드: `SidebarRail.dc.html`. Sidebar에 `rail`과 `railTip`을 켠 것이다. 상태: [screens.md › SidebarRail](../screens.md#sidebarrail).

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 접힌 사이드바 | `SidebarProvider rail` + `Sidebar` | 48px 레일. 양옆 6px라 36px 행이 꽉 찬다. 아이콘은 펼쳤을 때와 같은 자리에 있다. |
| 펼치기 | `SidebarRailToggle` | 머리에 남는 것은 이것뿐이다. |
| 행 | `SidebarMenuButton`(`tooltip`, 도구는 `railDot`) | 이름과 숫자는 숨고 툴팁이 말한다. |
| 툴팁 "도구 1" | `SidebarMenuButton`의 `tooltip`(속은 `TooltipContent side="right"`) | 포인터나 키보드가 행에 오면 보인다. |
| 화면 모드 | `SidebarScreenMode` | 아이콘 버튼 하나. |

### 상태

| 상태 · prop | 더해지는 것 |
|---|---|
| (prop 없음) | 접힌 사이드바, "도구" 툴팁, 도구 `railDot` |

## 사이드바 · 화면 모드 (SidebarTheme)

- 보드: `SidebarTheme.dc.html`. 어두운 테마의 펼친 Sidebar와, `rail` · `themeMenu`를 켠 Sidebar를 나란히 둔다. 상태: [screens.md › SidebarTheme](../screens.md#sidebartheme).

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 펼친 사이드바의 화면 모드 | `SidebarScreenMode`(`value` "dark") | 세 칸 중 "어둡게"가 눌린 칸. |
| 접힌 사이드바의 화면 모드 메뉴 | `SidebarScreenMode`(접힌 동안 아이콘 버튼과 위로 열리는 메뉴) | 메뉴 행은 "시스템" · "밝게" · "어둡게", 지금 모드에 ✓. 고르면 바로 바뀌고 닫힌다. 보드의 "라이트 · 다크"는 [sidebar.md](../components/sidebar.md)를 따라 "밝게 · 어둡게"로 쓴다. |

### 상태

| 상태 · prop | 더해지는 것 |
|---|---|
| (prop 없음) | 왼쪽: 펼친 사이드바 `theme` "dark". 오른쪽: 접힌 사이드바 `theme` "dark"와 열린 화면 모드 메뉴 |

