# 도구 (Templates, TemplateEditor, Data, ApiKeys, Events)

도구 화면 넷(템플릿, 데이터, 활동 기록, API 키)은 같은 틀을 쓴다. 템플릿 편집기는 도구 틀 밖의 따로 된 페이지다.

## 도구 틀 (네 화면 공통)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 사이드바 | 공통 틀([common.md](common.md)), 현재 위치 "도구" |  |
| 페이지 단 | `PageColumn` | 템플릿, 데이터, API 키는 `width="content"`, 활동 기록은 `width="list"`. |
| 제목 행 "도구" | `PageHeader` | 템플릿과 API 키 화면만 검은 알약 하나("+ 템플릿 추가", "+ 키 추가"). 데이터와 활동 기록은 머리에 알약이 없다. |
| 탭 "템플릿 · 데이터 · 활동 기록 · API 키" | `PageToolbar` 안의 `TabLinks` + `TabLink` | 탭 하나가 페이지 하나다. 도구가 템플릿 하나뿐인 동안에는 탭 줄이 없다(설정의 탭 줄과 같다). 탭에 붙는 개수는 실패한 전송 수(`TabLink count`, `countTone="warning"`, "활동 기록 1")뿐이다. 열면 다 보이는 목록의 개수(템플릿 수)는 붙이지 않는다(원칙 8, 2026-11-05 소유자). 플러그인이 더한 도구 페이지도 탭이 된다. |
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
- 공통 틀: 사이드바와 도구 틀이 없는 따로 된 페이지다. 본문(블록 손잡이, 블록 메뉴, "/" 메뉴, 서식 카드)은 [editor.md](editor.md)의 글 단과 같다. 알림 띠는 [common.md](common.md).

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 머리 줄 | 높이 `height-header`, 아래 가는 선 하나 | 편집기 머리와 같은 줄이다. |
| "‹ 템플릿" | `TextButton variant="quiet"`(앞 아이콘, 템플릿 목록으로) | |
| "저장 안 됨" | `EntryStatus status="editing"` | 바뀐 것이 있는 동안만. |
| "저장" | `Button variant="primary"`(저장하는 동안 `loading`) | 늘 있다. 발행이 없으므로 이 페이지의 검은 알약 하나다. 보드의 "⌘S"는 [button.md](../components/button.md)를 따라 뺀다. |
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
| 저장하지 않은 편집 | `Banner`(`title` "이 브라우저에 저장하지 않은 편집이 있습니다"), 끝에 `TextButton` "불러오기" · `TextButton variant="quiet"` "버리기" | 화면 맨 위(머리 줄보다 위). 저장하지 않고 닫은 편집이 이 브라우저에 남아 있을 때만. 글 편집기와 같은 임시 저장(`useEntryEditor`)이다. 템플릿에는 비교 화면이 없다. |
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
| "마지막 백업 10. 20" | `Text variant="note" tone="subtle"`, 날짜는 `mono` | 알약 옆. 없으면 "없음". |

스토리: Patterns/Frame/Section, Controls/Button/Button, Primitives/Text, Controls/Choice/Option, Controls/Choice/Checkbox, Controls/Field/Input, Controls/Overlay/Sheet, Controls/Field/Field, Patterns/List/MapRow, Controls/Field/Select, Controls/Choice/Segmented, Controls/Choice/Switch, Controls/Button/TextButton, Patterns/Frame/DescriptionList.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 가져오기 · 복원 시트

> 바뀜 (2026-11-05, 소유자): 가져오기는 도구 › 데이터가 아니라 컬렉션 목록의 "+ 새 글 쓰기 ▾" 메뉴 › "가져오기"에서 그 컬렉션 하나에 한다. 들어갈 곳을 고르는 단계가 없다. `.md`, `.mdx`는 MDX 플러그인이 있을 때만 받는다. 도구 › 데이터에는 백업 받기만 남는다. [기능 설계 14](../../features/14-data-keys-plugins.md#가져오기) 참고. 이 시트는 목록에서 열리고, "들어갈 곳" 칸이 없다.

> 빠짐 (2026-11-05, 소유자): 통째로 되살리기는 관리자 화면에서 빠지고 `monti restore` 명령이 한다. 화면은 백업 받기와 가져오기만 있다. [기능 설계 14](../../features/14-data-keys-plugins.md#통째로-되살리기) 참고. 아래의 복원 행과 상태는 빠진다.

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetContent`, `SheetHeader`, `SheetBody`, `SheetFooter`) | 일하는 동안(가져오는 중, 복원 중) `SheetHeader closable={false}`. |
| 제목 | `SheetTitle of`(파일 이름, `ofMono`) | "가져오기 · blog-export.zip", "있던 그대로 복원 · monti-backup-1020.zip". |
| 찾은 것 요약 | `Text`("글 24편을 찾았습니다"), 그 아래 `Text variant="note" tone="subtle"` | 건너뛰기와 -2 규칙을 한 줄로. |
| "들어갈 곳" | `FormField` + `FormFieldLabel`, 행은 `MapRow`(`name` "posts/", `example` "24편", 자식 `Select`) | 폴더마다 어느 컬렉션으로 갈지. |
| "필드 맞추기 · 게시글" | `FormField` + `MapRow` 여럿(`name` 파일의 키, `example` 예시 값, `warning` "새 태그 4개가 생겨요", 가져오지 않는 키는 `off`, 자식 `Select`) | 어시스턴트가 맞춘 선택은 `Select`의 `proposal`(파랑). 고르면 보통 색. |
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
| "백업 받음" | 9.03 | `toast` "백업을 저장했습니다", 마지막 백업 "오늘 09:12" | Controls/Status/Toast |
| "가져오기" | 9.06 | 시트: 요약, "들어갈 곳", "필드 맞추기" |  |
| "가져오기 아래" | 9.07 | 시트 아래쪽: "발행", "이미지", "알아 두세요" |  |
| "가져오는 중" | 9.08 | 시트 `SheetHeader closable={false}`, 알약 `loading` "가져오는 중 12/21" |  |
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
| "+ 키 추가" | `Button variant="primary"`(앞 아이콘 +) | 서비스 고르기 창을 연다. 서버 비밀값이 없으면 숨는다. 키를 저장할 수 없는 이유는 알림 띠 하나가 말한다(원칙 7). |
| 알림 띠 | `Banner`(`title` "키 3개를 읽을 수 없습니다" 또는 "키를 저장할 수 없습니다", 문장 안의 `MONTI_SECRET`은 `mono`) | 목록 바로 위, 단 안에 둔다. |
| 표 묶음 "AI 키" · "모델" · "플러그인 키" | `ListSection`(`title`, 개수 없음) | "AI 키"는 AI 서비스 키(모델 목록이 여기서 나온다), "모델"은 빠른 작업 모델 한 줄, "플러그인 키"는 플러그인이 둔 키 자리마다 한 줄이다(2026-11-05 소유자: 한 표에 고르기, 입력 칸, 글자 버튼이 섞이지 않게 고르는 줄과 키 줄을 나눈다). 행이 다 보이므로 개수를 붙이지 않는다. 묶음은 자기 바깥 여백이 없다. 페이지가 `Stack gap={40} paddingTop={32}`로 띄운다(첫 표는 도구 줄 아래 32, 다음은 40). |
| AI 키 한 행 | `ListSectionRow`(`title` 키 이름, `titleCount` "··· a1b2", `meta` 사용량 "이번 달 1.24M 토큰", 쓰지 않았으면 `metaTone="faint"`, 읽을 수 없으면 `metaTone="danger"` "읽을 수 없음"), `actions`에 "편집" `TextButton variant="underline"`과 "지우기" `TextButton variant="quiet"` | 행이 없으면 "없음" 한 줄을 흐리게. 키 값은 끝 네 글자만 보인다. |
| "빠른 작업" 모델 | `ListSectionRow`(`title` "빠른 작업", `meta` 쓰는 곳), `control`에 `MenuField`(`value` 모델 `mono`, `meta` 키 이름)를 트리거로 둔 `ModelMenu layout="field"` | 열면 검색 행과 키별 묶음, 지금 모델에 ✓. 고르면 바로 적용하고 토스트. "최근" 묶음과 생각 행은 없다. 키가 하나도 없으면 `MenuField placeholder="키 없음"`이고, 누르면 "키 추가" 창(서비스 고르기)이 열린다. 서버 비밀값이 없으면 행이 숨는다. 모델이 많아 검색이 먼저인 메뉴로 고른다. |
| 플러그인 키 자리 | `ListSectionRow`(`title` 플러그인 이름, 자리가 여럿이면 `detail` "검색 키", 키가 있으면 `titleCount` "··· 4410", `meta` 플러그인 코드 `metaTone="subtle"`), `actions`는 키가 있으면 AI 키 줄과 같은 "편집" · "지우기", 없으면 "키 넣기" 하나 | 키 줄은 모두 같은 모양, 같은 방법이다. "키 넣기"와 "편집"은 같은 키 창을 열고, 플러그인 자리의 창은 서비스가 정해져 있다(서비스는 글). 자리 하나는 한 서비스의 것이라 저장된 키를 고르지 않는다(2026-11-05 소유자). 키가 없어도 행을 흐리게 하지 않는다. "키 넣기"가 말한다. 서버 비밀값이 없으면 자리들이 숨는다. |

스토리: Controls/Button/Button, Patterns/Frame/Banner, Patterns/List/ListSection, Controls/Button/TextButton, Controls/Menu/ModelMenu, Controls/Overlay/Dialog, Controls/Menu/PickList, Controls/Overlay/DialogFormFooter, Controls/Field/Field, Controls/Field/Select, Primitives/Text, Controls/Field/Input, Controls/Field/SecretInput, Controls/Overlay/AlertDialog, Patterns/Frame/DescriptionList.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 서비스 고르기 "키 추가" | `Dialog`(`DialogContent`, `DialogHeader`, `DialogTitle`), 목록 `PickList`(`aria-label` "서비스") 안에 `PickListLabel` "AI" · "플러그인", `PickListItem`(덧말은 `mark`: "Ollama", "bareun"), 묶음 사이 `PickListSeparator`. 발은 `DialogFooter`에 "취소" `TextButton` | 서비스를 고르면 바로 키 입력 창이 된다. 알약이 없다. |
| 키 추가 · 편집 창 | `Dialog` + `DialogFormFooter`(`submitLabel` "추가" 또는 "저장", 확인하는 동안 `busy`와 `busyLabel` "확인하는 중…") | 포커스는 첫 텍스트 필드로 간다. 편집 창의 제목은 `DialogTitle of`("편집 · Anthropic 개인"). |
| "서비스" | 추가 창은 `FormField` + `Select`, 편집 창과 플러그인 자리의 창은 `FormField`에 글로만 `Text` |  |
| "주소" (OpenAI 호환) | `FormField` + `FormFieldLabel required` + `Input mono` |  |
| "이름" | `FormField` + `FormFieldLabel required` + `Input` | 서비스 이름으로 채워진다. 같은 이름이 있으면 "Anthropic 2"로 채우고 아래 `FormFieldDescription` "이름이 Anthropic인 키가 이미 있어요." |
| "키" (새 값) | `FormField` + `FormFieldLabel`(호환 주소와 편집이 아니면 `required`) + `SecretInput` | 눈 버튼으로 보이고 가린다. 거절되면 `aria-invalid`와 `FormFieldError` "맞지 않는 키입니다." 호환 주소는 플레이스홀더 "없음". 값을 지우려면 필드를 비운다. |
| "키" (저장된 값, 편집) | `SavedValue`(`··· a1b2`, `action` "바꾸기") | "바꾸기"를 누르면 그 자리가 `SecretInput keep`(끝에 "그대로")이 된다. 높이가 같아 아래가 움직이지 않는다. 읽을 수 없는 키는 처음부터 `SecretInput`이고 아래 `FormFieldDescription` "키를 다시 넣어 주세요." |
| 지우기 확인 | `AlertDialog`(`AlertDialogTitle` "Anthropic 개인을 지울까요?", `AlertDialogDescription` "되돌릴 수 없습니다. …"), 쓰는 곳은 `DescriptionList` + `DescriptionItem`(모델 `mono`), `AlertDialogCancel` "취소", `AlertDialogAction` `Button variant="danger"` "지우기" | 쓰는 곳이 없으면 목록 없이 "되돌릴 수 없습니다." 한 줄. |

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
| "추가됨" | 10.06 | 새 `ListSectionRow`, `toast` "키를 추가했습니다" | Patterns/List/ListSection, Controls/Status/Toast |
| "편집" | 10.07 | 편집 창: 서비스는 글, 키는 `SavedValue` | Controls/Field/SecretInput |
| "편집 키 열기" | 10.08 | 키 자리가 `SecretInput keep`("그대로") | Controls/Field/SecretInput |
| "편집 확인 중" | 10.09 | `SecretInput keep`, `DialogFormFooter busy` | Controls/Field/SecretInput, Controls/Overlay/DialogFormFooter |
| "편집 저장됨" | 10.10 | 행의 끝 네 글자 "7c0e", `toast` "저장했습니다" | Controls/Status/Toast |
| "지우기 확인" | 10.11 | `AlertDialog`와 쓰는 곳 `DescriptionList` | Controls/Overlay/AlertDialog, Patterns/Frame/DescriptionList |
| "쓰는 곳 없이 지우기" | 10.11b | `AlertDialog`, 목록 없음 | Controls/Overlay/AlertDialog |
| "키 넣기" | 10.12 | 플러그인 자리의 "키 넣기"를 눌러 서비스가 정해진 키 창(서비스는 글) | Controls/Overlay/Dialog, Controls/Field/SecretInput |
| "키 넣음" | 10.12b | 플러그인 자리 이름 뒤 "··· 4410"과 "편집" · "지우기", `toast` "바른 맞춤법에 키를 넣었습니다". "AI 키" 표는 그대로 | Controls/Status/Toast |
| "모델 고르기" | 10.13 | `ModelMenu layout="field"`가 열림 | Controls/Menu/ModelMenu |
| "모델 바뀜" | 10.13b | 빠른 작업 값 "gpt-5-mini · OpenAI 회사", `toast` "빠른 작업 모델을 바꿨습니다" | Controls/Status/Toast |
| "읽을 수 없음" | 10.14 | `Banner` "키 3개를 읽을 수 없습니다", 행마다 `metaTone="danger"` "읽을 수 없음" | Patterns/Frame/Banner |
| "다시 넣기" | 10.14b | 편집 창: 키가 처음부터 `SecretInput`(포커스, `required`), `FormFieldDescription` "키를 다시 넣어 주세요." | Controls/Field/SecretInput, Controls/Field/Field |
| "비밀값 없음" | 10.15 | `Banner` "키를 저장할 수 없습니다" 하나가 이유를 말한다. "+ 키 추가", 빠른 작업 행, 플러그인 키 표는 숨고, "AI 키"는 "없음" | Patterns/Frame/Banner, Controls/Menu/ModelMenu |

## 활동 기록 (Events)

- 보드: `Events.dc.html`. 상태와 흐름: [screens.md › Events](../screens.md#events), [흐름 12](../flows/12-activity-log.md).
- 공통 틀: 도구 틀, 사이드 패널, 확인 질문, 알림 띠, 토스트, 메뉴.

### 기본 틀

#### 목록

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 걸린 필터 | `Chip`(`onRemove`, `removeLabel` "필터 지우기"): "글: 첫 번째 글", "전송: 실패" | 탭 줄 오른쪽(`PageToolbarEnd`). ×로 그 필터만 뺀다. |
| "종류 ▾" | `FilterButton`(값이 있으면 `filled`, "종류: AI 제안") + `DropdownMenu`: 종류마다 `DropdownMenuRadioItem`(앞 아이콘, AI 제안은 `Spark`), 구분선, "전송" `DropdownMenuSub`("대기" · "보냄" · "실패" · "취소됨", 끝에 개수 `MenuShortcut`) | 전송 값을 고르면 `Chip`이 된다. 보드의 행 메뉴 카드(`.mt-menu--ctx`)는 필터 버튼이 여는 메뉴이므로 `DropdownMenu`로 그린다. |
| 실패 알림 | `Banner tone="danger"`(`title` "전송 실패 N건", `meta` 날짜), 끝에 "보기" `TextButton variant="underline"`(실패 필터가 이미 걸렸으면 없다)과 "모두 다시 보내기" `TextButton` | 실패가 둘 이상일 때만 목록 바로 위, 단 안에 뜬다. 실패 하나는 그 행이 상태와 "다시 보내기"로 말하므로 띠를 두지 않는다(원칙 8, 2026-11-05 소유자). 보내는 동안 "모두 다시 보내기"는 `TextButton loading` "보내는 중…"이고 다시 누를 수 없다. 실패는 빨강이다. |
| 날짜 묶음 "오늘 · 10. 26" | `Text variant="meta" tone="subtle"`, 표 안쪽 12px에 맞춘다 |  |
| 목록 | `Table` + `TableBody` + `TableRow` + `TableCell`, 아래 `ListFooter`와 `Pagination` | 행 어디를 눌러도 자세히 패널이 열린다(`RowLink`). 열린 행은 `selected`. |
| 시각 | `TableCell` 안 `Count` |  |
| 무엇 · 어디 | `Text`(잉크) 두 줄: 무엇 "“더 짧게 다듬어 줘…”", 아래 `Text variant="meta" tone="subtle" truncate` 어디서 "첫 번째 글 · 본문 5곳". AI 제안은 앞에 `Text tone="proposal"` 안의 `Icon icon={Spark}` | 아래 줄은 일이 일어난 곳만 말한다. ✦가 말하는 "어시스턴트 제안", 제목이 말하는 "글 발행" · "글 저장"은 되풀이하지 않는다(원칙 8). |
| 끝 동작 | AI 제안: "대화" `TextButton variant="quiet" size="note"`(`href`), "되돌리기" `TextButton variant="underline" size="note"`. 결과 글 "되돌림 · 10:44" `Text variant="note" tone="subtle"`. 실패한 전송: 빨간 상태 하나 `EntryStatus status="failed"` "3번 실패", "다시 보내기" `TextButton variant="underline" size="note"`. 기다리는 전송: `Text variant="note"` "보내는 중". | 한 행에 할 수 있는 것만 보인다. |
| 빈 목록 | 한 줄 `Text tone="subtle"`("실패한 전송이 없습니다", "아직 기록이 없습니다"), 거른 결과가 비었으면 뒤에 "필터 끄기" `TextButton variant="underline" size="note"` | 할 일이 없으므로 한 줄로 충분하다. |

스토리: Patterns/Frame/PageHeader, Patterns/List/FilterButton, Controls/Menu/DropdownMenu, Primitives/AI mark, Patterns/Frame/Banner, Controls/Button/TextButton, Primitives/Text, Patterns/List/Table, Patterns/List/Pagination, Controls/Status/Count, Primitives/Icon, Controls/Status/EntryStatus, Controls/Overlay/SidePanel, Patterns/Frame/DescriptionList, Controls/Button/Button, Controls/Overlay/AlertDialog.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 자세히 패널과 창

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 자세히 패널 | `SidePanel width="side"`(`title` "\"첫 번째 글\" 발행", 머리 끝 닫기) | 목록 옆에 붙고 ✦ 버튼을 가린다. 목록을 보면서 쓰므로 시트가 아니라 사이드 패널이다. |
| 묶음 "이벤트" · "항목" · "전송 · 2" | `Heading variant="label"`, 그 아래 `DescriptionList` + `DescriptionItem`("언제", "한 사람", "ID", "글", "컬렉션", "언어", "주소", "받는 곳", "상태", "시도 횟수", "마지막 오류") | 글 이름은 `TextButton variant="underline"`(`href`), 시각 · ID · 주소 · 오류는 `mono`. 전송 상태는 `EntryStatus`(`failed` "실패", `published` "보냄"). |
| 전송 동작 | "다시 보내기" `TextButton variant="underline"`, "취소" `TextButton variant="quiet"` | 받는 곳마다 그 아래. |
| 가져오기 자세히 | `SidePanel width="side"`(`title` "blog-export.zip 가져옴"), `DescriptionList`, "주소를 바꾼 글 · 2"(데이터와 같은 `ChangeLines`), `footer`에 "되돌리기" `TextButton`과 "목록에서 보기" `Button variant="primary"`(`href`) |  |
| 전송 취소 확인 | `AlertDialog`(`AlertDialogTitle` "이 전송을 취소할까요?", `AlertDialogDescription`의 받는 곳 `mono`), `AlertDialogCancel` "닫기", `AlertDialogAction` `Button variant="danger"` "취소하기" | 버튼 이름이 하는 일을 말한다("닫기" · "취소하기"). |

### 흐름 2 · 어시스턴트

단계: 2.17, 2.18. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "기본" | 2.17, 2.18 | 거르지 않은 목록, 실패한 행 하나(띠 없음), 탭 "활동 기록 1" |  |
| `filter` "전체" · "전송 실패" · "글 하나" | 2.17, 2.18 | "전송 실패"는 "실패만"과 같다. "글 하나"는 `Chip` "글: 첫 번째 글", `FilterButton filled` "종류: AI 제안" | Patterns/List/FilterButton |

### 흐름 9 · 데이터

단계: 9.10. 단계마다 보이는 것은 [flows/09-data.md](../flows/09-data.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "기본" | 9.10 | 거르지 않은 목록, 실패한 행 하나(띠 없음), 탭 "활동 기록 1" |  |
| `filter` "전체" · "전송 실패" · "글 하나" | 9.10 | "전송 실패"는 "실패만"과 같다. "글 하나"는 `Chip` "글: 첫 번째 글", `FilterButton filled` "종류: AI 제안" | Patterns/List/FilterButton |
| `withImport` · `importDetail` | 9.10 | 가져오기 행, 가져오기 자세히 `SidePanel` | Controls/Overlay/SidePanel |

### 흐름 12 · 활동 기록

단계: 12.01, 12.01b, 12.02, 12.02b, 12.03, 12.04, 12.04b, 12.05, 12.06, 12.07, 12.08, 12.09, 12.09b, 12.10, 12.11. 단계마다 보이는 것은 [flows/12-activity-log.md](../flows/12-activity-log.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "실패만" | 12.01b | `Chip` "전송: 실패", 실패한 행만 |  |
| "다시 보내는 중" | 12.02 | 그 행의 "다시 보내기"가 "보내는 중…"(다시 누를 수 없음) |  |
| "다시 보냄" | 12.02b | 빈 목록 "실패한 전송이 없습니다" + "필터 끄기", `toast` "보냈습니다", 알림 없음 | Controls/Status/Toast |
| "자세히" | 12.03 | 자세히 `SidePanel`(이벤트 · 항목 · 전송 · 2), 그 행 `selected`, ✦ 가려짐 | Controls/Overlay/SidePanel |
| "취소 확인" | 12.04 | 자세히 패널 위 `AlertDialog` | Controls/Overlay/AlertDialog |
| "취소됨" | 12.04b | 그 행의 결과 "취소됨"(흐림), `toast` "전송을 취소했습니다" | Controls/Status/Toast |
| "실패 알림" | 12.01 | 실패한 행 하나: `EntryStatus` "3번 실패"와 "다시 보내기". 띠는 없다(실패가 하나라서) |  |
| "실패 3건" | 12.05 | 실패한 행 셋(각 "N번 실패"), `Banner` "전송 실패 3건", 탭 개수 3 | Patterns/Frame/Banner |
| "모두 보내는 중" | 12.06 | `Banner`의 "모두 다시 보내기"와 실패한 행들이 "보내는 중…" | Patterns/Frame/Banner |
| "모두 보냄" | 12.07 | 알림 없음, `toast` "3건 보냈습니다" | Controls/Status/Toast |
| "일부 실패" | 12.08 | 남은 실패 행 하나 "1번 실패"(띠는 사라진다), `toast` "2건 보냈습니다 · 1건 실패" | Controls/Status/Toast |
| "필터 메뉴" | 12.09 | "종류" `DropdownMenu`와 "전송" `DropdownMenuSub`가 열림 | Controls/Menu/DropdownMenu |
| "필터 걸림" | 12.09b | `Chip` "전송: 대기", 기다리는 행만 |  |
| "구독자 없음" | 12.10 | 전송 열이 없는 행들(기록만), 알림 없음 |  |
| "비어 있음" | 12.11 | 빈 목록 "아직 기록이 없습니다" |  |
| `filter` "전체" · "전송 실패" · "글 하나" | 12.01, 12.01b, 12.02, 12.02b, 12.03, 12.04, 12.04b, 12.05, 12.06, 12.07, 12.08, 12.09, 12.09b, 12.10, 12.11 | "전송 실패"는 "실패만"과 같다. "글 하나"는 `Chip` "글: 첫 번째 글", `FilterButton filled` "종류: AI 제안" | Patterns/List/FilterButton |

