# 글 편집기 (EditorNotion)

- 보드: `EditorNotion.dc.html`. 상태와 흐름 단계: [screens.md › EditorNotion](../screens.md#editornotion).
- 공통 틀: [common.md](common.md)의 ✦ 어시스턴트 열기, 토스트, 알림 띠, 메뉴. 편집기는 `PageHeader`를 쓰지 않는다. 머리가 편집기 자신의 줄이다.

## 기본 틀

### 머리 줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "‹ 게시글" | `TextButton variant="quiet"`(`href`, 앞 아이콘) | 목록으로 돌아간다. |
| 주소 `/posts/…` | `Text variant="meta" tone="faint"` | 읽기만 한다. 고치는 곳은 속성 패널의 "주소"다. |
| 발행 상태 | `EntryStatus`(`published`·`editing`·`draft`) | 상태 말과 점. |
| "저장" | `TextButton` | 누르면 저장한다. 라벨은 "저장"이고, 단축키는 툴팁에만 있다(보드의 "⌘S"는 [button.md](../components/button.md)를 따라 뺀다). |
| "미리보기" | `Button variant="secondary"` | 공개 화면을 연다. 볼 것이 없으면(제목도 본문도 빈 새 글) 알약이 없다. 흐리게 두지 않는다(원칙 7, 2026-11-05 소유자). |
| "발행하기 ▾" | `SplitButton`(`menu`에 `DropdownMenuItem` 둘: "발행하기" · "오늘 날짜로 다시 발행", 각각 아래에 발행일) | 한 번 발행한 글에만 ▾가 있다. 초안은 `Button variant="primary"` "발행하기". 바뀐 것이 없으면 "발행됨"으로 비활성. 발행하는 동안 `loading`. 발행일은 이 메뉴로만 정한다. |
| 속성 | `IconButton pressed` | 속성 패널을 열고 닫는다. 열린 동안 눌린 바탕. |
| ⋯ | `IconButton` + `DropdownMenu` | 행: "AI가 바꾼 기록" · "복제" · "보관" · "내보내기" │ 문서 도구(플러그인 행 `DropdownMenuCheckboxItem` "MDX로 보기", "본문 폭" `DropdownMenuSub` + `DropdownMenuRadioGroup` "보통" · "꽉 차게", 지금 값은 `MenuValue`) │ "휴지통으로"(`variant="danger"`). 플러그인이 없으면 그 행도 없다. |
| 머리 끝 구분선 | `Separator orientation="vertical" length="control"` | 발행 알약 뒤, 화면 도구(속성 · ⋯ · ✦) 앞. 주 동작 알약은 혼자 서고, 화면 도구는 선 너머 오른쪽 끝에 한 묶음으로 선다. ⋯의 행은 발행의 변형이 아니므로 `발행하기 ▾` 안에 넣지 않는다(2026-11-05, 소유자). |
| 휴지통 글의 머리 | `TextButton variant="danger"` "영구 삭제", `Button variant="primary"` "복원" | 저장 · 미리보기 · 발행 · ⋯ 대신 보인다. 영구 삭제는 `AlertDialog`로 묻는다. |

### 글 단

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 언어 탭 | `TabLinks` + `TabLink`(언어마다, 상태 점은 `EntryStatus` 표시만, 원문이 바뀐 언어는 `ChangeDot`) | 언어 하나가 글 하나다(주소가 바뀐다). |
| "+ 언어" | 탭 줄 끝의 `TabLink`(기준 화면대로 탭과 같은 모양) + `DropdownMenu`(`DropdownMenuLabel` "번역 추가", 언어 행 끝에 코드 `MenuShortcut`, 구분선, "언어 관리") | 고르면 그 언어의 새 번역을 만든다. 더할 언어가 없으면 메뉴에 "언어 추가 · 설정" 한 행. "언어 관리"와 "언어 추가 · 설정"은 설정 › 언어 탭과 함께 온다(T92). 그때까지 더할 언어가 없으면 "+ 언어"가 없다. |
| 제목 | 편집기 제목 칸(`Input appearance="inline" size="display"`와 같은 모양) | 늘 입력 칸이다. 포커스는 캐럿만 보인다. |
| 본문 블록 | `Block`(메뉴가 열린 블록은 `active`) | 글자 모양은 편집기의 것. |
| 블록 손잡이 | `BlockHandle`(`trigger`로 `DropdownMenuTrigger`를 감싼다, 메뉴가 열린 동안 `active`) | 그립 하나다(+는 없다, 2026-11-06 소유자). 누르면 블록 메뉴, 끌면 옮긴다. 블록 줄과 그 왼쪽 여백에 포인터가 있으면 뜬다. |
| 블록 메뉴 | `DropdownMenu`: `DropdownMenuLabel`(블록 종류) · `DropdownMenuSub` "다른 블록으로 바꾸기"(`DropdownMenuRadioGroup`, 행 앞에 블록 아이콘: 제목은 `HeadingIcon`. 행 끝에 마크다운 단축 `MenuShortcut typed`) · `DropdownMenuSub` "정렬"(왼쪽 · 가운데 · 오른쪽) │ "위로" · "아래로" · "복제" · "삭제"(각각 `MenuShortcut keys`) | 할 수 없는 행(첫 블록의 "위로")은 숨긴다. |
| 서식 카드 | `FloatingBar`: `FormatButton`(B, I, U, S, 코드, 서식이 있을 때 `clear` / 위 첨자, 아래 첨자, 링크, 각주, `more`의 ⋯) · `Separator orientation="vertical" length="bar"` · `FormatBarRequest`("✦ 요청") | 글자를 고르면 그 위에 뜬다. 켜진 서식은 `pressed`. 서식 지우기(⌘\)는 고른 범위 안의 서식을 링크만 남기고 모두 뺀다(editor-tools.md). |
| "/" 메뉴 | `Command`(`CommandInput`, `CommandList`, `CommandGroup` "글" · "넣기" · "컴포넌트" · "템플릿", `CommandItem`(행 앞에 블록 아이콘, 제목은 `HeadingIcon`, 행 끝에 마크다운 단축 `MenuShortcut typed`), `CommandSeparator`) | 한 단계뿐이다. 포커스는 본문에 남고 화살표 · Enter · Esc로 움직인다. "템플릿"을 치면 템플릿만 남는다. |
| 올리는 중인 이미지 | `UploadingImage` | 붙여 넣거나 끌어 넣은 그림은 창 없이 커서 자리에 들어가고 아래에 막대가 흐른다. 캡션 칸은 그때부터 있다. |
| 올리지 못한 파일 | `FileBlock tone="danger"`(세부에 이유), 아래 `Inline`에 `TextButton`("줄여서 다시" · "다시 올리기" · "빼기") | 제자리에 남는다. 이미지도 파일도 같다(2026-11-09). 속성 패널에서는 `FormFieldError`에 이유, 아래에 같은 버튼이다. |
| 이미지 도구 행 | `BlockBarPlace` 안 `FloatingBar`: `FloatingBarButton`(왼쪽 · 가운데 · 오른쪽 정렬 `pressed` / 설정 / 자르기·회전) · `Separator orientation="vertical" length="bar"`, 아래 모서리 `ResizeCorner` 둘 | 설정은 카드(`Popover`)를 연다. 자르기·회전은 시트(`Sheet` + `CropStage`)로 연다. 삭제는 블록 메뉴에 있다. |
| 이미지 설정 카드 | `Popover` 안에 `FormField`: "너비" `Input`(플레이스홀더 "본문 맞춤"), "대체 텍스트" `Input`(라벨 줄 `FormFieldLabel action`에 `TextButton tone="proposal" size="micro"` "✦ 채우기", 비었으면 `FormFieldError`), "장식 이미지" `Option` + `Switch` | 대체 텍스트를 쓰는 동안 라벨 줄에 글자 수("23 / 80"). 다른 빈 이미지가 있으면 끝에 "다음 이미지 ↵"(`TextButton`). |
| 캡션 | `Input appearance="inline" size="sm" align="center"`, 같은 줄 끝에 `TextButton tone="proposal" size="micro"` | 이미지 아래 그 자리에서 고친다. AI 버튼은 다른 필드와 같은 "✦ 채우기"다(보드의 ✦만 있는 버튼 대신). |
| 파일 블록 | `FileBlock`(`onNameChange`로 보이는 이름을 그 자리에서 고친다) | 고르는 창은 `MediaPicker`를 담은 `Dialog`([media.md](media.md)). |

### 속성 패널

글의 속성이다. **값 자리는 처음부터 기본 입력칸이다**(옅은 밑줄이 늘 보이고, 포커스하면 잉크 밑줄). 누르면 그 입력칸 안에 캐럿이 들어가거나 그 목록이 열리고, 다른 것으로 바뀌지 않는다. 보드는 쉴 때 밑줄 없는 글자로 그렸지만, 기본 입력칸을 따른다(2026-11-03 소유자 결정).

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `PropertyPanel`(300px `SidePanel`, 제목과 ×가 없다) | 머리의 속성 버튼으로 열고 닫는다. |
| 탭 줄 "기본 · SEO" | `PropertyPanel`의 `tabs`(속은 `TabsList variant="bar"`, 탭마다 `dot`) | 다른 탭에 제안이 있으면 그 탭에 `dot` "proposal"(파란 점), 고칠 곳이 있으면 `dot` "warning"(주황 점). |
| 속성 한 행 | `FormField` + `FormFieldLabel`(`htmlFor`, 라벨 줄 끝 `action`) + 입력 부품 + `FormFieldError` | 라벨은 mono 11, 값은 13. 라벨 줄 끝의 어시스턴트 버튼은 포인터나 키보드가 행 안에 있을 때만 보인다. |
| 묶음 이름 "분류" | `PropertyGroup` | 조용한 소제목. |
| 주소 | `Input mono`(슬러그만, 끝 `action`은 다시 만들기 `IconButton`). 앞뒤 고정 글자가 없어 `Affix`가 아니다 | 늘 입력 칸이다. "/posts/"는 붙이지 않는다. 전체 주소는 머리의 주소 줄에 있고, 패널 폭은 긴 슬러그에 쓴다. 고정 글자가 없으니 밑줄은 아이콘까지 행 전체다. |
| 대표 이미지 | `MediaInput size="md"`(고른 파일이면 썸네일과 파일 이름과 ×, 비었으면 "비어 있음") | 다른 필드와 같은 밑줄 한 줄이다(2026-11-05, 소유자). 누르면 `MediaPicker`를 담은 `Dialog`가 열린다. |
| 대표 이미지의 대체 텍스트 | `MediaInput` 아래 `FormField` + `FormFieldLabel` + `Input size="md"` | 이미지를 고르면 나타난다. 비었으면 `FormFieldError`. 파일(이미지가 아닌 것)에는 없다. |
| 번역의 대표 이미지 (원문 따름) | 위와 같은 둘. 비어 있는 동안 `MediaInput`은 원문의 파일을 흐리게 보이고 ×가 없으며, 대체 텍스트는 원문의 글이 플레이스홀더다 | 고르거나 쓰면 번역의 값이 되고 ×가 생긴다. ×로 지우면 다시 원문을 따른다(2026-11-09, 소유자). |
| 요약 | `Textarea size="md"` | 늘 입력 칸이다. 비었으면 플레이스홀더 "비어 있음"(`fg-faint`). 포커스하면 라벨 줄 끝의 글자 수 "28 / 120". 라벨 줄 끝 `action`은 `TextButton tone="proposal" size="micro"`("✦ 채우기", 값이 있으면 "↻ 다시"). 본문에서 채우는 일은 이 "✦ 채우기"가 한다. 입력 줄 끝의 "본문에서 가져오기" 버튼은 없앴다(2026-11-05 소유자). |
| 한 줄 글 필드 | `Input size="md"` | 요약과 같다. Enter로 끝내고, 포커스를 떠나면 그대로 남는다. |
| 카테고리 (관계 하나) | `Combobox` + `ComboboxInput` | 늘 입력 칸이다. 치면 거르고, 목록에서 고른다. 없음이 허락되면 지우기 버튼. |
| 태그 (관계 여럿) | `Combobox` + `ComboboxChips`(`ComboboxChip`, `ComboboxChipsInput`) | 고른 값은 칩, 끝의 입력 칸에서 더한다. |
| 시리즈 (관계 하나) | 카테고리와 같다. 비었으면 플레이스홀더 "없음" | 다른 필드처럼 라벨 줄 끝에 "✦ 채우기"(`TextButton tone="proposal" size="micro"`)가 그 필드를 가리킬 때만 보인다. 고른 값은 `proposal`(파란 글자)로 남고 버튼은 "↻ 다시"가 된다. 보드의 값 옆 "✦ 추천"은 이 버튼으로 바뀐다(2026-11-03 소유자 결정). |
| 고르기 필드 (`select`) | `Select` + `SelectTrigger size="md" width="full"` | 늘 트리거가 있다. 누르면 목록. |
| 켜기/끄기 필드 ("검색에서 숨기기") | `Switch` | 바로 바뀐다. |
| 다른 값을 따르는 값 (SEO 제목 · 설명 · 공유 이미지) | 그 종류의 입력 부품(`Input size="md"`, `Textarea size="md"`, 이미지)에 플레이스홀더로 따르는 값("제목과 같음 · 10/60") | 비어 있는 동안 따르는 값을 플레이스홀더로 읽힌다. 치면 그 값이 된다. |
| 어시스턴트가 쓴 값, 받기를 기다리는 제안 | 각 입력 부품의 `proposal`(파란 글자, 파란 밑줄) | 제안은 입력칸 안에 들어 있고 바로 고칠 수 있다. 고치거나 받으면 보통 색, 버리면 옛 값으로 돌아간다. |
| 사람이 바꿀 수 없는 값 (번역에서 원문과 함께 쓰는 필드) | `FormField` + `FormFieldLabel` + `Text variant="note"`, 아래 `FormFieldDescription` 한 줄 | 입력 부품이 없다. |

### 상태 표시줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 줄 | `StatusBar` | 담을 칸이 없으면 그리지 않는다. |
| 저장 상태 | `StatusBarCell`(편집 충돌이면 `tone`). 알리기만 할 때는 `render={<span />}` | "저장 전 변경사항" · "저장됨" · "브라우저에만 임시 저장됨" · "편집 충돌". 누를 일이 있으면 칸이 버튼이다(저장 전 변경사항은 누르면 저장, 로그인이 풀렸으면 로그인 화면). 소리 알림은 `StatusBarAnnouncer`. |
| "할 일 N" | `StatusBarCell` + `StatusBarList`(`TodoItem`, `TodoDone`) | 누르면 위로 목록이 열린다. 행을 누르면 그 자리로 간다. 행 끝에 동작은 두지 않는다: 여러 곳을 한꺼번에 채우는 버튼은 무엇이 어디서 바뀌는지 보여 줄 수 없어서, 채우기는 그 자리의 ✦(필드 라벨 줄의 "✦ 채우기", 이미지의 대체 텍스트 칸) 하나로만 한다. 발행을 막는 행은 `blocking`. 행의 덧말(`detail`)은 그 자리만 말한다("속성 · 비어 있음", "대표 이미지 · 본문 1"). 제목이 이미 말한 필드 이름("요약 쓰기"의 "요약")은 되풀이하지 않는다(원칙 8). 남은 것이 없으면 "할 일 없음"과 ✓ 행만. |
| 플러그인 칸 ("맞춤법 2") | `StatusBarPluginCell` | 패널 행과 "설정" · "모두 고치기"는 플러그인이 채운다. |
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
| 로그인 풀림 | `Banner tone="danger"`(`title` "로그인이 풀렸어요", `meta` "저장하지 않은 입력은 이 브라우저에 남아 있어요" `plainMeta`) | 맨 위. 화면을 바로 빼앗지 않아 쓰던 문장을 마저 쓸 수 있다. 끝에 `TextButton variant="underline"` "다시 로그인"은 평소 로그인 화면으로 간다(GitHub도 평소처럼 다녀온다). 로그인하면 주소가 같은 글을 다시 열고, 쓰던 입력은 묻지 않고 다시 들어간다(그 사이 다른 곳에서 저장하지 않았을 때. 저장했으면 임시 저장본 띠가 묻는다). 저장 칸도 "로그인이 풀렸어요"이고 누르면 같은 곳으로 간다. 모든 화면에서 같다(15). 2026-11-06 소유자: 로그인 창은 두지 않는다. |
| 편집 충돌 | `Banner tone="danger"`(`title` "다른 곳에서 10:41에 먼저 저장했어요", `meta` "이 글은 저장할 수 없어요" `plainMeta`) | 끝에 `TextButton variant="underline"` "비교하기"(비교 화면으로), `TextButton` "서버 최신본 불러오기". 답하기 전에는 사라지지 않는다. |
| 임시 저장본 | `Banner`(`title` "이 브라우저에 저장하지 않은 편집이 있어요", `meta` 시각) | 끝에 "비교하기"(underline) · "불러오기" · "버리기"(`variant="quiet"`). |
| 휴지통에 있는 글 | `Banner tone="neutral"`(`title` "휴지통에 있는 글이에요", 남은 날) | 읽기 전용 화면의 상태. |

### 링크 칸 (서식 카드의 링크 버튼 아래)

기준 화면: `Screens/Reference/Editor` › LinkCardOpen · LinkCardSearch · LinkCardAddress · LinkCardLinked. 칸은 하나이고, 친 것이 링크를 정한다(노션과 같다, 2026-11-06 소유자).

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 칸 | `Popover`(링크 `FormatButton`이 트리거, `padding="menu"`, `width="md"`) 안 `Command`: `CommandInput`(플레이스홀더 "주소를 붙여 넣거나 글 찾기", 이름 "링크 주소") | `/` 메뉴와 같은 모양이다. 화살표와 Enter로 행을 고른다. |
| 막 열었을 때 | `CommandGroup` "최근에 고친 글": `CommandItem`(앞 `Document` 아이콘, 글 제목, 끝 `MenuValue` 컬렉션 이름) | 문서 컬렉션마다 가장 최근에 고친 글을 모아 다섯 줄. |
| 글자를 쳤을 때 | `CommandGroup` "글": 제목에 그 글자가 있는 글. 발행 안 된 글은 끝이 "게시글 · 초안". 없으면 `CommandEmpty` "맞는 글이 없어요" | 고르면 그 글 자체를 가리키는 링크(`monti:entry/<묶음 id>`)가 걸린다. 글의 주소가 바뀌어도 끊기지 않는다. |
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
| `todo` · `todoOpen` | 1.10, 1.13, 1.14, 1.15, 1.16, 1.18 | "할 일" `StatusBarList`(남음: `TodoItem` + `TodoDone`, 다 채움: `TodoDone`만) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |
| `pluginOpen` | 1.06 | 플러그인 칸의 `StatusBarList` | Patterns/Frame/StatusBarList |
| `panel` · `panelTab` | 1.08 | `PropertyPanel`과 고른 탭 | Monti/Proposal/PropertyPanel |
| `seriesPending` | 1.07 | 시리즈 값이 `proposal`, 라벨 줄 끝 `TextButton tone="proposal" size="micro"`("↻ 다시") | Controls/Button/TextButton |
| `toast` "발행 막힘" · "발행됨" | 1.10, 1.14 | `toast.error` "발행할 수 없어요 …" · `toast` "발행되었어요"와 "보기" | Controls/Status/Toast |

## 흐름 2 · 어시스턴트

단계: 2.04, 2.07, 2.05. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

함께 열리는 화면: `AssistantPanel`([assistant.md](assistant.md)).

이 화면에서는 기본 틀만 쓴다.

## 흐름 3 · 번역

단계: 3.01, 3.08, 3.14. 단계마다 보이는 것은 [flows/03-translation.md](../flows/03-translation.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `langMenu` "열림" · "언어 하나뿐" | 3.01, 3.14 | "+ 언어" `DropdownMenu` | Controls/Menu/DropdownMenu |
| `todo` · `todoOpen` | 3.01, 3.08, 3.14 | "할 일" `StatusBarList`(남음: `TodoItem` + `TodoDone`, 다 채움: `TodoDone`만) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |
| `toast` "발행 막힘" · "발행됨" | 3.08 | `toast.error` "발행할 수 없어요 …" · `toast` "발행되었어요"와 "보기" | Controls/Status/Toast |

## 흐름 5 · 휴지통

단계: 5.18. 단계마다 보이는 것은 [flows/05-trash.md](../flows/05-trash.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `trashed` | 5.18 | 휴지통 머리와 `Banner`, 본문과 속성은 읽기 전용(입력 부품 `disabled`) | Patterns/Frame/Banner |
| `todo` · `todoOpen` | 5.18 | "할 일" `StatusBarList`(남음: `TodoItem` + `TodoDone`, 다 채움: `TodoDone`만) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |

## 흐름 6 · 미디어

단계: 6.05, 6.06, 6.38. 단계마다 보이는 것은 [flows/06-media.md](../flows/06-media.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `img` "올리는 중" · "설정" · "파일" | 6.05, 6.06, 6.38 | `UploadingImage` · `FloatingBar`와 설정 `Popover` · `FileBlock` | Patterns/Frame/UploadingImage, Monti/EditorTools/FloatingBar, Controls/Overlay/Popover, Patterns/Frame/FileBlock |
| `todo` · `todoOpen` | 6.05, 6.06, 6.38 | "할 일" `StatusBarList`(남음: `TodoItem` + `TodoDone`, 다 채움: `TodoDone`만) | Patterns/Frame/StatusBarList, Monti/EditorTools/TodoItem |
