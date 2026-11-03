# 설정

설정의 네 탭 중 사이트, 언어, 관리자와 어시스턴트 제안이 든 사이트 화면이다. 컬렉션 탭은 [collections.md](collections.md)에 있다.

## 설정 · 사이트 (Settings)

- 보드: `Settings.dc.html`. 상태와 흐름 단계: [screens.md › Settings](../screens.md#settings), 흐름 [11](../flows/11-settings.md).
- 공통 틀: [common.md](common.md)의 사이드바, `PageColumn width="content"`, 제목 행 `PageHeader`("설정"), 제목 아래 탭 `TabLinks`(사이트 · 언어 · 컬렉션 · 관리자), 설정 한 절 `Section`, 저장 묶음 `ChangesGroup`, ✦ 어시스턴트 열기, 확인 질문, 시트.

### 머리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 저장 묶음 | `ChangesGroup`(`PageHeader`의 `children`) | 바뀐 곳이 있을 때만 보인다. 알약 라벨은 사이트 종류를 따른다: 개발 서버 "저장하고 적용", 운영 환경에서 데이터베이스 설정만 바뀌면 "저장", 파일 설정이 섞이면 "PR 만들기". 칸에 오류가 있으면 알약은 남은 채 `saveDisabled`. |
| "사이트" 탭의 바뀜 점 | `TabLink`의 `dot` | 이 탭에 저장하지 않은 것이 있으면 이름 뒤에 점. |

### 이름과 링크

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 절 | `Section`("이름과 링크") | |
| 사이트 이름 | `FormField` + `FormFieldLabel` + `Input` | 처음부터 입력 칸이다. 저장된 값과 다르면 `FormFieldLabel changed`(점과 "되돌리기"). |
| 홈 링크 | `FormField` + `Input mono` | 틀리면 `aria-invalid`와 `FormFieldError` 한 줄("/로 시작하거나 https://로 시작해야 해요."). |
| 다른 호스트 이름 | `FormFieldGroup` 안에 줄마다 `Input mono`와 빼기 `TextButton variant="quiet"`("×", `aria-label` "… 빼기") | 줄 하나가 호스트 하나다. 끝의 `TextButton` "+ 호스트"가 빈 줄을 더하고 커서를 그 줄에 둔다. |

### 글 쓰는 방식

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 말투와 규칙 | `FormField` + `Textarea` | 데이터베이스에 저장되는 관리자 설정이라 운영 환경에서도 늘 고칠 수 있다. 바뀌면 `FormFieldLabel changed`. |

### 미리보기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 미리보기 경로 | `FormField` + `Affix`(`prefix` "/", mono) | 바꿀 수 있는 부분만 밑줄. 바뀌면 `FormFieldLabel changed`. |
| 미리보기 경로에 언어 넣기 | `Option spread` + `Switch` | 끄면 아래에 "미리보기 언어 쿼리" `FormField` + `Input mono`(플레이스홀더 "locale")가 생긴다. 바뀐 스위치는 라벨 뒤 `ChangeDot`. |
| 잠긴 미리보기 (읽기 전용) | 절 제목 뒤 `LockMark`, 경로는 `Text mono`, 스위치는 `Switch disabled` | 구조라서 값은 글로 보이고 스위치는 흐리다. |

### 공개 주소

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 주소에 언어 표시 | `FormField` + `Select`(`SelectTrigger width="full"`) | 읽기 전용이면 절 제목 뒤 `LockMark`와 값 글(`Text`). |
| 사이트 URL | `FormField`의 라벨과 `Text`(`SITE_URL`은 `Text mono`) | 배포하는 곳에서 넣는 값의 상태 한 줄. |

### 뜨는 면

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 나가기 확인 | `AlertDialog`: `AlertDialogTitle` "저장하지 않은 바뀐 곳이 있어요", `AlertDialogDescription`, `AlertDialogCancel variant="danger"` "저장하지 않고 나가기", `AlertDialogAction` "계속 고치기" | 바뀐 곳이 있는 채 다른 곳으로 갈 때 묻는다. |
| 운영 검토 | `Sheet`(`SheetTitle` "검토", `of` "사이트 · 바뀐 곳 3"): 변경마다 `ChangeGroup kind="edit"`, 파일 변경은 `Patch`(`file` "monti.schema.ts"), 발은 "취소" · "PR 만들기" | 바로 저장되는 것과 PR로 가는 것을 나눠 보인다. |

### 상태

| `stage` | 더해지는 것 |
|---|---|
| "기본" | 바뀐 곳 2: 사이트 이름 `FormFieldLabel changed`, 저장 묶음 |
| "호스트 추가" | 다른 호스트 이름에 빈 `Input mono` 줄 하나(플레이스홀더 "blog.example.dev") |
| "언어 쿼리" | 언어 넣기 `Switch` 꺼짐과 `ChangeDot`, "미리보기 언어 쿼리" `Input mono` |
| "칸 오류" | 홈 링크 `Input aria-invalid`와 `FormFieldError`, 저장 알약 `saveDisabled`. screens.md는 호스트 이름 행의 오류라고 적지만 보드는 홈 링크에 그린다 |
| "나가기 확인" | 나가기 `AlertDialog` |
| "운영 글 쓰는 방식" | 말투와 규칙 `FormFieldLabel changed`, 알약 "저장" |
| "운영 검토" | 운영 검토 `Sheet`(바로 저장 2 · PR 1과 `Patch`), ✦ 버튼은 시트에 가려진다 |
| "읽기 전용" | 미리보기와 공개 주소 절 제목 뒤 `LockMark`, 그 값은 글, 스위치 `disabled`, 저장 묶음 없음. screens.md는 공개 주소만 잠긴다고 적지만 보드는 미리보기도 잠근다 |
| "읽기 전용 저장" | "읽기 전용"에 더해 사이트 이름 `FormFieldLabel changed`와 알약 "저장" |
| `withRail` | ✦ 어시스턴트 열기 |
| `dark` | 어두운 테마 |

### 빠진 부품

- **바로 저장 / PR 나눔 머리**(`.mt-change-group`): 검토 시트의 "바로 저장 2", "PR 1" 머리. [change.md](../components/change.md)가 "아직 `@monti-cms/ui`에 없다"고 적는다.
- **더한 줄만 보이는 결과**(`.note.is-add`): 앞에 초록 +가 붙는 한 줄. `ChangeNote`에 이 모양이 없다([change.md](../components/change.md)).

## 설정 · 언어 (Locales)

- 보드: `Locales.dc.html`. 상태와 흐름 단계: [screens.md › Locales](../screens.md#locales), 흐름 [11](../flows/11-settings.md).
- 공통 틀: 설정 · 사이트와 같다(`PageHeader`, `TabLinks`, `Section`, `ChangesGroup`, 시트, 작은 폼 창).

### 콘텐츠 언어

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 절 | `Section`("콘텐츠 언어"). 읽기 전용이면 제목 뒤 `LockMark` | |
| 언어 행 | `LanguageRow`(`name` 원어 이름, `code`, `label` 표시 이름, 바뀐 행은 `dot`, 뺄 행은 `gone`) | 이름은 언어 코드에서 오는 글이다. 다른 행은 끌기 손잡이(`handle`에 `DragHandle`)로 순서를 바꾼다. |
| 원문 행의 "원문 │ 바꾸기" | `LanguageSource` | 굵은 "원문", 구분선, 조용한 밑줄 버튼 "바꾸기". "바꾸기"는 `DropdownMenu`(`DropdownMenuRadioGroup`, 지금 원문에 ✓)를 연다. 고르면 그 언어가 맨 위로 가고 두 행에 바뀜 점이 붙는다. 원문 행은 손잡이 자리를 비운다. |
| 다른 행의 × | `TextButton variant="quiet"`(`aria-label` "… 빼기") | 누르면 행에 취소선(`gone`)을 긋고 바뀐 곳에 더한다. 번역이 있는 언어는 저장 때 검토에서 처리를 고른다. |
| "+ 언어 추가" | `TextButton` + `Popover`(`PopoverContent padding="menu"`) 안의 `Command`(`shouldFilter={false}`, `CommandInput`, `CommandList`, `CommandItem` 코드 mono · 원어 이름 · 끝에 표시 이름, `CommandSeparator`, 마지막 "직접 입력") | 코드를 고르면 그 자리에서 행이 생긴다. "직접 입력"은 창을 연다. |
| 직접 입력 창 | `Dialog`(`DialogTitle` "새 언어", `of` 코드): "코드" `Text mono`, "원어 이름" `Input`, "표시 이름" `Input`, `DialogFormFooter`("취소" · "추가") | 420px 작은 창. 포커스는 원어 이름으로 간다. |

### 시간대

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시간대 | `FormField` + `Combobox`(`ComboboxInput`, mono 값) | 항목이 많아 검색해서 고른다([field.md](../components/field.md) "선택"). 보드는 닫힌 선택 칸만 그린다. 관리자 설정이라 읽기 전용에서도 고칠 수 있다. |

### 뜨는 면

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 빼기 검토 | `Sheet`(`SheetTitle` "검토", `of` "언어 · 바뀐 곳 1"): `ChangeGroup kind="drop"`(`tag` "뺌", `title` "English", `identifier` "en · 번역 12편") 안에 `RadioGroup` + `RadioItem` "남겨 두기"(기본) · "휴지통으로", `ChangeNote` "다시 추가하면 돌아와요.", 발은 "취소" · "적용" | 번역이 있는 언어를 뺀 채 저장하면 열린다. |

### 상태

| `stage` | 더해지는 것 |
|---|---|
| "기본" | 한국어(원문, `LanguageSource`)와 English 행 |
| "언어 찾기" | "+ 언어 추가"의 `Command` 팝오버, 검색어 "zh" |
| "직접 입력" | 직접 입력 `Dialog` |
| "언어 추가됨" | 日本語 행이 `dot`("새로")과 함께 생김, 탭 `dot`, 저장 묶음 |
| "원문 메뉴" | "바꾸기"의 `DropdownMenu`(지금 원문 ✓) |
| "원문 바꿈" | English가 맨 위의 원문, 두 행에 `dot`("원문 바뀜"), 옛 원문 행에 손잡이와 × |
| "빼기 검토" | English 행 `gone`, 빼기 검토 `Sheet`, ✦ 버튼은 시트에 가려진다 |
| "읽기 전용" | 절 제목 뒤 `LockMark`. 손잡이, ×, 구분선, "바꾸기", "+ 언어 추가"가 빠지고 원문 행의 굵은 "원문"은 남는다. 시간대는 그대로 고칠 수 있다 |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 설정 · 관리자 (AdminSettings)

- 보드: `AdminSettings.dc.html`. 상태와 흐름 단계: [screens.md › AdminSettings](../screens.md#adminsettings), 흐름 [11](../flows/11-settings.md).
- 공통 틀: 설정 · 사이트와 같다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 언어 절 | `Section`("언어") | |
| 메뉴와 버튼 언어 | `FormField` + `Select`(`SelectTrigger width="full"`, 항목은 언어 이름 뒤 흐린 코드 "ko") | 고르면 관리자 화면의 말이 바뀐다. |
| 기능 절 | `Section`("기능") | |
| 본문 템플릿 · 번역 | 줄마다 `Option spread` + `Switch` | 바로 적용되는 켜기/끄기. |
| 주소 절 | `Section`("주소", 마지막 절이라 `last`). 읽기 전용이면 제목 뒤 `LockMark` | |
| 관리자 주소 | `FormField`의 라벨과 `Text mono` "/studio" | 파일에서 정하는 값이라 글로 보인다. 보드는 값 뒤에 "monti.schema.ts"를 붙이지만 [page-header.md](../components/page-header.md)를 따라 뺀다(파일 이름은 그 파일이 문제인 곳에서만 보인다). |

### 상태

| `stage` | 더해지는 것 |
|---|---|
| "기본" | 위의 세 절. 언어와 기능은 고칠 수 있다 |
| "읽기 전용" | 주소 절 제목 뒤 `LockMark`. 나머지는 그대로 고칠 수 있다 |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 설정 · AI 제안 (SettingsProposal)

- 보드: `SettingsProposal.dc.html`. 흐름 단계: [screens.md › SettingsProposal](../screens.md#settingsproposal)(2.21).
- 공통 틀: 설정 · 사이트와 같다. 이 보드는 설정 · 사이트에 어시스턴트가 바꾼 값이 얹힌 모습이다. 자리와 부품은 설정 · 사이트의 표를 따르고, 아래 자리만 다르다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "바뀐 곳 3 · 제안 2 ▾" | `ChangesGroup` | 바뀐 곳 개수 뒤에 어시스턴트 제안 개수가 파랗게 붙는다. 목록에서 제안도 하나씩 버린다. |
| 제안된 값 (미리보기 경로) | `Affix proposal` | 파란 글자와 파란 밑줄. 아래에 옛 값 `Del`("/preview"). 사람이 고치거나 저장하면 보통 색으로 돌아간다([proposal.md](../components/proposal.md)). |
| 제안된 값 (주소에 언어 표시) | `Select` + `SelectTrigger proposal` | 같다. 아래에 옛 값 `Del`("항상"). |
| 제안된 필드의 라벨 줄 | `FormFieldLabel`(파란 점과 "버리기") | 버리면 옛 값으로 돌아간다. |
| 사람이 바꾼 값 (사이트 이름) | `FormFieldLabel changed` | 주황 점과 "되돌리기". |

### 상태

| prop | 더해지는 것 |
|---|---|
| (상태 없음) | 사이트 이름 바뀜 1, 제안 2(미리보기 경로, 주소에 언어 표시) |
| `withRail` | ✦ 어시스턴트 열기 |
| `dark` | 어두운 테마 |

### 빠진 부품

- **제안 개수가 붙은 저장 묶음**: "바뀐 곳 3 · 제안 2"(`.mt-fill` 안의 개수). `ChangesGroup`은 바뀐 곳 개수 하나만 그린다.
- **제안 표시가 붙은 라벨 줄**(`.mt-proposal-dot` + "버리기"): `FormFieldLabel changed`는 주황 바뀜 점만 그린다.
