# 메뉴

이 페이지는 뜨는 메뉴 카드와 그것을 쓰는 모든 것을 다룬다. ⋯ 메뉴, 블록 메뉴, "/" 넣기 메뉴, 템플릿 고르기, 오른쪽 클릭의 행 메뉴, 고르기 목록이다.

## 메뉴 카드

뜨는 메뉴 카드다. 종이 바탕, `border-emphasis`, `radius-xl`, `shadow-floating`. 폭은 240px(`width-menu`)이고, 더 긴 행이 있으면 넓어질 수 있다.

- 그룹 이름은 mono 11px이다. 단축키는 오른쪽에 mono로 둔다.
- 단축키는 관리자 화면이 도는 시스템에 맞춰 쓴다. Mac에서는 "⇧⌘D"(⌥⇧⌘ 순서의 글리프, 구분자 없음), Windows와 Linux에서는 "Ctrl+Shift+D"다. 툴팁에서도 같은 규칙을 따른다. 화면은 글리프를 직접 쓰지 않는다. 키를 넘기면(`["mod", "shift", "D"]`, `mod`는 ⌘ 또는 Ctrl) `@monti-cms/ui`의 `formatShortcut` / `useShortcut` / `Shortcut`이 쓴다. 그래서 Mac과 Windows 표기를 정하는 곳이 한 군데다. `MenuShortcut keys`와 `TooltipContent shortcut`이 키를 받는다.
- 메뉴에는 여기서 할 수 있는 것만 둔다. 할 수 없는 것은 흐리게 두고 이유를 붙이는 대신 숨긴다. 항목이 하나만 남은 메뉴는 ⋯를 없애고, 그 하나는 행에서 바로 한다. "이름 바꾸기"만 남으면 이름을 눌러 그 자리에서 바꾼다(`.mt-rename`).
- `bg-selected` 바탕(`is-on`)은 포인터나 키보드가 놓인 행, 그리고 둘째 단계가 열린 행에만 쓴다.
- 값 하나를 고르는 메뉴는 지금 값의 오른쪽에 ✓를 단다(`.tick`). 값을 누르면 곧바로 적용되고 메뉴 전체가 닫힌다.
- 예외는 열 메뉴의 필터 값이다. 필터는 값을 여럿 함께 고를 때가 많아서, 값을 골라도 메뉴가 열려 있다(기간의 두 번째 날짜를 고른 뒤에도). Esc나 바깥을 누르면 닫힌다. 같은 메뉴의 정렬은 고르면 닫힌다.
- ›가 있는 행은 이름 뒤에 지금 값을 흐리게 보인다(`.val`, "최근 수정").
- 화면 아래쪽 가까이에 있는 메뉴는 위로 열린다.
- 값 하나가 더 필요한 행은 `.sub` ›로 끝나고, 옆에 둘째 단계를 연다(블록 메뉴의 "다른 블록으로 바꾸기"와 "정렬", 오른쪽 클릭한 행의 "폴더로"). 이 메뉴들은 마우스로 열기 때문에 이렇게 해도 된다. 둘째 단계는 화면 쪽으로 열리고, 지금 값에 ✓나 체크를 단다. 셋째 단계는 쓰지 않는다.
- 예외: 편집기의 "/" 메뉴는 글을 쓰다가 키보드로 여는 것이라 한 단계만 쓴다. 위아래 화살표와 타자만으로 쓸 수 있어야 한다.
- 메뉴 행 안에는 버튼이나 토글 그룹을 넣지 않는다. 고를 값은 둘째 단계로 보낸다.
- 행은 32px(`height-control-md`)이다. 메뉴, 고르기와 콤보박스의 목록, `Command`, `PickList`가 모두 같은 행(`MENU_ROW`)을 쓴다. 위아래 여백으로 높이를 만들지 않고 글은 행 가운데에 선다. 둘째 줄(`caption`)이 있는 행만 두 줄 높이이고 위아래 7px이다.
- 둘째 단계에 값이 많으면(태그) 맨 위에 자기 검색 행을 둔다.
- 여러 행의 값을 한꺼번에 바꾸는 체크 행은 상태가 셋이다. ☑(`.mt-check.is-on`)는 모두 가진 것, –(`.mt-check.is-mixed`)는 일부가 가진 것, ☐는 아무도 갖지 않은 것이다. 일부일 때는 오른쪽에 흐린 `n/N`(`.k`, "1/2")을 둔다. 누르면 모두에 더하고, ☑였으면 모두에서 뺀다. 메뉴는 열려 있다.
- 글자 버튼에서 여는 메뉴(`.mt-dropdown`): 카드는 버튼 12px 아래에 열리고, 행 글자는 버튼 글자와 같은 세로선에서 시작한다(카드 6 + 행 9 = 왼쪽 -15px). 열린 버튼은 잉크다(`.is-open`). 이 메뉴의 행이 둘째 단계를 열면, `.mt-submenu`는 그 행 안에 들어가 첫 행이 그 행과 같은 높이에 오고 카드에서 4px 떨어진다(`.mt-menu-item.has-sub`). 버튼이 첫째 단계이므로 셋째 단계는 없다.
- 메뉴 안에서는 행을 끌어 순서를 바꾸지 않는다. 뜬 메뉴 안에 갇힌 끌기는 어색하고, 끝까지 끌면 메뉴가 스크롤된다. 열은 열 메뉴의 숨기기와 ⋯ 위의 +로 켜고 끄며, 표의 열 이름을 끌어 순서를 바꾼다(목록 참고).
- 항목이 많은 메뉴("/" 넣기 메뉴)는 맨 위에 검색 행(`mt-menu-search`)을 두고, 그 아래 목록은 320px까지 보이고 안에서 스크롤된다(`mt-menu-scroll`). 타자를 치면 그룹을 가로질러 걸러진다.
- "/" 메뉴는 줄 어디서든 친 "/" 아래에 열린다(빈 줄만이 아니라 문장 중간에서도, 노션처럼, 2026-11-06 소유자). 그냥 빗금을 쓰려던 것이면 Esc로 닫고, 친 말에 맞는 행이 없으면 저절로 닫힌다. 글자 사이에 들어가는 것(각주)은 "/" 자리에, 블록은 줄에 글이 있으면 그 줄 아래에 새 블록으로 들어간다. 화면 아래쪽 가까이에서는 "/" 위에 열린다. 포커스는 본문에 둔다. 검색 행은 "/" 뒤에 친 글자를 보이고, 화살표, Enter, Esc가 키보드로 움직인다. 그룹은 "글"(문단, 소제목, 목록, 인용, 구분선), "넣기"(이미지, 표, 코드 블록, 파일, 다른 글 링크, 각주, 플러그인이 넣는 것), "컴포넌트"(사이트의 블록), "템플릿"(글 템플릿, 이름과 섹션)이다. 그룹 이름에 설명을 붙이지 않는다(2026-11-06, 소유자). "템플릿"을 치면 목록이 템플릿으로 좁혀진다. 템플릿은 친 "/" 자리, 커서 위치에 새 블록 id를 가진 사본으로 들어간다. 아무것도 묻지 않으며, 본문 허용 목록이 허락하지 않는 블록이 든 템플릿은 목록에 없다.

### 코드

`DropdownMenu`(`DropdownMenuTrigger`, `DropdownMenuPortal`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent`, `DropdownMenuScroll`, `DropdownMenuSearch`, `DropdownMenuGroup`과 함께), `Command`(검색할 수 있는 메뉴. `CommandInput`, `CommandList`, `CommandGroup`(mono 그룹 이름 모양의 이름 아래 행들), `CommandItem`, `CommandSeparator`, `CommandEmpty`, `CommandFooter`(목록 전체에 속하는 것을 두는 목록 아래 행. "+ New tag" 같은 것으로, 선으로 구분되고 늘 보인다)와 함께 쓴다. 내용은 `padding="menu"`인 `PopoverContent`다. `CommandItem`에는 하나 고르기 목록의 지금 값을 위한 `checked`와 `variant="danger"`가 있다). `CommandList`의 화면 읽기 이름은 `aria-label`이다(바탕 부품이 자기 이름 "Suggestions"로 덮어쓰지 않게 부품이 넘긴다), `MenuShortcut`, `MenuTick`, `MenuValue`. `CommandInput`과 `DropdownMenuSearch`의 검색 줄은 같은 모양(`MENU_SEARCH_ROW`: 돋보기, 글자, 아래 선, 첫 행과 4px)이다. 맞는 것이 없을 때의 한 줄(`CommandEmpty`, `ComboboxEmpty`, 모델 메뉴)도 한 모양(`MENU_EMPTY`: 가운데, 흐린 글자, 위아래 12px)이다. 행은 앞에 아이콘, 이름, 끝에 `MenuShortcut`을 둔다. `MenuShortcut typed`는 글에 쳐서 같은 것을 얻는 마크다운 단축("###", "[]", ">")이다. 고정폭이면 "###"이 뭉개지므로 행과 같은 sans 글자로, 흐리게 쓴다(2026-11-06, 소유자: 노션처럼 아이콘과 단축을 함께). `variant="danger"`는 되돌릴 수 없는 것에 쓰고 맨 아래에 둔다. 코드에서는 쓸 수 없는 행이 흐리게 보이고 그 `MenuShortcut`에 이유를 적을 수 있는데, 이것은 DS 규칙(할 수 없는 것은 숨긴다)에 없는 동작이다.

행 메뉴는 `ContextMenu`를 쓴다(아래 참고). 카드 모양은 함께 쓰는 `MENU_CARD`다. 코드는 둘째 단계를 부모 카드에서 4px 떨어뜨려 연다(`SUB_SIDE_OFFSET`, `SUB_ALIGN_OFFSET`).

## 행 메뉴 (오른쪽 클릭)

목록 행이나 타일을 오른쪽 클릭하면 커서 자리에 열린다(`.mt-menu--ctx`, 232px). 같은 항목이 행 끝의 ⋯에도 있다.

- 행마다 왼쪽에 16px 아이콘(`.ico`)이, 오른쪽에 단축키(`.k`)나 ▸(`.sub`)가 있다. DS README는 아이콘이 "코드와 같은 lucide"라고 한다. 지금 코드는 Carbon 아이콘을 쓴다(토큰 페이지의 아이콘 크기 참고).
- 되돌릴 수 없거나 무언가를 내리는 것은 맨 끝에 빨갛게 둔다(`.is-danger`).
- 여러 행을 고른 상태에서 그중 하나를 오른쪽 클릭하면, 메뉴는 "2개 항목"으로 시작하고 일괄 바와 같은 것을 같은 이름으로 담는다. "발행" · "보관" · "폴더로" ▸ | "카테고리" ▸ · "태그" ▸ | "내보내기" | "휴지통으로" Del. 한 행에만 되는 것(열기, 복제)은 뺀다. "바꾸기" 단계는 없다(셋째 단계가 생기기 때문이다). 아이콘도 없다.
- 글: "열기" · "새 탭에서 열기" · "복제" | "폴더로" ▸ · "카테고리" ▸ · "태그" ▸ | "보관" · "휴지통으로" Del
- 미디어: "열기" · "쓰는 곳" ▸ · "폴더로" ▸. 휴지통 행은 없다. 휴지통은 패널의 ⋯와 일괄 바에 있고, 타일에서 Del 키를 누르면 곧바로 휴지통으로 간다.
- 휴지통: "복원" | "영구 삭제" Del

### 코드

`ContextMenu`(`ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuGroup`, `ContextMenuLabel`, `ContextMenuSeparator`, `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent`와 함께). 값을 하나 더 고르는 행은 `ContextMenuSubTrigger`다(→는 둘째 단계를 열고, ←는 닫는다). 오른쪽 클릭 메뉴와 드롭다운 메뉴는 여는 방법만 다르고 행은 같은 부품이다. 그래서 체크 상자 행과 검색 줄은 드롭다운의 `DropdownMenuCheckboxItem box`(`mixed`)와 `DropdownMenuSearch`를 그대로 넣는다.

## 고르기 목록 (`.mt-picklist`)

메뉴 카드 없이 화면이나 시트에 바로 놓는 메뉴 행 목록이다. 새 필드의 종류처럼, 하나를 골라 다음 단계로 가는 곳에 쓴다. 행은 `.mt-menu-item`과 같고(아이콘 16 · 이름 · 오른쪽에 회색 덧말), 카드 테두리와 그림자가 없다. 끝에 →를 달지 않는다. 고른 종류의 설정이 바로 옆에 나타나므로 화살표는 이미 보이는 것을 되풀이한다(원칙 8). 그룹 이름은 `.mt-menu-label`이다.

### 코드

`PickList`(listbox)와 그 선택지인 `PickListItem` 행(메뉴 행과 같은 `MENU_ROW` 모양, 32px. `mark`는 이름에 실제로 붙는 덧말에만 쓴다: "Ollama", 플러그인 이름. 화살표는 넣지 않는다). `PickListItem`의 `disabled`는 지금 정말 고를 수 없는 행에만 쓰고, 까닭은 그 행에서 읽혀야 한다(원칙 7). 그럴 수 없으면 행을 숨긴다. 고른 행은 선택 바탕과 잉크를 쓰고, 나머지는 흐리다. `aria-label`로 이름을 붙인다. 묶음이 있으면 `PickListLabel`(메뉴의 묶음 이름과 같은 mono 11)과 묶음 사이의 `PickListSeparator`를 쓴다. 창 안의 행이 메뉴보다 크므로 구분선 위아래 간격은 메뉴(5px)보다 넓은 10px이다. "키 추가"의 서비스 고르기("AI", "플러그인")가 이렇다.
