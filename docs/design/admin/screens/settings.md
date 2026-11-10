# 설정

설정의 네 탭 중 사이트, 언어, 관리자와 어시스턴트 제안이 든 사이트 화면이다. 컬렉션 탭은 [collections.md](collections.md)에 있다.

## 설정 · 사이트 (Settings)

- 보드: `Settings.dc.html`. 상태와 흐름 단계: [screens.md › Settings](../screens.md#settings), 흐름 [11](../flows/11-settings.md).
- 공통 틀: [common.md](common.md)의 사이드바, `PageColumn width="content"`, 제목 행 `PageHeader`("설정"), 제목 아래 탭 `TabLinks`(사이트 · 언어 · 컬렉션 · 관리자), 설정 한 절 `Section`, 저장 묶음 `ChangesGroup`, ✦ 어시스턴트 열기, 확인 질문, 시트.

### 기본 틀

#### 머리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 저장 묶음 | `ChangesGroup`(`PageHeader`의 `children`) | 바뀐 곳이 있을 때만 보인다. 알약 라벨은 사이트 종류를 따른다: 개발 서버 "저장하고 적용", 운영 환경에서 데이터베이스 설정만 바뀌면 "저장", 파일 설정이 섞이면 "PR 만들기". 칸에 오류가 있어도 알약은 흐리지 않는다. 누르면 저장하지 않고 오류가 있는 첫 칸으로 포커스를 옮겨 그 오류 줄을 보인다(고칠 곳, 원칙 7). |
| 다른 탭의 바뀜 점 | `TabLink`의 `dot` | 저장하지 않은 것이 있는 다른 탭(언어, 관리자)에만 이름 뒤에 점. 열린 탭에는 붙이지 않는다(그 바뀐 곳은 이 페이지와 저장 묶음에 있다). |

#### 이름과 링크

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 절 | `Section`("이름과 링크") | |
| 사이트 이름 | `FormField` + `FormFieldLabel` + `Input` | 처음부터 입력 칸이다. 저장된 값과 다르면 `FormFieldLabel changed`(점과 "되돌리기"). |
| 홈 링크 | `FormField` + `Input mono` | 틀리면 `aria-invalid`와 `FormFieldError` 한 줄("/로 시작하거나 https://로 시작해야 해요."). |
| 다른 호스트 이름 | `FormFieldGroup` 안에 줄마다 `Input mono`와 빼기 `TextButton variant="quiet"`("×", `aria-label` "… 빼기") | 줄 하나가 호스트 하나다. 끝의 `TextButton` "+ 호스트"가 빈 줄을 더하고 커서를 그 줄에 둔다. |

#### 글 쓰는 방식

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 말투와 규칙 | `FormField` + `Textarea` | 데이터베이스에 저장되는 관리자 설정이라 운영 환경에서도 늘 고칠 수 있다. 바뀌면 `FormFieldLabel changed`. |

#### 미리보기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 미리보기 경로 | `FormField` + `Affix`(`prefix` "/", mono) | 바꿀 수 있는 부분만 밑줄. 바뀌면 `FormFieldLabel changed`. |
| 미리보기 경로에 언어 넣기 | `Option spread height="lg"` + `Switch` | 끄면 아래에 "미리보기 언어 쿼리" `FormField` + `Input mono`(플레이스홀더 "locale")가 생긴다. 바뀐 스위치는 라벨 뒤 `ChangeDot`. 줄은 옆 입력 칸과 같은 36px(`lg`)로 선다(원칙 10). |
| 잠긴 미리보기 (읽기 전용) | 줄마다 라벨 뒤 `LockMark`, 경로는 `Text mono`, 스위치 자리는 글 `Text` "켜짐" · "꺼짐" | 구조라서 값은 글로 보이고, 자물쇠는 잠긴 줄마다 붙는다(원칙 9). 흐린 스위치는 두지 않는다(원칙 7, 2026-11-05 소유자). |

#### 공개 주소

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 주소에 언어 표시 | `FormField` + `Select`(`SelectTrigger width="full"`) | 읽기 전용이면 라벨 뒤 `LockMark`와 값 글(`Text`). |
| 사이트 URL | `FormField`의 라벨과 `Text`(`SITE_URL`은 `Text mono`) | 배포하는 곳에서 넣는 값의 상태 한 줄. |

스토리: Monti/Change/ChangesGroup, Patterns/Frame/PageHeader, Controls/Tabs/Tabs, Patterns/Frame/Section, Controls/Field/Field, Controls/Field/Input, Controls/Button/TextButton, Controls/Field/Textarea, Controls/Field/Affix, Controls/Choice/Option, Controls/Choice/Switch, Controls/Status/ChangeDot, Primitives/LockMark, Primitives/Text, Controls/Field/Select, Controls/Overlay/AlertDialog, Controls/Overlay/Sheet, Monti/Change/ChangeGroup, Monti/Change/Patch.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 뜨는 면

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 나가기 확인 | `AlertDialog`: `AlertDialogTitle` "저장하지 않은 변경 사항이 있습니다", `AlertDialogDescription`, `AlertDialogCancel variant="danger"` "저장하지 않고 나가기", `AlertDialogAction` "계속 고치기" | 바뀐 곳이 있는 채 다른 곳으로 갈 때 묻는다. |
| 운영 검토 (빠짐, 2026-11-05) | `Sheet`(`SheetTitle` "검토", `of` "사이트 · 변경 사항 3"): 가는 곳마다 `ListSection flush`("바로 저장" 2, "PR" 1), 그 안에 변경마다 `ChangeGroup kind="edit"`(값은 전·후, [change.md](../components/change.md)), 파일 변경은 `Patch`(`file` "monti.schema.ts"), 발은 "취소" · "PR 만들기" | 바로 저장되는 것과 PR로 가는 것을 나눠 보인다. |

### 흐름 2 · 어시스턴트

단계: 2.20. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "기본" | 2.20 | 변경 사항 2: 사이트 이름 `FormFieldLabel changed`, 저장 묶음 | Controls/Field/Field |

### 흐름 11 · 설정

단계: 11.01, 11.02, 11.03, 11.04, 11.09, 11.13, 11.15, 11.15b. 단계마다 보이는 것은 [flows/11-settings.md](../flows/11-settings.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "호스트 추가" | 11.01 | 다른 호스트 이름에 빈 `Input mono` 줄 하나(플레이스홀더 "blog.example.dev") | Controls/Field/Input |
| "언어 쿼리" | 11.02 | 언어 넣기 `Switch` 꺼짐과 `ChangeDot`, "미리보기 언어 쿼리" `Input mono` | Controls/Choice/Switch, Controls/Status/ChangeDot, Controls/Field/Input |
| "칸 오류" | 11.03 | 홈 링크 `Input aria-invalid`와 `FormFieldError`, 저장 알약은 누를 수 있고 누르면 홈 링크로 포커스가 간다. screens.md는 호스트 이름 행의 오류라고 적지만 보드는 홈 링크에 그린다 | Controls/Field/Input, Controls/Field/Field |
| "나가기 확인" | 11.04 | 나가기 `AlertDialog` | Controls/Overlay/AlertDialog |
| "운영 글 쓰는 방식" | 11.09 | 말투와 규칙 `FormFieldLabel changed`, 알약 "저장" | Controls/Field/Field |
| "운영 검토" (빠짐, 2026-11-05) | 11.13 | 운영 검토 `Sheet`(바로 저장 2 · PR 1과 `Patch`), ✦ 버튼은 시트에 가려진다 | Controls/Overlay/Sheet, Patterns/List/ListSection › ReviewSheet, Monti/Change/Patch |
| "읽기 전용" | 11.15 | 미리보기와 공개 주소의 잠긴 줄마다 라벨 뒤 `LockMark`, 그 값은 글, 스위치 자리는 "켜짐", 저장 묶음 없음. screens.md는 공개 주소만 잠긴다고 적지만 보드는 미리보기도 잠근다 | Primitives/LockMark |
| "읽기 전용 저장" | 11.15b | "읽기 전용"에 더해 사이트 이름 `FormFieldLabel changed`와 알약 "저장" | Controls/Field/Field |

## 설정 · 언어 (Locales)

- 보드: `Locales.dc.html`. 상태와 흐름 단계: [screens.md › Locales](../screens.md#locales), 흐름 [11](../flows/11-settings.md).
- 공통 틀: 설정 · 사이트와 같다(`PageHeader`, `TabLinks`, `Section`, `ChangesGroup`, 시트, 작은 폼 창).

### 기본 틀

#### 콘텐츠 언어

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 절 | `Section`("콘텐츠 언어") | 읽기 전용이면 언어 행마다(원어 이름 뒤) `LockMark`. |
| 언어 행 | `LanguageRow`(`name` 원어 이름, `code`, `label` 표시 이름, 바뀐 행은 `dot`, 뺄 행은 `gone`) | 이름은 언어 코드에서 오는 글이다. 다른 행은 끌기 손잡이(`handle`에 `DragHandle`)로 순서를 바꾼다. |
| 원문 행의 "원문 │ 바꾸기" | `LanguageSource` | 굵은 "원문", 구분선, 조용한 밑줄 버튼 "바꾸기". "바꾸기"는 `DropdownMenu`(`DropdownMenuRadioGroup`, 지금 원문에 ✓)를 연다. 고르면 그 언어가 맨 위로 가고 두 행에 바뀜 점이 붙는다. 원문 행은 손잡이 자리를 비운다. |
| 다른 행의 × | `TextButton variant="quiet"`(`aria-label` "… 빼기") | 누르면 행에 취소선(`gone`)을 긋고 변경 사항에 더한다. 번역이 있는 언어는 저장 때 검토에서 처리를 고른다. |
| "+ 언어 추가" | `TextButton` + `Popover`(`PopoverContent padding="menu"`) 안의 `Command`(`shouldFilter={false}`, `CommandInput`, `CommandList`, `CommandItem` 코드 mono · 원어 이름 · 끝에 표시 이름, `CommandSeparator`, 마지막 "직접 입력") | 코드를 고르면 그 자리에서 행이 생긴다. "직접 입력"은 창을 연다. |
| 직접 입력 창 | `Dialog`(`DialogTitle` "새 언어", `of` 코드): "코드" `Text mono`, "원어 이름" `Input`, "표시 이름" `Input`, `DialogFormFooter`("취소" · "추가") | 420px 작은 창. 포커스는 원어 이름으로 간다. |

#### 시간대

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시간대 | `Combobox`(`ComboboxInput`, mono 값, `aria-label` "시간대") | 절 제목 "시간대"가 이름이라 위에 같은 라벨을 다시 두지 않는다(원칙 8). 항목이 많아 검색해서 고른다([field.md](../components/field.md) "선택"). 보드는 닫힌 선택 칸만 그린다. 관리자 설정이라 읽기 전용에서도 고칠 수 있다. |

스토리: Patterns/Frame/Section, Primitives/LockMark, Patterns/List/LanguageRow, Controls/Button/DragHandle, Controls/Menu/DropdownMenu, Controls/Button/TextButton, Controls/Overlay/Popover, Controls/Menu/Command, Controls/Overlay/Dialog, Primitives/Text, Controls/Field/Input, Controls/Overlay/DialogFormFooter, Controls/Field/Field, Controls/Field/Combobox, Controls/Overlay/Sheet, Monti/Change/ChangeGroup, Controls/Choice/Radio.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 뜨는 면

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 빼기 검토 | `Sheet`(`SheetTitle` "검토", `of` "언어 · 변경 사항 1"): `ChangeGroup kind="drop"`(`tag` "뺌", `title` "English", `identifier` "en") 안에 `ChangeNote` "번역이 함께 지워집니다.", 발은 "취소" · 빨간 "지우고 적용"(2026-11-05 바뀜) | 번역이 있는 언어를 뺀 채 저장하면 열린다. |

### 흐름 11 · 설정

단계: 11.05, 11.06, 11.06b, 11.07, 11.07b, 11.08, 11.16. 단계마다 보이는 것은 [flows/11-settings.md](../flows/11-settings.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "언어 찾기" | 11.05 | "+ 언어 추가"의 `Command` 팝오버, 검색어 "zh" | Controls/Menu/Command |
| "직접 입력" | 11.06b | 직접 입력 `Dialog` | Controls/Overlay/Dialog |
| "언어 추가됨" | 11.06 | 日本語 행이 `dot`("추가")과 함께 생김, 탭 `dot`, 저장 묶음 |  |
| "원문 메뉴" | 11.07 | "바꾸기"의 `DropdownMenu`(지금 원문 ✓) | Controls/Menu/DropdownMenu |
| "원문 바꿈" | 11.07b | English가 맨 위의 원문, 두 행에 `dot`("원문 변경"), 옛 원문 행에 손잡이와 × |  |
| "빼기 검토" | 11.08 | English 행 `gone`, 빼기 검토 `Sheet`, ✦ 버튼은 시트에 가려진다 | Controls/Overlay/Sheet |
| "읽기 전용" | 11.16 | 언어 행마다 `LockMark`. 손잡이, ×, 구분선, "바꾸기", "+ 언어 추가"가 빠지고 원문 행의 굵은 "원문"은 남는다. 시간대는 그대로 고칠 수 있다 | Primitives/LockMark |

## 설정 · 관리자 (AdminSettings)

- 보드: `AdminSettings.dc.html`. 상태와 흐름 단계: [screens.md › AdminSettings](../screens.md#adminsettings), 흐름 [11](../flows/11-settings.md).
- 공통 틀: 설정 · 사이트와 같다.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 언어 절 | `Section`("언어") | |
| 화면 언어 | `FormField` + `FormFieldLabel` "화면 언어" + `Select`(`SelectTrigger width="full"`, 항목은 언어 이름 뒤 흐린 코드 "ko") | 고르면 관리자 화면의 말이 바뀐다. 사이트 탭처럼 절 제목 아래 작은 라벨을 둔다. |
| 기능 절 | `Section`("기능") | |
| 본문 템플릿 · 번역 | 줄마다 `Option spread height="lg"` + `Switch`, 두 줄은 `Stack gap={4}` | 바로 적용되는 켜기/끄기. 한 묶음이라 같은 36px 줄에 4px 간격(원칙 10). |
| 주소 절 | `Section`("주소") | |
| 관리자 주소 | `FormField` + `FormFieldLabel` "관리자 주소" + `Affix`(`prefix` "/", 값 "studio") | 설정 파일에서 정하는 값이지만 미리보기 경로처럼 고칠 수 있다. 로컬 개발 모드에서는 바로 파일에 쓰고, 파일을 쓸 수 없는 곳(배포된 사이트)에서는 라벨 뒤 `LockMark`와 함께 글로 보인다. |
| 계정 절 | `Section`("계정") | 2026-11-05 소유자 결정으로 더해졌다. 보드에는 없다. |
| 로그인한 계정 | `ReadValue`(`label` "로그인한 계정", 이메일 또는 GitHub 아이디, mono) | 고칠 수 없는 값이다. |
| "로그아웃" | `TextButton` | 누르면 세션을 끝내고 로그인 화면으로 간다. 묻지 않는다. 운영 사이트에서도 늘 있다. |

스토리: Patterns/Frame/Section, Controls/Field/Field, Controls/Field/Select, Controls/Choice/Option, Controls/Choice/Switch, Primitives/LockMark, Primitives/Text.

### 흐름 11 · 설정

단계: 11.18. 단계마다 보이는 것은 [flows/11-settings.md](../flows/11-settings.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "읽기 전용" | 11.18 | "관리자 주소" 라벨 뒤 `LockMark`와 값 글. 나머지는 그대로 고칠 수 있다 | Primitives/LockMark |

## 설정 · AI 제안 (SettingsProposal)

- 보드: `SettingsProposal.dc.html`. 흐름 단계: [screens.md › SettingsProposal](../screens.md#settingsproposal)(2.21).
- 공통 틀: 설정 · 사이트와 같다. 이 보드는 설정 · 사이트에 어시스턴트가 바꾼 값이 얹힌 모습이다. 자리와 부품은 설정 · 사이트의 표를 따르고, 아래 자리만 다르다.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "변경 사항 1 · 제안 2 ▾" | `ChangesGroup`(`proposals`: `label` "제안", `discardLabel` "버리기", `items`) | 사람이 바꾼 곳과 어시스턴트 제안을 따로 센다. "변경 사항"에 제안을 넣어 세지 않는다(2026-11-05 소유자). 제안 개수는 파랗다. 목록에서 제안도 하나씩 버린다. |
| 제안된 값 (미리보기 경로) | `Affix proposal` | 파란 글자와 파란 밑줄. 아래에 옛 값 `Del`("/preview"). 사람이 고치거나 저장하면 보통 색으로 돌아간다([proposal.md](../components/proposal.md)). |
| 제안된 값 (주소에 언어 표시) | `Select` + `SelectTrigger proposal` | 같다. 아래에 옛 값 `Del`("항상"). |
| 제안된 필드의 라벨 줄 | `FormFieldLabel changed`(`tone="proposal"`, `undoLabel` "버리기"), 입력 아래 `Del` 옛 값 | 버리면 옛 값으로 돌아간다. |
| 사람이 바꾼 값 (사이트 이름) | `FormFieldLabel changed` | 주황 점과 "되돌리기". |

스토리: Monti/Change/ChangesGroup, Controls/Field/Affix, Monti/Proposal/Marks, Controls/Field/Select, Controls/Field/Field.

### 흐름 2 · 어시스턴트

단계: 2.21. 단계마다 보이는 것은 [flows/02-assistant.md](../flows/02-assistant.md)에 있다.

함께 열리는 화면: `AssistantPanel`([assistant.md](assistant.md)).

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| (상태 없음) | 2.21 | 사이트 이름 바뀜 1, 제안 2(미리보기 경로, 주소에 언어 표시): "변경 사항 1 · 제안 2" |  |
| `withRail` | 2.21 | ✦ 어시스턴트 열기 |  |


