# 공통 틀

여러 화면이 함께 쓰는 자리다. 각 화면의 지도는 이 자리들을 "공통 틀"이라고만 적고, 다시 풀어 쓰지 않는다.

## 화면 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 왼쪽 내비게이션 | `Sidebar`와 그 가족(`SidebarProvider`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuBadge`, `SidebarFooter`, `SidebarScreenMode`, `SidebarRailToggle`) | 자리마다의 쓰임은 [sidebar.md](sidebar.md). 현재 위치는 `SidebarMenuButton`의 활성 상태다. |
| 페이지 단 | `PageColumn` | 목록 화면(글, 미디어, 휴지통, 도구의 표)은 `width="list"`, 설정과 입력 화면은 `width="content"`. 스크롤되는 것은 `PageBody`다. |
| 제목 행 | `PageHeader` | `title`은 화면 이름, `meta`는 목록의 주소 규칙(`/posts/:slug`, mono), `trail`은 폴더 경로나 "‹ 어시스턴트" 같은 돌아가는 길, `children`은 오른쪽 동작(보조 알약 먼저, 검은 알약 하나 마지막). |
| 제목 아래 탭 (설정, 도구) | `PageToolbar` 안의 `TabLinks`와 `TabLink` | 탭 하나가 페이지 하나다(주소가 바뀐다). 고른 탭은 굵기만 다르다(밑줄 없음). 바뀐 것이 있는 탭은 이름 뒤에 `ChangeDot`. |
| 설정 한 절 | `Section` | 왼쪽에 제목, 오른쪽에 필드, 아래 가는 선. 전부 구조인 절은 제목 뒤에 `LockMark`. |
| 저장 묶음 (설정) | `ChangesGroup` | "바뀐 곳 N ▾" · "모두 되돌리기" · "저장하고 적용". 바뀐 것이 없으면 나타나지 않는다. 막는 것이 있으면 알약은 숨지 않고 비활성이다. |
| 줄 안의 세로 구분선 | `Separator orientation="vertical"`: 툴바와 머리는 `length="control"`, 뜬 막대는 `length="bar"`. 줄의 간격이 띄우면 `flush` | 선 양옆의 자리는 줄의 `gap`이 정한다. |
| 가운데 낱말이 있는 가로 줄 | `Separator label`("또는") | 두 가지 길 사이(로그인의 비밀번호와 GitHub). 낱말은 캡션 크기, 흐린 색, 양쪽 선에서 12px. |
| ✦ 어시스턴트 열기 | `IconButton`(`label` "어시스턴트 열기", 아이콘 `Spark`) | 머리가 있는 화면은 머리 오른쪽 끝, 머리가 없는 화면은 오른쪽 위 모서리에 뜬다. 누르면 어시스턴트 사이드 패널이 열리고 버튼은 그 아래로 가려진다. |

## 뜨는 면

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 확인 질문 | `AlertDialog`(`AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`) | 몇 초 안에 끝나는 결정에만 쓴다. 되돌릴 수 없는 것과 발행된 글을 내리는 것만 묻는다. 위험하면 `AlertDialogAction`이 `Button variant="danger"`다. 휴지통으로 옮기기(초안, 메모, 미디어, 폴더)는 묻지 않고 토스트의 "되돌리기"를 준다. |
| 작은 폼 창 | `Dialog`(`DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`)와 `DialogFormFooter` | 입력이 한두 개인 창(고른 글 내보내기, 언어 직접 입력). 포커스는 첫 텍스트 필드로 간다. 입력이 여럿이거나 길면 시트를 쓴다. |
| 시트 | `Sheet`(`SheetContent`, `SheetHeader`, `SheetTitle`, `SheetBody`, `SheetSection`, `SheetSplit`, `SheetFooter`) | 만드는 일(필드 추가, 저장 검토, 가져오기). 오른쪽에서 열리고 뒤를 흐린다. 발에는 "취소"(`TextButton`)와 알약 하나. 일하는 동안 `closable={false}`. |
| 사이드 패널 | `SidePanel`(`width` `side`·`panel`·`assistant`) | 화면 옆에서 함께 보는 것(파일, 활동 자세히, 항목, 어시스턴트). 머리 끝의 ×로 닫는다. 저장할 것이 있으면 `footer`에 알약 하나. |
| 결과 한 줄 | `toast`(`Toaster`가 그린다), 실패는 `toast.error` | 동작 직후의 한 줄과, 있으면 `action` 하나("되돌리기", "보기"). 꼭 봐야 하는 것은 할 일이나 상태 줄에도 남긴다. |
| 그릴 수 없는 미리보기 | `ErrorBox` | 블록 미리보기가 오류로 그려지지 않을 때. 줄바꿈을 지키고 `role="alert"`. |
| 목록 위나 편집기 위 알림 | `Banner`(`tone` `warning`·`danger`) | 글 전체에 관한 것은 편집기 머리 바로 아래, 목록에 관한 것은 그 목록 바로 위. 오른쪽 끝에 `TextButton` 동작. |
| 아이콘만 있는 버튼의 이름 | `Tooltip`(`TooltipTrigger`, `TooltipContent`) — `IconButton`의 `label`이 이미 그린다 | 한두 낱말과 단축키. |

## 메뉴

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| ⋯ 메뉴, 글자 버튼이 여는 메뉴 | `DropdownMenu`(`DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuCheckboxItem`, `DropdownMenuLabel`, `DropdownMenuSearch`, `DropdownMenuScroll`), 끝의 표시는 `MenuShortcut`·`MenuTick`·`MenuValue` | 할 수 있는 것만 둔다. 위험한 것은 맨 아래 `variant="danger"`. 둘째 단계까지만. 할 수 없는 행은 숨긴다. |
| 행 오른쪽 클릭 | `ContextMenu`(`ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuSeparator`, `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent`, `ContextMenuLabel`) | 같은 항목이 행의 ⋯에도 있다. 메뉴가 열린 동안 그 행은 호버 바탕을 유지한다. |
| 값을 여는 글자 버튼 (모델, 쪽마다) | `ModelMenuButton`, `PageSizeMenu`(둘 다 `TextButton variant="quiet" size="meta"` + `Caret`으로 그린다) | mono 12. 메뉴가 열린 동안 잉크. |
| 검색이 있는 고르기 | `Popover`의 `PopoverContent padding="menu"` 안에 `Command`(`CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandEmpty`, `CommandFooter`) | 값이 많은 고르기(언어 코드, 태그, 링크할 글). |

## AI 버튼

어시스턴트에게 시키는 버튼은 하는 일에 따라 모양이 하나씩이다. ✦는 언제나 `Spark`다.

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 필드 하나 채우기 (속성 패널, 이미지 카드의 대체 텍스트, 폼 필드, 캡션) | `TextButton tone="proposal" size="micro"`(일하는 동안 `loading`) | "✦ 채우기", 값이 있으면 "↻ 다시", 일하는 동안 "쓰는 중…". 라벨이 있으면 라벨 줄 끝(`FormFieldLabel action`), 라벨이 없는 캡션은 같은 줄 끝. 값은 제안 없이 곧바로 들어간다. |
| 글 여러 곳을 한 번에 ("✦ 번역", "✦ 빈 칸 채우기") | `TextButton tone="proposal"`(앞에 `Spark`) | 누르면 어시스턴트가 여러 곳을 바꾸고, 바뀐 것은 파란 제안으로 남는다. 값 칸의 제안은 그 입력 부품의 `proposal`이다(`Input`, `Textarea`, `ComboboxInput`). |
| 고른 글자에 묻기 | `FormatBarRequest` | 서식 카드 끝 "✦ 요청". |
| 할 일 행의 동작 | `TodoItem proposal` | 행 끝 "✦ 채우기", "✦ 번역". |
| 메모 카드에서 받으며 다시 시키기 | `MemoCard`(`acceptSpark`) | 검은 작은 알약 "✦ 다시 번역". |
| 목록에서 고른 것에 시키기 | `BulkBar`의 `request`(`TextButton tone="proposal"`) | "✦ 요청", 미디어는 "✦ 대체 텍스트". |
| 빈 어시스턴트 패널의 시작 요청 | `Suggest` | 앞에 ✦가 붙은 한 줄. |

## 테마

모든 화면에 어두운 테마가 있다. 사이드바의 화면 모드(`SidebarScreenMode`)로 고른다. 보드의 `dark` prop이 그 모양이고, 부품은 같다.
