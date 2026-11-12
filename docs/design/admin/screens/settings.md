# 설정

설정의 네 탭 중 사이트, 언어, 관리자와 어시스턴트 제안이 든 사이트 화면이다. 컬렉션 탭은 [collections.md](collections.md)에 있다. 값과 저장은 [기능 설계 12](../../features/12-settings.md)가 정한다.

보드(`Settings.dc.html`, `Locales.dc.html`, `AdminSettings.dc.html`)는 2026-11-05의 모습이다. 그 뒤 빠진 것(홈 링크, 다른 호스트 이름, 사이트 URL, 미리보기 절, 시간대, 직접 입력 창, 번역 스위치, 관리자 주소)은 기준 화면(`Screens/Reference/Settings`)과 이 지도가 맞다.

## 네 탭이 함께 쓰는 것

- 공통 틀: [common.md](common.md)의 사이드바, `PageColumn`, 제목 행 `PageHeader`("설정"), 제목 아래 탭 `TabLinks`(사이트 · 언어 · 컬렉션 · 관리자), 설정 한 절 `Section`, 저장 묶음 `ChangesGroup`, ✦ 어시스턴트 열기, 확인 질문, 시트.
- 네 탭은 한 초안을 쓴다(05, 12). 탭마다 주소가 있다(`#/settings/site` · `languages` · `collections` · `admin`). 사이드바의 "설정"은 사이트 탭을 연다.

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 탭 | `TabLinks variant="toolbar"` + `TabLink`(링크) | 탭을 옮겨도 초안은 그대로고 묻지 않는다. |
| 다른 탭의 점 | `TabLink`의 `dot`(`dotLabel` "변경" · "제안") | 저장하지 않은 것이 있는 다른 탭에만 이름 뒤에 주황 점, 제안만 있으면 파란 점. 열린 탭에는 붙이지 않는다(그 바뀐 곳은 이 페이지와 저장 묶음에 있다). 관리자 탭은 초안에 드는 값이 없어 점이 없다. |
| 저장 묶음 | `ChangesGroup`(`PageHeader`의 `children`) | 바뀐 곳이 있을 때만 보인다. 네 탭의 바뀐 곳을 모두 센다. 알약은 개발 서버 "저장하고 적용", 운영 사이트 "저장". 목록의 줄을 누르면 그 탭의 그 자리로 간다. |
| 저장 묶음이 사라질 때의 포커스 | 열린 탭의 `TabLink` | "모두 되돌리기", 저장, 변경 사항 목록의 마지막 "되돌리기"로 저장 묶음이 통째로 사라지면 포커스가 열린 탭의 이름으로 간다(2026-11-12, tokens.md의 상태). 페이지로 떨어지지 않는다. |
| 거절 띠 | `PageBanner` 안의 `Banner tone="danger"`(화면 맨 위, 제목 위) + `TextButton` 하나 | 저장이 거절되면 이유 한 줄과 할 일 하나가 남는다. 다른 곳에서 바뀌었으면 "다른 곳에서 바뀌었습니다 · 다시 불러오기", 파일을 쓰지 못했으면 "monti.schema.ts를 쓰지 못했습니다 · 다시 저장", 그 밖은 이유와 "다시 저장". 다음 저장의 답이 올 때까지 남고, 탭을 옮겨도 남는다. 다시 저장하는 동안에도 그대로 있다가 답이 오면 새 이유로 바뀌거나 사라진다(2026-11-12: 저장하는 동안 사라졌다 돌아오면 페이지가 위아래로 움직인다). 검토 안에서 거절된 저장의 이유는 검토 맨 위에 보이고, 검토를 닫으면 띠로 온다. 토스트로만 알리지 않는다(T50). |
| 검토 | `Sheet`(`SheetTitle` "검토", `of` "· 언어, 게시글 · 변경 사항 4") | 컬렉션과 언어의 바꾸기를 한 장에서 본다. 언어 블록이 먼저, 컬렉션 블록이 다음이다. 지워지는 것이 있으면 빨간 "지우고 적용", 없으면 "적용". 검토가 열린 동안의 거절 이유는 검토 맨 위 `ErrorNote`다. 블록은 [collections.md](collections.md)와 아래 언어 표를 따른다. |
| 제안 버블 | `ProposalBubbleDock` + `ProposalBubble` | 제안이 있으면 아래에 뜬다. ↑ ↓는 탭을 넘나들며 제안이 걸린 자리를 연다(05). |
| 나가기 확인 | `AlertDialog`: `AlertDialogTitle` "저장하지 않은 변경 사항이 있습니다", `AlertDialogCancel variant="danger"` "저장하지 않고 나가기", `AlertDialogAction` "계속 고치기" | 바뀐 곳이 있는 채 설정 밖으로 갈 때 묻는다(흐름 11·04). |

스토리: Monti/Change/ChangesGroup, Patterns/Frame/PageHeader, Controls/Tabs/Tabs, Controls/Status/Banner, Controls/Overlay/Sheet, Monti/Change/ChangeGroup, Monti/Proposal/Bubble, Controls/Overlay/AlertDialog. 화면 스토리: Screens/Settings/Tabs.

## 설정 · 사이트 (Settings)

- 상태와 흐름 단계: [screens.md › Settings](../screens.md#settings), 흐름 [11](../flows/11-settings.md).

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 이름 절 | `Section`("이름") | |
| 사이트 이름 | `FormField` + `FormFieldLabel` + `Input` | 처음부터 입력 칸이다. 저장된 이름이 없으면 사이트 코드가 준 이름이 플레이스홀더로 보인다. 저장된 값과 다르면 `FormFieldLabel changed`(점과 "되돌리기"). 관리자 값이라 운영 사이트에서도 고친다. |
| 글 쓰는 방식 절 | `Section`("글 쓰는 방식") | |
| 말투와 규칙 | `FormField` + `Textarea`(3줄) | 관리자 값이라 운영 사이트에서도 고친다. 바뀌면 `FormFieldLabel changed`. |
| 공개 주소 절 | `Section`("공개 주소", `last`) | |
| 주소에 언어 표시 | `FormField` + `Select`(`SelectTrigger width="full"`): "항상" · "원문 언어만 빼고" · "안 함" | 구조 값이다. 바꾸면 저장할 때 검토에 "주소 변경" 블록으로 나온다. |
| 잠긴 주소에 언어 표시 (운영 사이트) | `ReadValue`(값 글 뒤 `LockMark`) | 값은 글로 보이고 자물쇠는 그 줄에 붙는다(원칙 9). 흐린 선택 칸은 두지 않는다(원칙 7). |

스토리: Patterns/Frame/Section, Controls/Field/Field, Controls/Field/Input, Controls/Field/Textarea, Controls/Field/Select, Primitives/LockMark.

### 흐름 2 · 어시스턴트

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "기본" | 2.20 | 변경 사항 1: 사이트 이름 `FormFieldLabel changed`, 저장 묶음 | Screens/Settings/Tabs › SiteChanged |

### 흐름 11 · 설정

단계: 11.04, 11.15, 11.15b. 11.01(호스트 추가), 11.02(언어 쿼리), 11.03(칸 오류), 11.09, 11.13은 빠졌다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "나가기 확인" | 11.04 | 나가기 `AlertDialog` | Controls/Overlay/AlertDialog |
| "읽기 전용" | 11.15 | "주소에 언어 표시"가 글과 `LockMark`. 저장 묶음 없음. 이름과 글 쓰는 방식은 그대로 입력 칸 | SiteLive |
| "읽기 전용 저장" | 11.15b | "읽기 전용"에 더해 사이트 이름 `FormFieldLabel changed`와 알약 "저장" | SiteLiveChanged |
| 저장 거절 | (12) | 거절 띠 "monti.schema.ts를 쓰지 못했습니다 · 다시 저장". 저장된 이름은 초안에서 빠지고 구조 값의 바뀐 곳은 남는다 | SaveRefused |

## 설정 · 언어 (Locales)

- 상태와 흐름 단계: [screens.md › Locales](../screens.md#locales), 흐름 [11](../flows/11-settings.md).

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 절 | `Section`("콘텐츠 언어", `last`) | 탭에는 이 절 하나다. 시간대 칸은 없다(12 화면 승인). |
| 언어 행 | `LanguageRow`(`name` 원어 이름, `code`, `label` 화면 언어로 쓴 이름) | 이름은 언어 코드에서 오는 글이다(`Intl.DisplayNames`). 저장하는 표시 이름은 없다. 바뀐 행은 `dot`("추가" · "삭제" · "원문 변경"), 제안으로 바뀐 행은 `dotTone="proposal"`. |
| 원문 행의 "원문 │ 바꾸기" | `LanguageSource` + `Button variant="ghost" size="sm"` "바꾸기" | 원문 행은 늘 맨 위고 손잡이 자리를 비운다. "바꾸기"는 `DropdownMenu`(`DropdownMenuRadioGroup`, 지금 원문에 ✓, 행 끝에 코드 `MenuShortcut`)를 연다. 고르면 그 언어가 맨 위로 가고 두 행에 점이 붙는다. |
| 다른 행의 손잡이 | `DragHandle`(`aria-label` "… 옮기기") + `Sortable` · `SortableList` | 끌거나 키보드(Space, ↑↓, Space)로 순서를 바꾼다. 원문 행은 움직이지 않는다. 저장된 순서로 돌려놓으면 바뀐 곳이 아니다. |
| 다른 행의 × | `IconButton`(`Close`, `label` "… 빼기") | 누르면 행에 취소선(`gone`)을 긋고 변경 사항에 더한다. 이 초안에서 더한 언어는 그냥 사라진다. 뺀 행의 끝에는 × 대신 `TextButton variant="underline" quiet` "되돌리기"가 있다. |
| "+ 언어 추가" | `Button variant="ghost" size="sm"` + `Popover`(`PopoverContent padding="menu"`) 안의 `Command`(`shouldFilter={false}`, `CommandInput` "언어나 코드 찾기", `CommandList`, `CommandItem`: 원어 이름 · 화면 언어로 쓴 이름 · 끝에 코드 `MenuShortcut`, `CommandEmpty` "맞는 언어가 없습니다.") | 코드 찾기만 있다. 고르면 그 자리에서 행이 생긴다. 사이트에 이미 있는 언어는 나오지 않는다. "직접 입력"은 없다: 목록에 없는 코드는 개발자가 `monti.schema.ts`에 적는다. |
| 잠긴 목록 (운영 사이트) | `LanguageRow locked`(이름 뒤 `LockMark`), 원문 행은 `LanguageSource`의 굵은 "원문"만 | 손잡이, ×, "바꾸기", "+ 언어 추가"가 없다. |

### 검토의 언어 블록

| 바꾸기 | 블록 |
|---|---|
| 언어 추가 | `ChangeGroup kind="new"`(`tag` "추가", `title` 원어 이름, `identifier` 코드) + `ChangeNote` "저장된 데이터는 바뀌지 않습니다." |
| 언어 빼기 | `ChangeGroup kind="drop"`(`tag` "삭제") + `ChangeNote danger` "번역이 함께 지워집니다." 고를 것은 없고 발의 알약이 빨간 "지우고 적용"이 된다. |
| 원문 바꾸기 | `ChangeGroup kind="edit"`(`tag` "원문 변경", `title` 새 원문) + `ChangeLines`(전 · 후), 새 원문 글이 없는 묶음이 있으면 `ChangeNote` "이 언어 글이 없는 n편에 초안이 생깁니다." |
| 주소에 언어 표시 바꾸기 | `ChangeGroup kind="edit"`(`tag` "주소 변경", `title` "주소에 언어 표시") + `ChangeLines`(전 · 후) + `ChangeNote` "옛 주소는 404가 됩니다." |

순서만 바꾼 저장은 검토할 것이 없어 검토 없이 저장된다.

언어에 고칠 곳이 있으면(원문 언어가 목록에 없음: 빠진 언어가 다시 원문이 됐을 때) 검토 맨 위 "고칠 곳"에 `ChangeGroup kind="drop"`(`tag` "고칠 곳", `title` 그 언어) + `ChangeNote danger` "원문 언어가 목록에 없습니다" + `TextButton` "열기"가 나오고, 발에 적용 알약이 없다. "열기"는 언어 탭을 연다. 그 탭에서 빠진 채 원문인 행은 끝에 "바꾸기" 대신 "되돌리기"(`TextButton variant="underline" quiet`)가 있다.

스토리: Patterns/Frame/Section, Patterns/List/LanguageRow, Controls/Button/DragHandle, Controls/Menu/DropdownMenu, Controls/Overlay/Popover, Controls/Menu/Command, Controls/Overlay/Sheet, Monti/Change/ChangeGroup.

### 흐름 11 · 설정

단계: 11.05, 11.06, 11.07, 11.07b, 11.08, 11.16. 11.06b(직접 입력)는 빠졌다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "언어 찾기" | 11.05 | "+ 언어 추가"의 `Command` 팝오버, 검색어 "zh" | LanguageSearch, LanguageSearchEmpty |
| "언어 추가됨" | 11.06 | Deutsch 행이 `dot`("추가")과 함께 생김, 저장 묶음 | LanguageAdded |
| "원문 메뉴" | 11.07 | "바꾸기"의 `DropdownMenu`(지금 원문 ✓) | SourceMenu |
| "원문 바꿈" | 11.07b | English가 맨 위의 원문, 두 행에 `dot`("원문 변경"), 옛 원문 행에 손잡이와 × | SourceChanged |
| 뺀 행 | 11.08 | English 행 `gone`과 "되돌리기" | LanguageRemoved |
| "빼기 검토" | 11.08 | 검토 `Sheet`, 빨간 "지우고 적용" | LanguageRemoveReview |
| 한 장 검토 | (12) | 언어 추가, 원문 바꾸기, 주소 변경, 필드 추가가 한 시트에 | OneReview |
| "읽기 전용" | 11.16 | 언어 행마다 `LockMark`. 손잡이, ×, "바꾸기", "+ 언어 추가"가 빠지고 원문 행의 굵은 "원문"은 남는다 | LanguagesLive |
| 제안 | (05) | 제안된 언어 행에 파란 점, 아래에 제안 버블 | LanguageProposal |

## 설정 · 관리자 (AdminSettings)

- 상태와 흐름 단계: [screens.md › AdminSettings](../screens.md#adminsettings).
- 이 탭의 값은 고르는 대로 바로 저장된다(`admin.setPreference`). 저장 묶음이 없고 초안에 들지 않는다. 저장이 거절되면 그 칸 아래에 `FormFieldError` 한 줄("저장하지 못했습니다")이 남고, 칸은 저장된 값 그대로다. 다음에 고른 것이 저장되면 사라진다. 다른 탭에 다녀와도 남아 있다. 토스트로 알리지 않는다(status.md).

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 언어 절 | `Section`("언어") | |
| 화면 언어 | `FormField` + `FormFieldLabel` "화면 언어" + `Select`(`SelectTrigger width="full"`, 항목은 언어 이름 뒤 코드 `MenuShortcut`) | 고르면 관리자 화면의 말이 바로 바뀐다. 로그인 화면도 이 언어로 뜬다. |
| 기능 절 | `Section`("기능") | |
| 본문 템플릿 | `Option spread height="lg"` + `Switch`, 묶음은 `Stack gap={4}` | 바로 적용되는 켜기/끄기. 끄면 `/` 메뉴의 템플릿 묶음, 새 글 메뉴의 "템플릿으로 쓰기", 도구의 템플릿이 사라진다. 템플릿은 지워지지 않는다(03). |
| 계정 절 | `Section`("계정", `last`) | 2026-11-05 소유자 결정으로 더해졌다. 보드에는 없다. 개발 서버가 로그인 없이 들여보낸 세션(`session.bypass`)에서는 이 절을 통째로 그리지 않고, 기능 절이 마지막 절이 된다(2026-11-12, 소유자에게 알림: 계정이 없고, 로그아웃해도 곧바로 다시 들어와진다). 스토리 AdminDevBypass. |
| 로그인한 계정 | `ReadValue`(`label` "로그인한 계정", 이메일 또는 GitHub 아이디, mono) | 고칠 수 없는 값이다. |
| "로그아웃" | `TextButton` | 누르면 세션을 끝내고 로그인 화면으로 간다. 묻지 않는다. 운영 사이트에서도 늘 있다. |

"번역" 스위치와 "주소" 절(관리자 주소)은 없다(12 화면 승인, 16).

스토리: Patterns/Frame/Section, Controls/Field/Field, Controls/Field/Select, Controls/Choice/Option, Controls/Choice/Switch. 화면 스토리: Screens/Settings/Tabs › Admin, AdminEnglish.

## 설정 · AI 제안 (SettingsProposal)

- 흐름 단계: [screens.md › SettingsProposal](../screens.md#settingsproposal)(2.21).
- 공통 틀: 설정 · 사이트와 같다. 설정 · 사이트에 어시스턴트가 바꾼 값이 얹힌 모습이다. 자리와 부품은 설정 · 사이트의 표를 따르고, 아래 자리만 다르다.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "변경 사항 1 · 제안 1 ▾" | `ChangesGroup`(`proposals`: `label` "제안", `discardLabel` "버리기", `items`) | 사람이 바꾼 곳과 어시스턴트 제안을 따로 센다. "변경 사항"에 제안을 넣어 세지 않는다(2026-11-05 소유자). 제안 개수는 파랗다. 목록에서 제안도 하나씩 버린다. |
| 제안된 값 (사이트 이름) | `Input proposal` + 아래 `FormFieldWas` 옛 값 | 파란 글자와 파란 밑줄. 사람이 고치면 그 제안을 받은 뒤 고친 것이 되어 보통 색으로 돌아간다([proposal.md](../components/proposal.md)). |
| 제안된 값 (주소에 언어 표시) | `Select` + `SelectTrigger proposal` + 아래 `FormFieldWas` 옛 값 | 같다. |
| 제안된 필드의 라벨 줄 | `FormFieldLabel changed`(`tone="proposal"`, `undoLabel` "버리기") | 버리면 옛 값으로 돌아간다. |
| 사람이 바꾼 값 (말투와 규칙) | `FormFieldLabel changed` | 주황 점과 "되돌리기". |
| 제안 버블 | `ProposalBubble` | "모두 받기"를 누르면 제안이 저장 전 변경이 된다. |

스토리: Monti/Change/ChangesGroup, Monti/Proposal/Marks, Controls/Field/Select, Controls/Field/Field. 화면 스토리: Screens/Settings/Tabs › SiteProposal.

### 흐름 2 · 어시스턴트

함께 열리는 화면: `AssistantPanel`([assistant.md](assistant.md)).

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| (상태 없음) | 2.21 | 말투와 규칙 바뀜 1, 제안 1(사이트 이름, 주소에 언어 표시): "변경 사항 1 · 제안 1" | SiteProposal |
