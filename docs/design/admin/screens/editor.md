# 글 편집기 (EditorNotion)

- 보드: `EditorNotion.dc.html`. 상태와 흐름 단계: [screens.md › EditorNotion](../screens.md#editornotion).
- 공통 틀: [common.md](common.md)의 ✦ 어시스턴트 열기, 토스트, 알림 띠, 메뉴. 편집기는 `PageHeader`를 쓰지 않는다. 머리가 편집기 자신의 줄이다. 틀은 사이드바 밖의 따로 된 페이지(`StandalonePage`)이고, 알림 띠는 그 `banner` 자리(머리 줄보다 위)에 선다.

## 기본 틀

### 머리 줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "‹ 게시글" | `TextButton variant="quiet"`(`href`, 앞 아이콘) | 목록으로 돌아간다. |
| 주소 `/posts/…` | `Text variant="meta" tone="faint"` | 읽기만 한다. 고치는 곳은 속성 패널의 "주소"다. |
| 발행 상태 | `EntryStatus`(`published`·`editing`·`draft`) | 상태 말과 점. |
| "저장" | `TextButton` | 글을 읽어 온 뒤에 있다: 저장 · 미리보기 · 발행 알약과 그 뒤 구분선, ⋯는 글을 읽기 전에는 없다(발행했는지, 보관했는지, 휴지통에 있는지 아직 모른다. T153). 누르면 저장한다. 라벨은 "저장"이고, 단축키는 툴팁에만 있다(보드의 "⌘S"는 [button.md](../components/button.md)를 따라 뺀다). |
| "미리보기" | `Button variant="secondary"` | 공개 화면을 연다. 볼 것이 없으면(제목도 본문도 빈 새 글) 알약이 없다. 흐리게 두지 않는다(원칙 7, 2026-11-05 소유자). |
| "발행하기 ▾" | `SplitButton`(`menu`에 `DropdownMenuItem` 둘: "발행하기" · "오늘 날짜로 다시 발행", 각각 아래에 발행일) | 한 번 발행한 글에만 ▾가 있다. 초안은 `Button variant="primary"` "발행하기". 바뀐 것이 없으면 "발행됨"으로 비활성. 발행하는 동안 `loading`. 발행일은 이 메뉴로만 정한다. |
| 속성 | `IconButton pressed` | 속성 패널을 열고 닫는다. 열린 동안 눌린 바탕. |
| ⋯ | `IconButton` + `DropdownMenu` | 행: "AI가 바꾼 기록" · "복제" · "보관"(파일이 올라가는 동안에는 보관하지 않고 토스트 "파일을 올리는 중입니다"를 띄운다. 그 밖에는 아무것도 하지 않는다. 다 올라간 뒤 다시 누른다. 소유자, 2026-11-12: "파일을 올리는 중입니다라고만 하면 되지") · "내보내기" │ 문서 도구(플러그인 행 `DropdownMenuCheckboxItem` "MDX로 보기", "본문 폭" `DropdownMenuSub` + `DropdownMenuRadioGroup` "보통" · "꽉 차게", 지금 값은 `MenuValue`) │ "휴지통으로"(`variant="danger"`). 플러그인이 없으면 그 행도 없다. |
| 머리 끝 구분선 | `Separator orientation="vertical" length="control"` | 발행 알약 뒤, 화면 도구(속성 · ⋯ · ✦) 앞. 주 동작 알약은 혼자 서고, 화면 도구는 선 너머 오른쪽 끝에 한 묶음으로 선다. ⋯의 행은 발행의 변형이 아니므로 `발행하기 ▾` 안에 넣지 않는다(2026-11-05, 소유자). |
| ✦ 어시스턴트 열기 | [common.md](common.md)의 ✦ 어시스턴트 열기(화면 코드 `AssistantButton`) | 머리 줄 끝. 누르면 어시스턴트 패널이 편집기 옆에 열리고 버튼은 사라진다. 닫으면 돌아와 포커스를 받는다. 어시스턴트가 없는 사이트에는 없다([assistant.md](assistant.md) 편집기 안에서). |
| 휴지통 글의 머리 | `Button variant="primary"` "복원", ⋯ `DropdownMenu`에 "영구 삭제"(`variant="danger"`) 하나 | 저장 · 미리보기 · 발행 대신 "복원"이 그 자리에 온다(보관 글의 "보관 풀기"와 같은 자리). 영구 삭제는 ⋯ 안에 있고 `AlertDialog`로 묻는다(2026-11-11 소유자). 돌아가기는 "휴지통"이고 휴지통 화면으로 간다. 복원하면 그 자리에서 초안으로 열린다. |

### 글 단

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 언어 탭 | `TabLinks` + `TabLink`(언어마다, 상태 점은 `EntryStatus` 표시만, 원문이 바뀐 언어는 `ChangeDot`) | 언어 하나가 글 하나다(주소가 바뀐다). |
| "+ 언어" | 탭 줄 끝의 `TabLink`(기준 화면대로 탭과 같은 모양) + `DropdownMenu`(`DropdownMenuLabel` "번역 추가", 언어 행 끝에 코드 `MenuShortcut`, 구분선, "언어 관리") | 고르면 그 언어의 새 번역을 만든다. 더할 언어가 없으면 메뉴에 "언어 추가 · 설정" 한 행. "언어 관리"와 "언어 추가 · 설정"은 설정 › 언어 탭으로 간다. |
| 제목 | 편집기 제목 칸(`Input appearance="inline" size="display"`와 같은 모양) | 늘 입력 칸이다. 포커스는 캐럿만 보인다. 글을 읽어 오기 전에는 본문처럼 제목 칸과 그 아래 선이 없다. 빈 제목 칸은 제목 없는 글로 읽히고, 거기 친 글자가 저장된 제목을 덮었다(T153). 그동안 누른 키는 받을 칸이 없어 버려진다. |
| 본문 블록 | `Block`(메뉴가 열린 블록은 `active`) | 글자 모양은 편집기의 것. |
| 블록 손잡이 | `BlockHandle`(`trigger`로 `DropdownMenuTrigger`를 감싼다, 메뉴가 열린 동안 `active`) | 그립 하나다(+는 없다, 2026-11-06 소유자). 누르면 블록 메뉴, 끌면 옮긴다. 블록 줄과 그 왼쪽 여백에 포인터가 있으면 뜬다. |
| 블록 메뉴 | `DropdownMenu`: `DropdownMenuLabel`(블록 종류) · `DropdownMenuSub` "다른 블록으로 바꾸기"(`DropdownMenuRadioGroup`, 행 앞에 블록 아이콘: 제목은 `HeadingIcon`. 행 끝에 마크다운 단축 `MenuShortcut typed`) · `DropdownMenuSub` "정렬"(왼쪽 · 가운데 · 오른쪽) │ "위로" · "아래로" · "복제" · "삭제"(각각 `MenuShortcut keys`) | 할 수 없는 행(첫 블록의 "위로")은 숨긴다. |
| 서식 카드 | `FloatingBar`: `FormatButton`(B, I, U, S, 코드, 서식이 있을 때 `clear` / 위 첨자, 아래 첨자, 링크, 각주, `more`의 ⋯) · `Separator orientation="vertical" length="bar"` · `FormatBarRequest`("✦ 요청") | 글자를 고르면 그 위에 뜬다. 켜진 서식은 `pressed`. 서식 지우기(⌘\)는 고른 범위 안의 서식을 링크만 남기고 모두 뺀다(editor-tools.md). |
| "/" 메뉴 | `Command`(`CommandInput`, `CommandList`, `CommandGroup` "글" · "넣기" · "컴포넌트" · "템플릿", `CommandItem`(행 앞에 블록 아이콘, 제목은 `HeadingIcon`, 행 끝에 마크다운 단축 `MenuShortcut typed`), `CommandSeparator`) | 한 단계뿐이다. 포커스는 본문에 남고 화살표 · Enter · Esc로 움직인다. "템플릿"을 치면 템플릿만 남는다. |
| 올리는 중에 묻기 | `AlertDialog`(`AlertDialogCancel variant="danger"` "그만 올리기", `AlertDialogAction` "계속 올리기") | 파일이 올라가는 동안 비교 화면이나 나란히 보기로 가면 묻는다. 그러면 본문이 새로 그려져 올라가던 파일이 끝나기 때문이다. 글은 그대로이고 파일만 멈춘다. |
| 올리는 중인 이미지 | `UploadingImage` | 붙여 넣거나 끌어 넣은 그림은 창 없이 커서 자리에 들어가고 아래에 막대가 흐른다. 캡션 칸은 그때부터 있다. 빈 줄이면 그 줄을 대신하고, 글이 있는 줄이면 그 줄 바로 뒤에 간다. 목록 항목은 글자만 담으므로(03번 문서) 그 항목 바로 뒤에서 목록이 나뉘고, 번호 목록은 번호가 이어진다. 넣은 뒤 커서는 그림 다음 글로 간다. 글이 없으면 새 줄을 만든다. 그래서 바로 이어 써도 그림이 지워지지 않는다. 여러 개를 함께 놓으면 순서대로 들어간다. 편집 대화상자에서 돌리면 잡아 둔 자를 곳도 그림과 함께 돈다. 시트가 닫히면 포커스는 본문으로 간다. 그래서 캡션을 쓰다가 열었어도 ⌘Z가 방금 한 일을 되돌린다. |
| 올리지 못한 파일 | `FileBlock tone="danger"`(세부에 "올리기 실패", 고르면 `selected`, `action`에 `IconButton` `Renew` "다시 올리기") | 제자리에 남는다. 이미지도 파일도 같고, 실패한 동안 캡션 칸은 없다(2026-11-09). 다른 블록처럼 눌러 고른 뒤 Backspace나 핸들 메뉴로 지운다(2026-11-09 소유자). 올라가다 끊긴 파일만 남는다(네트워크가 끊겼거나 서버가 받지 못한 파일). 읽기 전용 편집기(그 사이 보관한 글)에서는 블록이 "올리기 실패"로 남고 "다시 올리기" 버튼은 없다. 받지 않는 파일은 블록이 되지 않고 토스트로 막히며, 깨진 그림은 알게 된 때 블록이 사라지고 같은 토스트가 뜬다(2026-11-09 소유자). 파일이 끝나며 블록이 바뀌거나 사라지는 것은 실행 취소에 남지 않는다. 속성 패널에서는 `FormFieldError`에 "올리기 실패", `MediaInput`의 `action`에 같은 버튼이다. 받지 않는 파일이면 칸은 그대로고 토스트만 뜬다. 격자와 같은 버튼이고 줄을 따로 쓰지 않는다(2026-11-09). 빼는 것은 칸의 ×가 한다. ×는 그 파일만 빼고, 칸은 전의 그림과 대체 텍스트로 돌아간다(2026-11-09 소유자). |
| 이미지 도구 행 | `BlockBarPlace` 안 `FloatingBar`: `FloatingBarButton`(왼쪽 · 가운데 · 오른쪽 정렬 `pressed` / 편집 / 설정) · `Separator orientation="vertical" length="bar"`, 모서리 `ResizeCorner`(`corner`, 가운데 그림은 넷, 한쪽에 붙은 그림은 움직이는 쪽 둘), `BlockBox selected`의 2px 진한 선 | 설정은 카드(`Popover`)를 연다. 읽기 전용 본문에서는 `BlockBox`가 Tab 자리이고(`tabIndex`, `role="group"`, 이름은 어느 이미지인지 말한다: "이미지: 대체 텍스트", 대체 텍스트가 없으면 "이미지: 파일 이름") 포커스를 가진 것은 보통 포커스 고리를 그리며, Enter · Space나 포인터가 그것을 골라 진한 선과 "설정" 하나뿐인 도구 행(이름 "이미지 도구", 파일은 "파일 도구")을 띄우고 Escape가 닫으며 푼다(본문 어디에 키보드가 있든 고른 것을 푼다. 2026-11-12, T133. [editor-tools.md](../components/editor-tools.md)). 편집(자르기 · 돌리기 · 비율 · 크기)은 대화상자(`Dialog` + `CropStage`, 돌리기는 `IconButton size="sm"`, 비율과 단위는 `Segmented size="sm"`, 가로 · 세로는 `Input size="sm" width="number" mono`, "크기"와 "×"는 `Text variant="note" tone="subtle"`)로 연다. 삭제는 블록 메뉴에 있다. |
| 이미지 설정 카드 | `Popover` 안에 그림의 속성만(2026-11-10 소유자: 모양은 "편집"이다): "대체 텍스트" `Input`(라벨 줄 `FormFieldLabel action`에 `TextButton tone="proposal" size="micro"` "✦ 채우기", 비었으면 `FormFieldError`), "장식 이미지" `Option` + `Switch` | 장식 이미지를 켜면 대체 텍스트 칸이 사라지고 커서는 스위치에 남는다. 안내 문구는 없다. 대체 텍스트를 쓰는 동안 라벨 줄에 글자 수("23 / 80"). 다른 빈 이미지가 있으면 끝에 "다음 이미지 ↵"(`TextButton`). |
| 캡션 | `Input appearance="inline" size="sm" align="center"`, 같은 줄 끝에 `TextButton tone="proposal" size="micro"` | 이미지 아래 그 자리에서 고친다. AI 버튼은 다른 필드와 같은 "✦ 채우기"다(보드의 ✦만 있는 버튼 대신). |
| 파일 블록 | `FileBlock`. 누르면 통째로 선택되고 `BlockBarPlace` 안 `FloatingBar`의 설정 `Popover`에서 보이는 이름을 쓴다(2026-11-09 소유자) | 고르는 창은 `MediaPicker`를 담은 `Dialog`([media.md](media.md)). |

### 속성 패널

글의 속성이다. **값 자리는 처음부터 기본 입력칸이다**(옅은 밑줄이 늘 보이고, 포커스하면 잉크 밑줄). 누르면 그 입력칸 안에 캐럿이 들어가거나 그 목록이 열리고, 다른 것으로 바뀌지 않는다. 보드는 쉴 때 밑줄 없는 글자로 그렸지만, 기본 입력칸을 따른다(2026-11-03 소유자 결정).

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `PropertyPanel`(300px `SidePanel`, 제목과 ×가 없다) | 머리의 속성 버튼으로 열고 닫는다. 글을 읽어 오기 전과 읽지 못했을 때는 속성 버튼도 패널도 없다(2026-11-12: 눌린 모양으로 서서 아무것도 열지 않았다. 읽기 전에 누를 것이 없다는 말은 하나도 없다는 말이다). 패널은 열려 있어도 그리지 않는다: 값이 없는 칸은 빈 칸으로 읽히고, 그때 고른 파일이 읽어 온 값을 덮는다(T153). |
| 탭 줄 "기본 · SEO" | `PropertyPanel`의 `tabs`(속은 `TabsList variant="bar"`, 탭마다 `dot`) | 다른 탭에 제안이 있으면 그 탭에 `dot` "proposal"(파란 점), 고칠 곳이 있으면 `dot` "warning"(주황 점). |
| 속성 한 행 | `FormField` + `FormFieldLabel`(`htmlFor`, 라벨 줄 끝 `action`) + 입력 부품 + `FormFieldError` | 라벨은 mono 11, 값은 13. 라벨 줄 끝의 어시스턴트 버튼은 포인터나 키보드가 행 안에 있을 때만 보인다. |
| 조건부 필드(문서 19) | 고르는 칸은 고르기 필드와 같은 `Select`. 그 아래에 고른 선택지의 필드가 속성 행으로 바로 이어진다. 고르는 칸 밑 한 줄은 `Text variant="caption" tone="warning"` | 고른 선택지의 필드만 보인다. 선택을 바꾸면 다른 선택지에 남은 값이 저장할 때 지워지므로, 저장 전까지 고르는 칸 바로 밑에 "저장하면 동영상의 값 2개가 지워집니다"가 선다. 되돌려 고르면 값이 그대로 다시 보이고 줄은 사라진다. 저장하면 줄도 값도 없다. 만들며 정함 (2026-11-13). 레퍼런스: Keystatic은 고른 선택지의 필드만 보이고 알리지 않는다. 선택지의 필드가 조건부 필드면 그 고르는 칸 아래에 제 선택지의 필드가 같은 방식으로 이어진다. 스위치로 켜고 끄는 조건부 필드(`control: "toggle"`)는 고르는 칸 대신 `Option spread height="md"`(라벨, 끝에 `Switch`) 한 줄이다: 켜면 그 아래에 필드가 이어지고, 끄면 사라지며 밑 한 줄이 "저장하면 첫 화면에 올리기의 값 1개가 지워집니다"처럼 필드 이름으로 말한다. 원문과 같은 값을 읽기만 하는 번역 글에서는 "켜짐" / "꺼짐" 글이다. 만들며 정함 (2026-11-13). |
| 선택지에 없는 값을 쥔 고르기(문서 19) | 같은 `Select`에 그 값이 항목으로 하나 더 있고, 밑 한 줄은 `Text variant="caption" tone="warning"` | 저장된 값을 그대로 보이고 "podcast: 선택지에 없는 값"이라고 적는다. 다른 선택지로 보이지 않는다. 선택지를 고르면 줄이 사라진다. 만들며 정함 (2026-11-13). |
| 묶음 이름 "분류" | `PropertyGroup` | 조용한 소제목. |
| 주소 | `Input mono`(슬러그만, 끝 `action`은 다시 만들기 `IconButton`). 앞뒤 고정 글자가 없어 `Affix`가 아니다 | 늘 입력 칸이다. "/posts/"는 붙이지 않는다. 전체 주소는 머리의 주소 줄에 있고, 패널 폭은 긴 슬러그에 쓴다. 고정 글자가 없으니 밑줄은 아이콘까지 행 전체다. |
| 대표 이미지 | `MediaInput size="md"`(고른 파일이면 썸네일과 파일 이름과 ×, 비었으면 "비어 있음") | 다른 필드와 같은 밑줄 한 줄이다(2026-11-05, 소유자). 누르면 `MediaPicker`를 담은 `Dialog`가 열린다. |
| 대표 이미지의 대체 텍스트 | `MediaInput`의 `action`에 `IconButton`(`Settings`, 이름 "대표 이미지 설정")과 `Popover`. 카드 안은 본문 이미지 설정 카드와 같은 `AltFields`: 글자 수를 세는 `FormFieldLabel`과 `Input size="md"`, `Option spread`의 `Switch` "장식 이미지" | 이미지를 고르면 줄 끝에 설정 버튼이 생긴다. 패널에 칸을 늘어놓지 않고, 본문 이미지처럼 설정 카드에서 쓴다(2026-11-09, 소유자). 카드는 줄 바로 밑에, 줄과 같은 폭으로 열린다(`PopoverContent anchor`에 줄, `width="anchor"`, `align="start"`, 2026-11-09 소유자). 카드가 열리면 칸에 커서가 있고, Enter로 닫는다. 할 일의 행을 누르면 이 카드가 열린다. 다른 파일을 고르면 비운다. 비었으면 `MediaInput` 아래에 `FormFieldError`를 둔다(카드를 닫은 채로도 보인다). 새 파일이 올라가지 못하고 멈춘 동안에는 줄이 그 파일을 보이므로 설정 버튼도 이 말도 없다. 올라가는 동안에는 있어서, 그동안 쓴 말이 남는다. 장식 이미지를 켜면 칸이 잠기고 묻지 않는다. 파일(이미지가 아닌 것)에는 없다. 읽기 전용 편집기(보관 글, 휴지통 글)에서는 값을 바꿀 수 없다: 줄은 버튼이 아니라 눌러도 창이 열리지 않고 ×가 없다. 설정 버튼은 남고, 카드는 칸이 읽기 전용인 채로 열려 그 글이 그림에 대해 적은 것을 읽을 수 있다(`MediaInput readOnly`, 2026-11-11 소유자: "아니 버튼을 없애랬다고 그걸 다 없애는게 말이 됨? … readonly로 만들면 되는거지"). 본문 이미지도 같다: 읽기 전용에서 고르면 막대에 설정 하나만 있고, 카드의 칸은 읽기 전용이다(정렬 · 편집 · 크기 조절은 없다). |
| 번역의 대표 이미지 (원문 따름) | 위와 같은 것들. 비어 있는 동안 `MediaInput`은 원문의 파일을 흐리게 보이고 ×가 없으며, 설정 카드의 대체 텍스트는 원문의 글이 플레이스홀더다. 라벨 오른쪽의 `Text variant="micro" tone="faint"`이 누구의 값인지 말한다. "✦ 채우기"(`TextButton size="micro"`)가 놓이는 자리라 같은 크기다(2026-11-09 소유자). 값이 없는 동안은 "원문 발행본 따름"(원문이 사이트에 없으면 필드 설정과 같은 말 "원문 따름"), 값이 있으면 "이 언어 값"이다. 파일이 올라가는 동안은 없다. ×의 이름은 "대표 이미지 원문으로 되돌리기"처럼 필드 이름으로 시작한다. 원문을 저장만 하고 발행하지 않은 값이 왜 안 보이는지가 여기서 설명된다(04번 문서 원칙 5) | 고르거나 쓰면 번역의 값이 되고 ×가 생긴다. ×로 지우면 다시 원문을 따른다(2026-11-09, 소유자). |
| 요약 | `Textarea size="md"` | 늘 입력 칸이다. 비었으면 플레이스홀더 "비어 있음"(`fg-faint`). 포커스하면 라벨 줄 끝의 글자 수 "28 / 120". 라벨 줄 끝 `action`은 `TextButton tone="proposal" size="micro"`("✦ 채우기", 값이 있으면 "↻ 다시"). 본문에서 채우는 일은 이 "✦ 채우기"가 한다. 입력 줄 끝의 "본문에서 가져오기" 버튼은 없앴다(2026-11-05 소유자). |
| 한 줄 글 필드 | `Input size="md"` | 요약과 같다. Enter로 끝내고, 포커스를 떠나면 그대로 남는다. |
| 카테고리 (관계 하나) | `Combobox` + `ComboboxInput` | 늘 입력 칸이다. 치면 거르고, 목록에서 고른다. 없음이 허락되면 지우기 버튼. |
| 태그 (관계 여럿) | `Combobox` + `ComboboxChips`(`ComboboxChip`, `ComboboxChipsInput`) | 고른 값은 칩, 끝의 입력 칸에서 더한다. |
| 시리즈 (관계 하나) | 카테고리와 같다. 비었으면 플레이스홀더 "없음" | 다른 필드처럼 라벨 줄 끝에 "✦ 채우기"(`TextButton tone="proposal" size="micro"`)가 그 필드를 가리킬 때만 보인다. 고른 값은 `proposal`(파란 글자)로 남고 버튼은 "↻ 다시"가 된다. 보드의 값 옆 "✦ 추천"은 이 버튼으로 바뀐다(2026-11-03 소유자 결정). |
| 고르기 필드 (`select`) | `Select` + `SelectTrigger size="md" width="full"` | 늘 트리거가 있다. 누르면 목록. |
| 켜기/끄기 필드 ("검색에서 숨기기") | `Switch` | 바로 바뀐다. |
| 다른 값을 따르는 값 (SEO 제목 · 설명) | 그 종류의 입력 부품(`Input size="md"`, `Textarea size="md"`)에 플레이스홀더로 따르는 값("제목과 같음 · 10/60") | 비어 있는 동안 따르는 값을 플레이스홀더로 읽힌다. 치면 그 값이 되고, 라벨 줄 끝에 글자 수 `Text variant="micro"`("9/60", 권장 길이를 넘으면 `tone="warning"`)가 선다. SEO 플러그인의 입력이다(기능 설계 14). 공유 이미지는 다른 미디어 필드와 같은 `MediaInput`이고 따르는 그림은 미리보기가 보인다(만들며 정함 2026-11-13). |
| 플러그인의 탭 ("SEO") | `PropertyPanel`의 `tabs` 끝에 플러그인마다 하나. 안은 `PropertyGroup` 하나에 플러그인의 필드가 플러그인의 순서로 | 컬렉션의 탭 뒤에 선다. 필드는 다른 속성 행과 같은 `FormField`이고, 값 자리는 플러그인의 브라우저 쪽이 준 입력(`@monti-cms/ui` 부품)이거나 종류의 기본 입력이다. 번역 글에서 원문의 것인 필드는 다른 필드처럼 원문 값을 글로 보인다. |
| 플러그인의 화면 필드 (SEO 미리보기) | `FormField`(이름이 있으면 `FormFieldLabel`) 안에 플러그인의 화면. SEO의 것은 `Stack` 둘이고 테두리가 없다(테두리는 떠 있는 것에만 쓴다, 원칙 3. 사이는 16px이고 저마다 위에 `Text variant="micro" tone="faint"` 이름 "검색 결과" · "공유 카드"): 검색 결과(`Text variant="micro"` 사이트 이름 › 주소, 제목 `weight="semibold" lines={2}`, 설명 `variant="note" lines={2}`, 숨겼으면 `Text variant="micro" tone="warning"` "검색에서 숨김")와 공유 카드(`Image ratio="share"`, 사이트 이름, 제목, 설명) | 값이 없는 필드다. 편집기가 든 값으로 그리므로 칠 때마다 따라 바뀐다. 누를 것이 없다. 플러그인의 브라우저 쪽이 없으면 그려지지 않는다. |
| 어시스턴트가 쓴 값, 받기를 기다리는 제안 | 각 입력 부품의 `proposal`(파란 글자, 파란 밑줄) | 제안은 입력칸 안에 들어 있고 바로 고칠 수 있다. 고치거나 받으면 보통 색, 버리면 옛 값으로 돌아간다. |
| 사람이 바꿀 수 없는 값 (번역에서 원문과 함께 쓰는 필드) | `FormField` + `FormFieldLabel` + `Text variant="note"`, 아래 `FormFieldDescription` 한 줄 | 입력 부품이 없다. |

### 상태 표시줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 줄 | `StatusBar` | 담을 칸이 없으면 그리지 않는다. |
| 저장 상태 | `StatusBarCell`(편집 충돌이면 `tone`). 알리기만 할 때는 `render={<span />}` | "저장 전 변경사항" · "저장됨" · "브라우저에만 임시 저장됨" · "편집 충돌" · "로그인 풀림". 누를 일이 있으면 칸이 버튼이다(저장 전 변경사항은 누르면 저장, 로그인이 풀렸으면 로그인 화면). 소리 알림은 `StatusBarAnnouncer`. |
| "할 일 N" | `StatusBarCell` + `StatusBarList`(`TodoItem`, 할 일이 없을 때만 `TodoDone`) | 누르면 위로 목록이 열린다. 행을 누르면 그 자리로 간다. 행 끝에 동작은 두지 않는다: 여러 곳을 한꺼번에 채우는 버튼은 무엇이 어디서 바뀌는지 보여 줄 수 없어서, 채우기는 그 자리의 ✦(필드 라벨 줄의 "✦ 채우기", 이미지의 대체 텍스트 칸) 하나로만 한다. 발행을 막는 행은 `blocking`. 행의 덧말(`detail`)은 그 자리만 말한다("속성 · 비어 있음", "대표 이미지 · 본문 1"). 제목이 이미 말한 필드 이름("요약 쓰기"의 "요약")은 되풀이하지 않는다(원칙 8). 끝난 것은 행이 사라질 뿐 따로 적지 않는다. 남은 것이 없으면 `TodoDone` "할 일 없음" 한 줄만(2026-11-10 소유자). |
| 플러그인 칸 ("맞춤법 2") | `StatusBarPluginCell` | 플러그인의 본문 검사(`textCheck`)마다 칸 하나, 찾은 것이 있을 때만. 행은 "틀린 말 → 바꿀 말"과 그 아래 "본문", 끝에 "고치기". 행을 누르면 본문의 그 말이 골라진다. 아래에 "모두 고치기". "설정"은 없다(플러그인의 설정은 코드다). 고치면 본문에 바로 들어가고 행이 사라진다. 그 글의 언어를 읽지 않는 검사는 칸이 없고, 읽기 전용 글에도 없다(만들며 정함 2026-11-13). |
| 글자 수 | `StatusBarSpacer` 뒤 `StatusBarCell end` | 좁은 화면에서 먼저 숨는다. |

### 늘 있는 자리의 값

흐름마다 값만 바뀐다.

| 값 | 바뀌는 것 | 스토리 |
|---|---|---|
| `pub` | 머리의 `EntryStatus`와 발행 알약(초안 `Button`, 발행된 글 `SplitButton`) | Controls/Status/EntryStatus, Controls/Button/Button, Controls/Button/SplitButton |
| `save` | 저장 칸의 글, "편집 충돌"이면 충돌 `Banner` | Patterns/Frame/Banner |

스토리: Controls/Button/TextButton, Primitives/Text, Controls/Status/EntryStatus, Controls/Button/Button, Controls/Button/SplitButton, Controls/Menu/DropdownMenu, Controls/Button/IconButton, Primitives/Separator, Controls/Overlay/AlertDialog, Controls/Tabs/Tabs, Controls/Status/ChangeDot, Controls/Field/Input, Monti/EditorTools/BlockHandle, Monti/EditorTools/FloatingBar, Monti/EditorTools/FormatBar, Controls/Menu/Command, Patterns/Frame/UploadingImage, Monti/EditorTools/BlockBar, Controls/Overlay/Popover, Controls/Overlay/Sheet, Patterns/Sheet/CropStage, Controls/Field/Field, Controls/Field/Select, Controls/Field/Textarea, Controls/Choice/Option, Controls/Choice/Switch, Patterns/Frame/FileBlock, Patterns/Sheet/MediaPicker, Controls/Overlay/Dialog, Monti/Proposal/PropertyPanel, Controls/Overlay/SidePanel, Primitives/AI mark, Controls/Field/Affix, Patterns/Frame/Image, Controls/Field/Combobox, Patterns/Frame/StatusBar, Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem, Patterns/Frame/Banner.

## 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

### 알림 띠 (화면 맨 위, 머리 줄보다 위, 가장자리에서 가장자리까지)

화면의 띠는 모두 이 한 자리에 쌓인다. 넓은 일이 위다([common.md](common.md)의 "화면의 알림 띠").

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 로그인 풀림 | `Banner tone="danger"`(`title` "로그인이 풀렸습니다", `meta` "저장하지 않은 입력은 이 브라우저에 남아 있습니다" `plainMeta`) | 맨 위. 화면을 바로 빼앗지 않아 쓰던 문장을 마저 쓸 수 있다. 끝에 `TextButton variant="underline"` "다시 로그인"은 평소 로그인 화면으로 간다(GitHub도 평소처럼 다녀온다). 로그인하면 주소가 같은 글을 다시 열고, 쓰던 입력은 묻지 않고 다시 들어간다(그 사이 다른 곳에서 저장하지 않았을 때. 저장했으면 임시 저장본 띠가 묻는다). 저장 칸도 "로그인이 풀렸습니다"이고 누르면 같은 곳으로 간다. 모든 화면에서 같다(15). 2026-11-06 소유자: 로그인 창은 두지 않는다. |
| 편집 충돌 | `Banner tone="danger"`(`title` "다른 곳에서 10:41에 먼저 저장했습니다", `meta` "이 글은 저장할 수 없습니다" `plainMeta`) | 끝에 `TextButton variant="underline"` "비교하기"(비교 화면으로), `TextButton` "서버 최신본 불러오기". 답하기 전에는 사라지지 않는다. |
| 임시 저장본 | `Banner`(`title` "이 브라우저에 저장하지 않은 편집이 있습니다", `meta` 시각) | 끝에 "비교하기"(underline) · "불러오기" · "버리기"(`variant="quiet"`). "불러오기"는 한 번에 들어간다: 임시 저장본의 본문이 쓰는 파일은 띠가 뜰 때 미리 읽어 두므로 누른 뒤에 기다리는 상태가 없다(T135). "불러오기"나 "버리기"를 키보드로 눌러 띠가 사라지면 포커스는 본문으로 간다(본문이 아직 없으면 제목으로). 포인터로 누른 것은 옮기지 않는다([tokens.md](../tokens.md) 상태의 규칙, `useFocusHandOff`). 비교 화면에서 키보드로 답하면(버리기, 불러오기, 서버 최신본 불러오기) 편집기로 돌아와 본문이 포커스를 받는다. "서버 최신본 불러오기"도 같다. |
| 휴지통에 있는 글 | `Banner tone="neutral"`(`title` "휴지통에 있는 글입니다", 남은 날) | 읽기 전용 화면의 상태. |
| 글을 읽지 못함 | `Banner tone="danger"`(`title` "글을 불러오지 못했습니다", `plainMeta`), 끝에 `TextButton` "다시 시도". 이미 읽은 글에서 "서버 최신본 불러오기"가 읽지 못하면 같은 말의 토스트(내 입력과 충돌 띠는 그대로 남는다), 저장은 됐는데 다시 읽지 못하면 토스트 "저장했지만 글을 다시 읽지 못했습니다"(내 입력은 화면에 남고, 다음 저장은 내 저장이 만든 버전 위에 보내므로 충돌이 아니다) | 글을 읽지 못했을 때만(거절, 답이 없는 연결). 글이 없으므로 제목 · 본문 · 속성 · 언어 탭과 "+ 언어" · 머리의 저장 · 미리보기 · 발행 · 속성 버튼 · ⋯와 상태 표시줄이 없고, 돌아가기와 ✦만 남는다(글을 읽어 오기 전도 같다). 비교 화면도 제 읽기가 오지 않으면 같은 띠를 맨 위에 보이고 "편집기로"가 남는다. "다시 시도"를 키보드로 눌렀으면 글이 온 뒤 포커스는 본문으로 간다(비교 화면에서는 비교 화면의 첫 컨트롤로). 포인터로 누른 것은 옮기지 않는다. "다시 시도"가 다시 읽는다. |

### 링크 칸 (서식 카드의 링크 버튼 아래)

기준 화면: `Screens/Reference/Editor` › LinkCardOpen · LinkCardSearch · LinkCardAddress · LinkCardLinked. 칸은 하나이고, 친 것이 링크를 정한다(노션과 같다, 2026-11-06 소유자).

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 칸 | `Popover`(링크 `FormatButton`이 트리거, `padding="menu"`, `width="md"`) 안 `Command`: `CommandInput`(플레이스홀더 "주소를 붙여 넣거나 글 찾기", 이름 "링크 주소") | `/` 메뉴와 같은 모양이다. 화살표와 Enter로 행을 고른다. |
| 막 열었을 때 | `CommandGroup` "최근에 고친 글": `CommandItem`(앞 `Document` 아이콘, 글 제목, 끝 `MenuValue` 컬렉션 이름) | 문서 컬렉션마다 가장 최근에 고친 글을 모아 다섯 줄. |
| 글자를 쳤을 때 | `CommandGroup` "글": 제목에 그 글자가 있는 글. 발행 안 된 글은 끝이 "게시글 · 초안". 없으면 `CommandEmpty` "맞는 글 없음" | 고르면 그 글 자체를 가리키는 링크(`monti:entry/<묶음 id>`)가 걸린다. 글의 주소가 바뀌어도 끊기지 않는다. |
| 주소를 쳤을 때 | `CommandGroup` "주소": `CommandItem`(앞 `Link` 아이콘, 주소, 끝 `MenuShortcut` "↵") | `https://` · `mailto:` · `/` · `#`로 시작하거나 `react.dev` 같은 도메인이면 주소다(도메인에는 `https://`를 붙인다). Enter로 바깥 링크를 건다. |
| 이미 링크가 걸린 글자 | 글 링크면 칸에 그 글 제목, `CommandGroup` "지금 링크"에 그 글(`checked`). 바깥 링크면 칸에 그 주소 | 아래에 `CommandSeparator`와 "링크 떼기"(`Unlink` 아이콘) 행. |

## 흐름 1 · 글 쓰고 발행하기

단계: 1.02, 1.03, 1.04, 1.05, 1.06, 1.07, 1.08, 1.09, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.18. 단계마다 보이는 것은 [flows/01-write-and-publish.md](../flows/01-write-and-publish.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `state` "글자 고름 + 블록 메뉴" | 1.03 | `FloatingBar`, `BlockHandle active`, 블록 메뉴 `DropdownMenu` | Monti/EditorTools/FloatingBar, Monti/EditorTools/BlockHandle, Controls/Menu/DropdownMenu |
| `state` "블록 바꾸기" · "블록 정렬" | 1.04, 1.05 | 블록 메뉴의 `DropdownMenuSub`가 열림 | Controls/Menu/DropdownMenu |
| `state` "/ 를 쳤을 때" · "템플릿 고르기" | 1.02 | "/" 메뉴 `Command`(템플릿은 "템플릿" 그룹만) | Controls/Menu/Command |
| `doc` "새 글" | 1.02 | 빈 제목과 "/ 를 눌러 블록 넣기" 줄 |  |
| `pubMenu` | 1.15 | `SplitButton`의 메뉴 | Controls/Button/SplitButton |
| `dialog` "편집 충돌" · "임시 저장본 복구" | 1.16, 1.18 | 해당 `Banner` | Patterns/Frame/Banner |
| `fix` "요약" | 1.11 | 요약 `Textarea`에 포커스, 라벨 줄 끝 "28 / 120" | Controls/Field/Textarea |
| `fix` "대체 텍스트" | 1.12 | 그 이미지 `Block active`와 대체 텍스트 `Popover`. "✦ 채우기"(`TextButton tone="proposal" size="micro"`)는 이미지 설정 카드처럼 라벨 줄 끝에 있다(보드의 필드 아래 자리 대신). | Monti/EditorTools/BlockHandle, Controls/Overlay/Popover, Controls/Button/TextButton |
| `todo` · `todoOpen` | 1.10, 1.13, 1.14, 1.15, 1.16, 1.18 | "할 일" `StatusBarList`(남음: `TodoItem`만, 다 채움: `TodoDone` "할 일 없음" 한 줄) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |
| `pluginOpen` | 1.06 | 플러그인 칸의 `StatusBarList` | Patterns/Frame/StatusBarList |
| `panel` · `panelTab` | 1.08 | `PropertyPanel`과 고른 탭 | Monti/Proposal/PropertyPanel |
| `seriesPending` | 1.07 | 시리즈 값이 `proposal`, 라벨 줄 끝 `TextButton tone="proposal" size="micro"`("↻ 다시") | Controls/Button/TextButton |
| `toast` "발행 막힘" · "발행됨" | 1.10, 1.14 | `toast.error` "발행할 수 없습니다 …" · `toast` "발행되었습니다"와 "보기" | Controls/Status/Toast |

## 흐름 2 · 어시스턴트

단계: 2.04, 2.07, 2.05. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

함께 열리는 화면: `AssistantPanel`([assistant.md](assistant.md)).

이 화면에서는 기본 틀만 쓴다.

## 흐름 3 · 번역

단계: 3.01, 3.08, 3.14. 단계마다 보이는 것은 [flows/03-translation.md](../flows/03-translation.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `langMenu` "열림" · "언어 하나뿐" | 3.01, 3.14 | "+ 언어" `DropdownMenu` | Controls/Menu/DropdownMenu |
| `todo` · `todoOpen` | 3.01, 3.08, 3.14 | "할 일" `StatusBarList`(남음: `TodoItem`만, 다 채움: `TodoDone` "할 일 없음" 한 줄) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |
| `toast` "발행 막힘" · "발행됨" | 3.08 | `toast.error` "발행할 수 없습니다 …" · `toast` "발행되었습니다"와 "보기" | Controls/Status/Toast |

## 흐름 5 · 휴지통

단계: 5.18. 단계마다 보이는 것은 [flows/05-trash.md](../flows/05-trash.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `trashed` | 5.18 | 휴지통 머리와 `Banner`(남은 날), 본문과 속성은 읽기 전용(입력 부품 `disabled`). 가리키는 항목이 휴지통에 있으면 관계 필드가 "임시 · 휴지통에 있음"으로 그 이름을 보인다 | Patterns/Frame/Banner, Screens/Trash › TrashedEntry |
| `todo` · `todoOpen` | 5.18 | "할 일" `StatusBarList`(남음: `TodoItem`만, 다 채움: `TodoDone` "할 일 없음" 한 줄) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |

## 흐름 6 · 미디어

단계: 6.05, 6.06, 6.38. 단계마다 보이는 것은 [flows/06-media.md](../flows/06-media.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `img` "올리는 중" · "설정" · "파일" | 6.05, 6.06, 6.38 | `UploadingImage` · `FloatingBar`와 설정 `Popover` · `FileBlock` | Patterns/Frame/UploadingImage, Monti/EditorTools/FloatingBar, Controls/Overlay/Popover, Patterns/Frame/FileBlock |
| `todo` · `todoOpen` | 6.05, 6.06, 6.38 | "할 일" `StatusBarList`(남음: `TodoItem`만, 다 채움: `TodoDone` "할 일 없음" 한 줄) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |
