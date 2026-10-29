# 사이드바

이 페이지는 왼쪽 내비게이션을 다룬다. 행, 머리, 레일로 접기, 화면 모드 전환이다.

## 사이드바

크림색 도구 바탕 위의 왼쪽 내비게이션이다. 위쪽 묶음은 콘텐츠이고, 아래쪽 묶음은 휴지통, 도구, 설정이다.

- 포인터 아래의 행(`.mt-nav:hover`, 그림에서는 `.is-hover`)은 `bg-selected`다. 바탕이 크림색이므로, 종이 목록의 행 호버(`bg-muted`)보다 한 단계 어둡다.
- 현재 위치(`.mt-nav.is-on`)는 한 단계 더 어두운 `bg-current`이고 굵기 600이다. 그래서 포인터 아래의 행과 헷갈리지 않는다. 폴더가 있는 컬렉션은 열려 있을 때 그 아래에 트리를 보인다. 폴더 안에서는 컬렉션 행이 현재 위치로 남고, 트리에서 열린 폴더가 굵어진다.
- 트리 행(`.mt-nav-sub a`)도 둥근 행이고, 호버하면 `bg-selected`다. 36px 들여쓰기는 행 안의 안쪽 여백이다. 그래서 배경은 위의 행과 같은 너비로 칠해지고 글자만 안으로 들어간다.
- 숫자는 mono이고 오른쪽 끝에 있다.
- 행은 높이 36px, 양옆 안쪽 여백 10px, `radius-md` 모양이다.

### 코드

`Sidebar`는 도구 바탕 위의 `nav`다. 오른쪽 가장자리를 따라 선이 있고, 사이트 이름이 든 머리, 묶음들의 행, 바닥이 있다. 쓰는 사람이 가장자리를 끌어 너비를 바꾼다(200px에서 400px, 끌기 전에는 232px, `width-sidebar`). 좁은 화면에서는 흐려진 페이지 위로 왼쪽에서 열리는 서랍이 된다. 시트처럼 모서리가 각지고 열린 쪽 가장자리에 선이 있다. `label`은 스크린 리더용 이름이다.

부품: `SidebarProvider`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarMenuSubButton`, `SidebarMenuBadge`, `SidebarFooter`, `SidebarFoot`, `SidebarInset`, `SidebarTrigger`, `SidebarRailToggle`, `SidebarScreenMode`, 그리고 `useSidebar`. 레일은 도구 바탕이고, 위 20px, 양옆 14px(접으면 6px라서 36px 행이 48px 레일을 채운다), 아래 16px이며, 행 사이는 2px다.

## 머리 행

사이트 이름(`text-title`)과 접기 버튼(`.mt-sidebar-head`)이다. 긴 이름은 말줄임표로 자른다. 사이트로 가는 링크는 없다.

## 접기

접기 버튼이나 ⌘B를 누르면 아이콘만 있는 좁은 사이드바가 된다(`.mt-sidebar.is-rail`, `--width-rail`, 48px). 양옆 안쪽 여백이 6px라서 36px 행이 꽉 찬다. 아이콘은 펼쳤을 때와 같은 자리에 있어 움직이지 않는다. 접힌 상태는 이 브라우저에 기억된다.

- 이름과 숫자는 숨는다. 호버하면 툴팁이 이름과 숫자를 보인다("도구 1").
- 도구에 실패가 있으면 아이콘 오른쪽 위에 점(`.mt-change-dot`)이 붙는다. 휴지통 숫자는 점으로 바꾸지 않는다.
- 접힌 동안 폴더 트리는 보이지 않는다.
- 머리 행에는 펼치기 버튼만 남는다.
- 좁은 화면(태블릿 아래)에서는 접는 대신 서랍으로 열린다.

### 코드

`SidebarProvider`는 `rail`(아이콘 레일로 접힘. 데스크톱 전용이고 서랍일 때는 절대 아니다)과 상태를 바깥에서 들고 있기 위한 `onRailChange`를 받는다. 관리자 화면은 이 상태를 브라우저에 기억한다. `resizeKey`는 기억할 너비의 이름이고, `fixed`는 틀이 창 크기를 정확히 차지하게 하며 안쪽 창들은 각자 스크롤된다.

## 화면 모드

맨 아래 행(`.mt-sidebar-foot`)은 아이콘 세 개짜리 토글이다(`.mt-seg`: 시스템, 밝게, 어둡게. 화면, 해, 달로 그린다). 사이드바 너비를 채우고 세 칸이 똑같이 나눈다. 현재 모드의 칸은 눌린 상태(`bg-current`)이고, 다른 칸은 호버하면 `bg-selected`다. 한 번 누르면 바뀐다. 처음에는 시스템을 따른다.

접힌 사이드바에는 세 칸을 둘 자리가 없으므로, 아이콘 버튼 하나가 현재 모드를 보인다. 누르면 작은 메뉴가 위로 열리고 현재 모드에 ✓가 있다.

### 코드

`SidebarScreenMode`는 `value`, `onValueChange`, `labels`를 받는다. `Segmented`의 도구 바탕 변형을 쓴다. 이 변형에서는 선택 바탕이 호버이고 눌린 칸이 현재 바탕을 쓴다.
