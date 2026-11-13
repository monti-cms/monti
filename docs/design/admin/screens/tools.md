# 도구 (Templates, TemplateEditor, Data, ApiKeys)

도구 화면 셋(템플릿, 데이터, API 키)은 같은 틀을 쓴다. 템플릿 편집기는 도구 틀 밖의 따로 된 페이지다. 활동 기록은 도구의 탭이 아니라 사이드바에 제 행이 있는 화면이다(2026-11-12 소유자: "사이드바로 빼는게 더 좋아보이네 승인할게."). 그 지도는 [activity.md](activity.md)에 있다.

## 도구 틀 (세 화면 공통)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 사이드바 | 공통 틀([common.md](common.md)), 현재 위치 "도구" | "도구" 행에는 개수가 없다. 누르면 첫 탭이 열린다: 템플릿, 본문 템플릿을 껐으면 데이터. |
| 페이지 단 | `PageColumn` | `width="content"`. |
| 제목 행 "도구" | `PageHeader` | 템플릿과 API 키 화면만 검은 알약 하나("+ 템플릿 추가", "+ 키 추가"). 데이터는 머리에 알약이 없다. |
| 탭 "템플릿 · 데이터 · API 키" | `PageToolbar` 안의 `TabLinks` + `TabLink` | 탭 하나가 페이지 하나이고 탭마다 제 주소가 있다(`#/tools`, `#/tools/keys`). 탭을 키보드로 누르면 포커스는 페이지로 떨어지지 않고 새 페이지의 같은 탭(이제 열린 탭)에 선다: 탭 줄이 남는 설정과 같게(만들며 정함 2026-11-13). 포인터로 누르면 옮기지 않는다. 만든 도구의 탭만 보인다: 탭은 "템플릿 · 데이터 · API 키"다(`#/tools`, `#/tools/data`, `#/tools/keys`). 플러그인의 도구 페이지(`toolPages`)는 그 뒤에 탭 하나씩이다(`#/tools/p/<플러그인>/<id>`). 화면은 도구의 제목과 탭 줄 아래 `PageBody`에 플러그인의 브라우저 쪽이 준 것을 그린다. 그 화면을 주지 않은 페이지는 탭이 없다(만들며 정함 2026-11-13). 활동 기록은 도구의 탭이 아니라 사이드바의 제 행이다(문서 13의 소유자 결정 3). 본문 템플릿을 꺼도 "데이터" · "API 키" 둘이 남으므로 탭 줄은 늘 있다. 그때 사이드바의 "도구"와 템플릿의 주소(`#/tools`)는 남은 첫 탭인 "데이터"를 연다(만들며 정함 2026-11-13: 14번이 "데이터"를 더하기 전에는 "API 키" 하나만 남아 탭 줄이 없었고 그 페이지가 열렸다). 열면 다 보이는 목록의 개수(템플릿 수)는 탭에 붙이지 않는다(원칙 8, 2026-11-05 소유자). |
| ✦ 어시스턴트 열기 | 공통 틀 | 사이드 패널이 열린 동안에는 가려진다. |

## 템플릿 (Templates)

- 보드: `Templates.dc.html`. 상태: [screens.md › Templates](../screens.md#templates). 사이드바의 "도구"가 이 탭을 연다.
- 공통 틀: 도구 틀, 메뉴, 토스트.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "+ 템플릿 추가" | `PageHeader`의 `children`에 `Button variant="primary"`(앞 아이콘 +) | 새 템플릿 편집기로 간다. |
| 표 | `Table`(`TableBody`, `TableRow twoLine`, `TableCell`) | 열 이름 행은 없다. |
| 이름 · 제목들 | 이름 `RowLink`(템플릿 편집기로), 아래 `Text variant="note" tone="subtle" truncate`("서론 · 본론 · 결론") | 아래 줄은 템플릿의 제목들을 한 줄로 늘어놓는다. 행 어디를 눌러도 편집기가 열린다. |
| 고친 날 "10. 20 고침" | `Count` | |
| ⋯ | `RowActions` 안 `RowMore`(`label` "더 보기") + `DropdownMenu`("복제" │ "지우기" `variant="danger"`) | 늘 보인다. 보드는 포인터가 있는 행에만 글자 버튼으로 그렸지만 [list.md](../components/list.md)와 [button.md](../components/button.md)를 따른다. |
| 빈 목록 | `Empty`(`title` "아직 템플릿이 없습니다.") | 시작은 머리의 "+ 템플릿 추가"다. |

스토리: Controls/Button/Button, Patterns/List/Table, Primitives/Text, Controls/Status/Count, Controls/Button/IconButton, Controls/Menu/DropdownMenu.

## 템플릿 편집기 (TemplateEditor)

- 보드: `TemplateEditor.dc.html`. 상태: [screens.md › TemplateEditor](../screens.md#templateeditor).
- 공통 틀: 사이드바와 도구 틀이 없는 따로 된 페이지다(`StandalonePage`). 본문(블록 손잡이, 블록 메뉴, "/" 메뉴, 서식 카드)은 [editor.md](editor.md)의 글 단과 같다. 알림 띠는 [common.md](common.md)를 따라 `StandalonePage`의 `banner` 자리에 선다.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 머리 줄 | 높이 `height-header`, 아래 가는 선 하나 | 편집기 머리와 같은 줄이다. |
| "‹ 템플릿" | `TextButton variant="quiet"`(앞 아이콘, 템플릿 목록으로) | |
| "저장 안 됨" | `EntryStatus status="editing"` | 바뀐 것이 있는 동안만. |
| "저장" | `Button variant="primary"`(저장하는 동안 `loading`) | 템플릿을 읽어 온 뒤에는 늘 있다. 읽기 전과 읽지 못했을 때는 "저장"과 구분선, ⋯, 이름 칸, 상태 표시줄이 없다(이름을 모르는 채로 누르면 "이름을 써 주세요."가 떴다. T153). 발행이 없으므로 이 페이지의 검은 알약 하나다. 보드의 "⌘S"는 [button.md](../components/button.md)를 따라 뺀다. |
| ⋯ | `IconButton` + `DropdownMenu`("복제" │ "지우기" `variant="danger"`) | 새 템플릿에는 없다. |
| 머리 끝 구분선 | `Separator orientation="vertical" length="control"` | "저장" 알약 뒤, ⋯와 ✦ 앞. 편집기 머리와 같다([editor.md](editor.md)). |
| ✦ 어시스턴트 열기 | [common.md](common.md)의 ✦ 어시스턴트 열기 | 머리 줄 끝. |
| 이름 | `Input appearance="inline" size="display"`(플레이스홀더와 이름 "템플릿 이름"), 아래 잉크 선 `EditorTitleRule` | 라벨 없이 글 제목 자리에 놓인다. 이름 없이 저장하면 그 아래 `FormFieldError`("이름을 써 주세요."). |
| 본문 | 편집기 본문 | 읽기 폭. 블록과 메뉴는 [editor.md](editor.md)와 같다. |
| 상태 표시줄 | `StatusBar`: `StatusBarSpacer` 뒤 `StatusBarCell end`(글자 수) | 글자 수만 있다. |

스토리: Controls/Button/TextButton, Controls/Status/EntryStatus, Controls/Button/Button, Controls/Button/IconButton, Controls/Menu/DropdownMenu, Primitives/Separator, Controls/Field/Input, Primitives/Box, Patterns/Frame/StatusBar.

### 뜨는 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 다른 곳에서 먼저 저장함 | `Banner tone="danger"`(`title` "다른 곳에서 먼저 저장했습니다", `plainMeta`), 끝에 `TextButton` "서버 최신본 불러오기" | 화면 맨 위(머리 줄보다 위). 저장이 거절됐을 때만. |
| 저장하지 않은 편집 | `Banner`(`title` "이 브라우저에 저장하지 않은 편집이 있습니다"), 끝에 `TextButton` "불러오기"(한 번에 들어간다. 키보드로 눌렀으면 포커스는 본문으로, 본문이 아직 없으면 이름 칸으로 간다) · `TextButton variant="quiet"` "버리기" | 화면 맨 위(머리 줄보다 위). 저장하지 않고 닫은 편집이 이 브라우저에 남아 있을 때만. 글 편집기와 같은 임시 저장(`useEntryEditor`)이다. 템플릿에는 비교 화면이 없다. |
| 불러오지 못함 | `Banner tone="danger"`(`title` "템플릿을 불러오지 못했습니다", `plainMeta`), 끝에 `TextButton` "다시 시도" | 화면 맨 위(머리 줄보다 위). 템플릿을 읽지 못했을 때만. |

## 데이터 (Data)

- 보드: `Data.dc.html`. 상태와 흐름: [screens.md › Data](../screens.md#data), [흐름 9](../flows/09-data.md).
- 공통 틀: 도구 틀, 시트, 토스트.

### 기본 틀

#### 페이지

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "백업" 절 | `Section` | 왼쪽 제목, 오른쪽 내용. "가져오기" 절은 빠졌다(2026-11-05 소유자: 가져오기는 컬렉션 목록의 "+ 새 글 쓰기 ▾" 메뉴로). |
| "미디어 파일도 담기 2.1 GB" | `Option` + `Checkbox`, 크기는 그 메모 | 기본은 꺼짐. 바로 적용되는 설정이 아니라 이번 백업의 선택이라 체크박스다. 무엇을 담을지 먼저 고르고 받으므로 알약 위에 둔다. |
| "백업 받기" | `Button variant="primary"` | 누르면 그 선택대로 바로 만든다. 만드는 동안 `loading`, 라벨은 "만드는 중 64%". |
| (만들며 정함 2026-11-13) |  | 저장소가 없거나 미디어 파일이 없는 사이트에는 "미디어 파일도 담기"가 없다. 탭은 "템플릿" · "데이터" · "API 키" 순이고 주소는 `#/tools/data`다. 마지막 백업은 오늘이면 시각("09:12"), 아니면 날짜("10. 20")다. 스토리: Screens/Tools/Data. |
| "마지막 백업 10. 20" | `Text variant="note" tone="subtle"`, 날짜는 `mono` | 알약 옆. 없으면 "없음". |

스토리: Patterns/Frame/Section, Controls/Button/Button, Primitives/Text, Controls/Choice/Option, Controls/Choice/Checkbox, Controls/Field/Input, Controls/Overlay/Sheet, Controls/Field/Field, Patterns/List/MapRow, Controls/Field/Select, Controls/Choice/Segmented, Controls/Choice/Switch, Controls/Button/TextButton, Patterns/Frame/DescriptionList.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 가져오기 · 복원 시트

> 바뀜 (2026-11-05, 소유자): 가져오기는 도구 › 데이터가 아니라 컬렉션 목록의 "+ 새 글 쓰기 ▾" 메뉴 › "가져오기"에서 그 컬렉션 하나에 한다. 들어갈 곳을 고르는 단계가 없다. `.md`, `.mdx`는 MDX 플러그인이 있을 때만 받는다. 도구 › 데이터에는 백업 받기만 남는다. [기능 설계 14](../../features/14-data-keys-plugins.md#가져오기) 참고. 이 시트는 목록에서 열리고, "들어갈 곳" 칸이 없다.

> 빠짐 (2026-11-05, 소유자): 통째로 되살리기는 관리자 화면에서 빠지고 `monti restore` 명령이 한다. 화면은 백업 받기와 가져오기만 있다. [기능 설계 14](../../features/14-data-keys-plugins.md#통째로-되살리기) 참고. 아래의 복원 행과 상태는 빠진다.

> 만들며 정함 (2026-11-13): 만든 시트는 아래 표에서 이렇게 다르다. 파일을 고르면 바로 열려 `Text tone="subtle"` "읽는 중…"을 보이고, 읽지 못하면 이유 한 줄(`Text`)과 발의 "닫기"만 있다. "들어갈 곳", "발행", "바깥 이미지 … 옮기기" 칸은 없다(모두 초안은 요약 아래 한 줄이 말한다). 묶음의 이름은 `FormFieldSet` + `FormFieldLegend variant="field"`다(입력 하나의 라벨이 아니라 여러 줄의 이름이다). 필드 고르기는 `Select size="sm"`이고 어시스턴트가 맞추지 않으므로 `proposal`이 없다. "알아 두세요"의 줄은 있는 것만: "원문 그대로 남는 컴포넌트: `Tweet`"(이름은 `mono`), "이미 있는 글 n편은 건너뜁니다", "가져올 수 없는 글 n편은 건너뜁니다", "요약 없는 글 n편", "찾을 수 없는 이미지 n개는 빠집니다". 발의 "취소" · "되돌리기" · "닫기"는 다른 시트처럼 `Button variant="ghost"`이고, 알약은 "3편 가져오기"(가져올 글이 없으면 알약 없이 "닫기"만), 일하는 동안 `loading` "이미지 올리는 중 1/3" 뒤 "가져오는 중…", 가져온 뒤 "목록에서 보기"(시트를 닫는다). 결과의 둘째 줄은 "모두 초안 · 새 항목 2개 · 이미지 1개 · 1편 건너뜀" 가운데 있는 것만이다. 스토리: Screens/List/Import(Read, Importing, Done, NeedsPlugin, Unreadable).

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetContent`, `SheetHeader`, `SheetBody`, `SheetFooter`) | 일하는 동안(가져오는 중, 복원 중) `SheetHeader closable={false}`. |
| 제목 | `SheetTitle of`(파일 이름, `ofMono`) | "가져오기 · blog-export.zip", "있던 그대로 복원 · monti-backup-1020.zip". |
| 찾은 것 요약 | `Text`("글 24편을 찾았습니다"), 그 아래 `Text variant="note" tone="subtle"` | 건너뛰기와 -2 규칙을 한 줄로. |
| "들어갈 곳" | `FormField` + `FormFieldLabel`, 행은 `MapRow`(`name` "posts/", `example` "24편", 자식 `Select`) | 폴더마다 어느 컬렉션으로 갈지. |
| "필드 맞추기 · 게시글" | `FormField` + `MapRow` 여럿(`name` 파일의 키, `example` 예시 값, `warning` "새 태그 4개가 생깁니다", 가져오지 않는 키는 `off`, 자식 `Select`) | 어시스턴트가 맞춘 선택은 `Select`의 `proposal`(파랑). 고르면 보통 색. |
| "발행" | `FormField` + `Segmented size="sm" inline`("모두 초안" · "원래대로") |  |
| "이미지" | `FormField`, 문장 `Text`, "바깥 이미지 6개도 옮기기" `Option spread` + `Switch` |  |
| "알아 두세요" | `FormField`, 문장 `Text`(컴포넌트 이름은 `mono`) |  |
| 가져온 뒤 | `Text variant="heading"` "21편을 가져왔습니다.", 그 아래 `Text tone="subtle"`, "주소를 바꾼 글 · 2" `Label` 아래 `ChangeLines`(`what` 글 이름 링크, `then` mono "/about → /about-2") | 글 이름을 누르면 그 글이 열린다. |
| (빠짐, 2026-11-05) 복원 요약 | `DescriptionList variant="summary"` + `DescriptionItem`: "글" · "폴더" · "미디어" · "주소" · "템플릿" | 이름 칸 120px, 값은 잉크 숫자, 뒤에 흐린 메모 `Text variant="meta" tone="subtle"`("초안 12 · 발행 130 · 보관 6 · 번역 21"). |
| (빠짐, 2026-11-05) 복원 막힘 문제 목록 | 문장 하나 `Text` "문제가 2개 있어서 복원하지 않습니다.", 그 아래 문제마다 `IssueRow`(`name` "이 사이트에 없는 필드", `code` "series", `warning` "글 14편이 이 값을 가지고 있습니다") | 아무것도 쓰지 않았다는 문장 하나. 행 사이는 가는 선. 고르기는 없다. 고치는 곳은 가져오기 흐름이다(발의 "가져오기로 열기"). 그 길을 설명하는 문장은 두지 않는다. |
| 발 | `SheetFooter`: "취소" `TextButton`, 알약 `Button variant="primary"`("21편 가져오기", 일하는 동안 `loading` "가져오는 중 12/21", "복원", "복원하는 중…"). 복원이 막히면 알약은 "가져오기로 열기"이고 누를 수 있다. 같은 파일을 가져오기 흐름으로 연다(없는 필드는 필드 메뉴로 맞추고, 겹치는 주소에는 "-2"가 붙는다). 가져온 뒤에는 왼쪽 "되돌리기" `TextButton`, 알약 "목록에서 보기"(`href`). | 알약은 하나다. |

### 흐름 9 · 데이터

단계: 9.01, 9.02, 9.03, 9.06, 9.07, 9.08, 9.09, 9.12, 9.13, 9.14, 9.15. 단계마다 보이는 것은 [flows/09-data.md](../flows/09-data.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "기본" | 9.01 | "백업" 절 하나 |  |
| "백업 중" | 9.02 | "백업 받기" `Button loading` "만드는 중 64%" | Controls/Button/Button |
| "백업 받음" | 9.03 | `toast` "백업을 저장했습니다", 마지막 백업 "09:12"(오늘이면 시각) | Controls/Status/Toast |
| "가져오기" | 9.06 | 시트: 요약, "필드 맞추기" |  |
| "가져오기 아래" | 9.07 | 시트 아래쪽: "이미지", "알아 두세요" |  |
| "가져오는 중" | 9.08 | 시트 `SheetHeader closable={false}`, 알약 `loading` "이미지 올리는 중 1/3" 뒤 "가져오는 중…" |  |
| "가져옴" | 9.09 | 시트: 결과 문장, 주소를 바꾼 글 목록, 발 "되돌리기" · "목록에서 보기" |  |
| (빠짐, 2026-11-05) "복원" | 9.12 | 시트 "있던 그대로 복원": 백업 요약, 알약 "복원". 사이드바 `fresh`(빈 사이트) |  |
| (빠짐, 2026-11-05) "복원 막힘" | 9.13 | 시트: 문장과 문제 목록(`IssueRow`), 알약 "가져오기로 열기" | Patterns/List/MapRow |
| (빠짐, 2026-11-05) "복원 중" | 9.14 | 시트 `SheetHeader closable={false}`, 알약 `loading` "복원하는 중…" |  |
| (빠짐, 2026-11-05) "복원함" | 9.15 | `toast` "글 148편을 복원했습니다"와 `action` "목록 보기" | Controls/Status/Toast |

## API 키 (ApiKeys)

- 보드: `ApiKeys.dc.html`. 상태와 흐름: [screens.md › ApiKeys](../screens.md#apikeys), [흐름 10](../flows/10-api-keys.md).
- 공통 틀: 도구 틀, 작은 폼 창, 확인 질문, 알림 띠, 토스트.

### 기본 틀

#### 페이지

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "+ 키 추가" | `Button variant="primary"`(앞 아이콘 +) | 서비스 고르기 창을 연다. 서버 비밀값이 없으면 숨는다. 키를 저장할 수 없는 이유는 알림 띠 하나가 말한다(원칙 7). 키 목록을 읽기 전에는 없다: 저장할 수 없는 사이트에 잠깐이라도 보이지 않는다(편집기 머리의 버튼이 글을 읽은 뒤에 서는 것과 같다). |
| 알림 띠 | `PageBanner` 안의 `Banner`(`title` "키 3개를 읽을 수 없습니다" 또는 "키를 저장할 수 없습니다", 문장 안의 `MONTI_SECRET`은 `mono`) | 화면 맨 위, 틀의 띠 자리에 선다([common.md](common.md)의 "화면의 알림 띠"). 제목과 탭이 그 아래다. |
| 키 목록 | `Table`(`TableBody`, `TableRow twoLine`, `TableCell`). 열 이름 행은 없다 | 템플릿 탭의 목록과 같은 공용 표다(2026-11-12: 같은 종류는 같은 부품으로). 목록이 "AI 키" 하나뿐인 동안은 탭 이름이 이미 말하므로 목록 이름을 두지 않는다. 플러그인이 키 자리를 둔 사이트는 목록이 둘이고, 목록마다 이름("AI 키", "플러그인 키")이 위에 붙는다(`Heading as="h2" variant="label"`, 아래 선). "플러그인 키"는 "모델" 아래에 선다. 페이지는 목록과 "모델"을 `Stack gap={40}`으로 띄운다. |
| 키 한 행 | 첫 줄에 이름 `Text`와 끝 네 글자 `Count`("··· a1b2"), 둘째 줄에 `Text variant="note"`로 사용량("이번 달 1.24M 토큰" `tone="subtle"`, 쓰지 않았으면 "이번 달 사용 없음" `tone="faint"`이고 이름도 `muted`, 읽을 수 없으면 "읽을 수 없음" `tone="danger"`). 끝에 `RowActions` 안 `RowMore`(`label` "(이름) 더 보기") + `DropdownMenu`("편집" │ "지우기" `variant="danger"`) | 키 값은 끝 네 글자만 보인다. 12자보다 짧은 키는 끝 글자가 없다. 넣은 순서로 선다(시계가 멈췄거나 서버마다 달라도 같다). 이름은 한 줄이고 60자까지다. 줄보다 길면 이름이 "…"로 잘리고 끝 네 글자는 제 자리를 지킨다. 서버 비밀값이 없으면 메뉴에 "지우기"만 있다. |
| 키가 없을 때 | `Empty`(`title` "아직 키가 없습니다.") | 템플릿 탭의 빈 목록과 같다. 시작은 머리의 "+ 키 추가"다. 서버 비밀값이 없으면 이 줄도 없고 띠만 있다. |
| "빠른 작업" 모델 | `ListSection`(`title` "모델") 안의 `ListSectionRow`(`title` "빠른 작업", `meta` "요약 · 태그 · 대체 텍스트"), `control`에 `MenuField`(`value` 모델 `mono`, `meta` 키 이름)를 트리거로 둔 `ModelMenu layout="field"` | 목록이 아니라 설정 한 줄이다. 보조 줄과 키 이름은 사람이 읽는 말이라 sans이고, 모델 이름만 mono다. 키 이름이 길면 이름이 잘리고 모델은 온전히 보인다. 열면 검색 행과 키별 묶음, 지금 모델에 ✓. 고르면 바로 적용하고 토스트. "최근" 묶음과 생각 행은 없다. 모델을 주는 키가 하나도 없으면 `MenuField placeholder="키 없음"`이고, 누르면 "키 추가" 창(서비스 고르기)이 열린다. 서버 비밀값이 없으면 이 묶음이 숨는다. |
| 플러그인 키 자리 | 키 목록과 같은 표의 행: 첫 줄에 플러그인 이름, 자리가 여럿이면 뒤에 "검색 키", 키가 있으면 "··· 4410", 둘째 줄에 플러그인 코드(mono). 끝은 키가 있으면 같은 ⋯, 없으면 `Button variant="ghost" size="sm"` "키 넣기" 하나 | 키 줄은 모두 같은 모양, 같은 방법이다. "키 넣기"와 "편집"은 같은 키 창을 열고, 플러그인 자리의 창은 서비스가 정해져 있다(서비스는 글). 자리 하나는 한 서비스의 것이라 저장된 키를 고르지 않는다(2026-11-05 소유자). 서버 비밀값이 없으면 자리들이 숨는다. 자리의 창에는 "이름" 칸이 없다: 줄은 플러그인의 이름으로 불린다(만들며 정함 2026-11-13). 주소를 묻는 서비스의 자리에서 주소만 바꿔 보내면 키 칸이 열리며 아래 `FormFieldDescription` "키를 다시 넣어 주세요."(새 주소는 키와 함께 확인한다). 주소를 저장된 것으로 되돌리면 그 줄이 사라지고 키 칸이 저장된 키로 다시 닫힌다(이미 키를 쳤으면 그대로 둔다). 제목은 "키 넣기 · 바른 맞춤법", 키가 있으면 "편집 · Algolia 검색 · 검색 키". 읽을 수 없는 키는 둘째 줄이 "읽을 수 없음" `tone="danger"`이고 띠의 수에 든다. "지우기"는 AI 키와 같은 확인 창이고 "이름"에 자리의 이름이 온다. "+ 키 추가"의 서비스 목록과 키 창의 "서비스" 고르기에는 자리만을 위한 서비스가 없다. 주인이 사라진 자리(플러그인을 코드에서 뺐다)의 키는 줄로 남는다: 이름은 플러그인과 자리의 코드, 둘째 줄은 `Text variant="note" tone="faint"` "플러그인 없음", ⋯에는 "지우기"만. 서버 비밀값이 없는 사이트에서는 키가 든 자리만 보이고 ⋯에 "지우기"만 있다(위 "서버 비밀값이 없으면 자리들이 숨는다"는 빈 자리의 이야기다). 키보드로 자리의 키를 지우면 포커스는 그 줄의 "키 넣기"로 간다(줄이 사라지는 것은 AI 키처럼 다음 줄로). |

스토리: Screens/Tools/ApiKeys(만든 화면), Controls/Button/Button, Patterns/Frame/Banner, Patterns/Frame/PageBanner, Patterns/List/Table, Patterns/List/Empty, Patterns/List/ListSection, Controls/Menu/DropdownMenu, Controls/Menu/ModelMenu, Controls/Overlay/Dialog, Controls/Menu/PickList, Controls/Overlay/DialogFormFooter, Controls/Field/Field, Controls/Field/Select, Primitives/Text, Controls/Field/Input, Controls/Field/SecretInput, Controls/Overlay/AlertDialog, Patterns/Frame/DescriptionList.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 서비스 고르기 "키 추가" | `Dialog`(`DialogContent`, `DialogHeader`, `DialogTitle`), 목록 `PickList`(`aria-label` "서비스") 안에 `PickListItem`. 발은 `DialogFooter`에 "취소" `Button variant="ghost"` | 서비스를 고르면 같은 창이 키 입력 창이 된다. 창은 하나라서 그 사이에 닫히고 열리는 것이 없고, 배경도 그대로다. 알약이 없다. 서비스는 Anthropic · OpenAI · OpenRouter · Google · OpenAI 호환 주소다(Ollama는 호환 주소로 쓴다). 묶음이 하나뿐인 동안은 묶음 이름이 없다. 플러그인이 서비스를 더하면 그때 묶음 이름 `PickListLabel` "AI" · "플러그인"과 `PickListSeparator`가 생긴다. 창이 열리면 포커스는 창에 있고 Tab이 첫 서비스로 간다. |
| 키 추가 · 편집 창 | `Dialog` + `DialogFormFooter`(`submitLabel` "추가" 또는 "저장", 서비스에 묻는 동안 `busy`와 `busyLabel` "확인하는 중…") | 포커스는 비어 있는 첫 칸으로 간다: 추가 창은 키, 호환 주소 창은 주소, 편집 창은 이름, 읽을 수 없는 키의 편집은 키. 필드 안의 Enter는 알약을 누른다. 빈 칸으로 보내면 그 칸 아래 `FormFieldError` "이 칸을 채워 주세요."와 포커스이고 서비스에 묻지 않는다. 이름만 고친 편집은 서비스에 묻지 않는다. 편집 창의 제목은 `DialogTitle of`("편집 · Anthropic 개인"). 묻는 동안에는 창을 닫을 수 없다(`DialogFormFooter lockWhileBusy` 하나가 "취소"를 끄고 Esc와 창 밖 누르기도 막는다. 2026-11-12 만들며 정함, 레퍼런스: WAI-ARIA APG의 대화상자, Apple HIG): 닫는 것은 "하지 않는다"는 뜻인데 보낸 추가를 서버가 거둘 수 없다. 답이 오면(길어야 10초) 받아 준 키는 더해지며 창이 닫히고, 거절이면 창이 열린 채 다시 닫을 수 있다. 어느 칸의 일도 아닌 실패(서버가 까닭 없이 실패)는 `toast` "문제가 생겼습니다"이고, 포커스는 거절 때처럼 키 칸으로 간다(키 칸이 닫혀 있으면 이름. 만들며 정함 (2026-11-13)). 창은 다른 창처럼 흐려지며 닫히고, 다시 열면 빈 칸에서 시작한다. 목록을 읽은 뒤 다른 곳에서 그 키가 바뀌었으면 `toast` "다른 곳에서 먼저 저장했습니다"와 함께 창이 닫히고 목록을 다시 읽는다(템플릿, 글, 파일 패널과 같은 말). |
| "서비스" | 추가 창은 `FormField` + `Select`(화면의 `PickOne`), 편집 창과 플러그인 자리의 창은 `FormField`에 글로만 `Text` | 창 안에서 서비스를 바꾸면 주소 칸이 생기거나 사라지고, 포커스는 방금 쓴 "서비스"에 남는다. 별표는 키를 비울 수 있는 호환 주소 창의 주소와 이름에만 붙는다(모든 칸이 필수인 창에는 별표가 없다). |
| "주소" (OpenAI 호환) | `FormField` + `FormFieldLabel required` + `Input mono` |  |
| "이름" | `FormField` + `FormFieldLabel` + `Input`(`maxLength` 60) | 서비스 이름으로 채워진다(호환 주소는 주소의 호스트). 같은 이름이 있으면 "Anthropic 2"로 채우고 아래 `FormFieldDescription` "이름이 Anthropic인 키가 이미 있습니다." 직접 적은 이름이 겹치면 같은 말이 `FormFieldError`로 뜬다. |
| "키" (새 값) | `FormField` + `FormFieldLabel` + `SecretInput` | 눈 버튼으로 보이고 가린다. 거절되면 `aria-invalid`와 `FormFieldError` "맞지 않는 키입니다.", 서비스가 답하지 않으면 "서비스가 답하지 않습니다."(호환 주소는 주소 칸 아래). 적은 키는 그대로 남는다. 호환 주소는 플레이스홀더 "없음". |
| "키" (저장된 값, 편집) | `SavedValue`(`··· a1b2`, 끝자리가 없는 짧은 키는 "···", 키가 없으면 "없음", `action` "바꾸기") | "바꾸기"를 누르면 그 자리가 `SecretInput keep`(끝에 "그대로")이 되고 포커스가 간다. 높이가 같아 아래가 움직이지 않는다. 읽을 수 없는 키는 처음부터 `SecretInput`이고 아래 `FormFieldDescription` "키를 다시 넣어 주세요." |
| 지우기 확인 | `AlertDialog`(`AlertDialogTitle` "키를 지울까요?", `AlertDialogDescription` "되돌릴 수 없습니다. 이 키를 쓰는 곳이 멈춥니다."), 그 아래 `DescriptionList`: 첫 줄 `DescriptionItem` "이름"에 그 키의 이름, 이어서 쓰는 곳("어시스턴트" · "빠른 작업", 모델 `mono`). `AlertDialogCancel` "취소", `AlertDialogAction variant="danger"` "지우기" | 질문에는 이름을 넣지 않는다(휴지통의 "영구 삭제할까요?"와 같다. 이름이 "…키"로 끝나면 "키 키를"이 된다). 어느 키인지는 창의 첫 줄이 말한다. 쓰는 곳이 없으면 "되돌릴 수 없습니다."와 이름 한 줄뿐이다. 지우면 줄이 사라지고 `toast` "키를 지웠습니다". 지우지 못하면 `toast`가 까닭을 알린다: 그 사이 바뀐 키면 "다른 곳에서 먼저 저장했습니다"이고 목록을 다시 읽는다. 키보드로 "지우기"를 눌렀으면 포커스는 다음 줄의 ⋯로, 다음 줄이 없으면 앞 줄의 ⋯로, 줄이 남지 않으면 "키 추가"로(그것도 없으면 페이지의 탭으로) 간다(`AlertDialogContent finalFocus`. 만들며 정함 (2026-11-13)). 포인터로 눌렀으면 옮기지 않는다. "취소"나 Esc로 닫으면 그 줄의 ⋯로 돌아간다. |

### 흐름 10 · API 키

단계: 10.01, 10.02, 10.02b, 10.03, 10.04, 10.05, 10.06, 10.07, 10.08, 10.09, 10.10, 10.11, 10.11b, 10.12, 10.12b, 10.13, 10.13b, 10.14, 10.14b, 10.15. 단계마다 보이는 것은 [flows/10-api-keys.md](../flows/10-api-keys.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "서비스 고르기" | 10.01 | 서비스 고르기 `Dialog` + `PickList` | Controls/Overlay/Dialog, Controls/Menu/PickList |
| "키 입력" | 10.02 | 추가 창: "서비스" `Select`, "이름", "키" `SecretInput`(포커스) | Controls/Field/Select, Controls/Field/SecretInput |
| "호환 주소" | 10.02b | 추가 창에 "주소" `Input mono`, 이름은 호스트("localhost:11434"), 키 플레이스홀더 "없음" | Controls/Field/Input |
| "확인하는 중" | 10.03 | `DialogFormFooter busy` "확인하는 중…" | Controls/Overlay/DialogFormFooter |
| "키 거절" | 10.04 | 키 `aria-invalid`와 `FormFieldError`, 창은 열린 채 | Controls/Field/Field |
| "이름 겹침" | 10.05 | 이름 "Anthropic 2"와 `FormFieldDescription` | Controls/Field/Field |
| "추가됨" | 10.06 | 표의 새 행, `toast` "키를 추가했습니다" | Controls/Status/Toast |
| "편집" | 10.07 | 편집 창: 서비스는 글, 키는 `SavedValue` | Controls/Field/SecretInput |
| "편집 키 열기" | 10.08 | 키 자리가 `SecretInput keep`("그대로") | Controls/Field/SecretInput |
| "편집 확인 중" | 10.09 | `SecretInput keep`, `DialogFormFooter busy` | Controls/Field/SecretInput, Controls/Overlay/DialogFormFooter |
| "편집 저장됨" | 10.10 | 행의 끝 네 글자 "7c0e", `toast` "저장했습니다" | Controls/Status/Toast |
| "지우기 확인" | 10.11 | `AlertDialog`와 쓰는 곳 `DescriptionList` | Controls/Overlay/AlertDialog, Patterns/Frame/DescriptionList |
| "쓰는 곳 없이 지우기" | 10.11b | `AlertDialog`, 목록 없음 | Controls/Overlay/AlertDialog |
| "키 넣기" | 10.12 | 플러그인 자리의 "키 넣기"를 눌러 서비스가 정해진 키 창(서비스는 글) | Controls/Overlay/Dialog, Controls/Field/SecretInput |
| "키 넣음" | 10.12b | 플러그인 자리 이름 뒤 "··· 4410", 줄 끝이 "키 넣기"에서 ⋯("편집" · "지우기")로 바뀜, `toast` "바른 맞춤법에 키를 넣었습니다". "AI 키" 표는 그대로 | Controls/Status/Toast |
| "모델 고르기" | 10.13 | `ModelMenu layout="field"`가 열림 | Controls/Menu/ModelMenu |
| "모델 바뀜" | 10.13b | 빠른 작업 값 "gpt-5-mini · OpenAI 회사", `toast` "빠른 작업 모델을 바꿨습니다" | Controls/Status/Toast |
| "읽을 수 없음" | 10.14 | `Banner` "키 3개를 읽을 수 없습니다", 행마다 둘째 줄이 빨간 "읽을 수 없음" | Patterns/Frame/Banner |
| "다시 넣기" | 10.14b | 편집 창: 키가 처음부터 `SecretInput`(포커스. 모든 칸이 필수인 창이라 별표는 없다), `FormFieldDescription` "키를 다시 넣어 주세요." 비우고 저장하면 "이 칸을 채워 주세요." | Controls/Field/SecretInput, Controls/Field/Field |
| "비밀값 없음" | 10.15 | `Banner` "키를 저장할 수 없습니다" 하나가 이유를 말한다. "+ 키 추가", "모델" 묶음, 플러그인 키의 빈 자리는 숨는다(키가 든 자리는 남아 ⋯에 "지우기"만 있다). 키가 하나도 없으면 띠만 있고 목록 자리는 비어 있다(빈 목록의 한 줄도 없다). 전에 넣은 키가 있으면 "읽을 수 없음"으로 보이고 ⋯에는 "지우기"만 있다 | Patterns/Frame/Banner |
