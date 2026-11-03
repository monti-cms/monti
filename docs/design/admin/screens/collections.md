# 설정 · 컬렉션

설정의 컬렉션 탭이다. 컬렉션 하나의 기본, 필드, 에디터 탭과 그 시트들이다. 컬렉션 흐름 대부분은 Schema 보드 하나의 단계다.

## 설정 · 컬렉션 · 필드 (Schema)

- 보드: `Schema.dc.html`. 상태와 흐름 단계: [screens.md › Schema](../screens.md#schema), 흐름 [4](../flows/04-collections.md)와 [11](../flows/11-settings.md).
- 공통 틀: [common.md](common.md)의 사이드바, `PageColumn width="content"`, 제목 행 `PageHeader`("설정"), 제목 아래 탭 `TabLinks`, 저장 묶음 `ChangesGroup`, ✦ 어시스턴트 열기, 시트, 사이드 패널, 토스트, 알림 띠.

### 머리와 위쪽 줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 저장 묶음 | `ChangesGroup`(`PageHeader`의 `children`) | 바뀐 곳이 있을 때만 보인다. "바뀐 곳 N ▾"의 목록은 항목마다 이름, 종류(`tag`: "이름" · "지움" · "새로" · "컬렉션 지움"), 되돌리기. 알약 라벨: 개발 서버 "저장하고 적용", 운영 환경 "PR 만들기", PR이 열려 있으면 "PR에 더하기". 미리보기에 고칠 곳이 있으면 `saveDisabled`. 지울 컬렉션은 목록에서 바로 빠지고, 이 목록에서 되돌린다. |
| 열린 PR 줄 | `Banner tone="neutral"`(`title` "PR #12", `meta` "읽는 시간 필드 추가 · 합치고 배포하면 적용돼요") + `TextButton` "보기" | PR이 열려 있는 동안 계속 보인다. |
| 데이터베이스 적용 실패 | `ChatError`(`title` "데이터베이스에 적용하지 못했어요", 회색 한 줄, `actions`에 `TextButton` "다시 적용" · "다시 불러오기") | 컬렉션 탭 줄 바로 아래. |

### 컬렉션 목록

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 목록과 내용 | `RailLayout`(`label` "컬렉션", `rail`에 목록) | 좁으면 내용이 목록 아래로 내려간다. |
| 컬렉션 하나 | `NavLink`(`active`, `note`에 식별자 mono, 바뀐 컬렉션은 `dot`) | 누르면 그 컬렉션을 연다. 지울 컬렉션은 곧바로 목록에서 빠진다. |
| "+ 새 컬렉션" | `TextButton variant="quiet"` | 새 컬렉션 시트를 연다. 읽기 전용이면 없다. |
| 컬렉션 탭 "기본 · 필드 10 · 에디터" | `PageToolbar` 안의 `TabLinks` + `TabLink`(필드 탭은 `count`) | 탭 하나가 페이지 하나다. |
| "속성 패널 미리보기" | `PageToolbarEnd` 안의 `TextButton`(`aria-pressed`) | 필드 탭에만 있다. 누르면 미리보기 사이드 패널을 열고 닫는다. |

### 필드 탭

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 속성 패널 탭 "기본 7 · SEO 3 +" | `FolderTabs`(`FolderTabsList`, `FolderTab` 손잡이 · 이름 · `count`, 플러그인이 둔 탭은 `locked`, 끝에 `FolderTabsAdd` "탭 추가") | 고른 탭의 필드만 보인다. 필드를 다른 탭 머리로 끌어 옮긴다. 탭 이름은 그 자리에서 고친다(`FolderTabEdit`). 탭이 하나뿐이면 탭 줄 없이 행만 있다. |
| 필드 목록 | `FolderTabsBody` 안의 `FieldTree` | 탭이 하나뿐이면 `FieldTree`만. |
| 필드 한 줄 | `FieldRow`(`name` mono, `label`, `description`, `kind` mono와 "!" 표시, 묶음 안은 `depth`, 바뀜은 `changed`, 이름 색 `tone`: 새로 `success`, 이름 바꿈 `warning`, 지움 `faint`, 문제 `danger`, `note` "← summary" · "지움" · "새로" · "✦ 제안" · "선택지 없음", 옮길 수 없으면 `grip={false}`) | 누르면(`onOpen`) 그 필드의 시트가 열리고, 고치는 것은 시트에서 한다. 손잡이로 순서를 바꾼다. |
| 묶음 줄 "분류" | `FieldRow group` | 이름이 굵게 든 회색 띠. |
| "+ 필드 추가" · "+ 묶음 추가" · "+ 탭 추가" | `TextButton` · `TextButton variant="quiet"` · `TextButton variant="quiet"` | 필드 추가는 필드 시트를 연다. 탭 추가는 탭이 하나뿐일 때만 여기 있다. 읽기 전용이면 "+ 필드 추가"가 없다. |
| 표시 설명 "! 필수 · → 관계 · [] 여러 개" | `Text variant="meta" tone="subtle"` | |

### 기본 탭

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| "보기" 절 | `Section stacked`("보기") | 관리자 설정이라 늘 고칠 수 있다. |
| 표시 이름 | `FormField` + `Input` | 처음부터 입력 칸이다. |
| 폴더 사용 | `Option spread` + `Switch` | |
| "구조" 절 | `Section stacked`("구조"). 읽기 전용이면 제목 뒤 `LockMark` | 구조(파일에 있는 설정)는 보기와 다른 절이다([field.md](../components/field.md) "읽기 전용"). |
| 식별자 | `FormField`의 라벨과 `Text mono`, 값 바로 뒤 `LockMark` | 절대 바꿀 수 없는 값이라 글로 보인다. |
| 종류 | 라벨과 `Text` "본문이 있는 글" | 만들 때 정한 값이라 글로 보인다. |
| 공개 주소 | `Option spread` + `Switch`(바뀌면 이름 뒤 `ChangeDot`), 그 아래 `Affix`(`prefix` "/", `suffix` "/:slug", mono) | 끄면 주소 칸이 없다. 읽기 전용이면 `Text mono` "/posts/:slug"와 `Switch disabled`. |
| 컬렉션 지우기 | `DangerBlock`(`title` "컬렉션 지우기") + `DangerRow`(`name`, `meta` "글 148편 · 폴더 3개", `action`에 `Button variant="outline-danger" size="sm"` "지우기") | 누르면 묻지 않고 곧바로 목록에서 빠지고, 토스트와 바뀐 곳 목록에 되돌리기가 생긴다. 저장할 때 검토가 마지막 확인이다. 읽기 전용이면 없다. |

### 속성 패널 미리보기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel`(`width="panel"`, `title` "미리보기"와 흐린 "· 저장 안 됨", 닫기 ×) | 저장하지 않은 필드 목록으로 글의 속성 패널을 그린다. ✦ 버튼을 가린다. |
| 탭 줄 "기본 · SEO" | `TabsList variant="bar"` | |
| 속성 행 | 글 편집기와 같은 부품([editor.md](editor.md)의 속성 패널: `PropertyRow`, 값 자리의 입력 부품, 묶음은 `PropertyGroup`) | 글 편집기에서 보일 모양 그대로. |
| 미리볼 수 없음 | `Text variant="note"` "고칠 곳이 있어 미리볼 수 없어요." + `TodoItem blocking`(`title` 필드 이름, 아래 줄 "선택지가 없어요") | 행을 누르면 그 필드로 간다. 저장 묶음의 알약이 비활성이 된다. |

### 새 컬렉션 시트

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` "새 컬렉션"), 발은 "취소" · `Button` "만들기" | 오류가 있으면 "만들기"가 비활성. |
| 이름 · 식별자 | `FormField` + `FormFieldLabel required` + `Input` / `Input mono` | 이미 쓰는 식별자면 `aria-invalid`와 `FormFieldError` "이미 쓰는 이름이에요." |
| 종류 | `FormFieldSet` + `FormFieldLegend variant="field"` "종류" + `RadioGroup`과 `RadioItem`(`description` "게시글, 노트처럼 본문이 있어요" · "카테고리, 태그처럼 짧아요") | 문서 · 항목 중 하나. |
| 공개 주소 | `Option spread` + `Switch`, 그 아래 `Affix`(`prefix` "/", `suffix` "/:slug") | |

### 필드 시트

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` "필드 추가", `of` 컬렉션 이름), 본문은 `SheetSplit`, 발은 "취소" · "필드 추가" | |
| 종류 고르기 (왼쪽) | `PickList` + `PickListItem`("글자" · "고르기" · "미디어" · "관계", 관계는 `mark` "→", 고른 것은 `selected`) | 고르면 오른쪽이 그 종류의 설정으로 바뀐다. |
| "기본 · 고급" | `Tabs` + `TabsList variant="bar"` + `TabsTrigger` + `TabsContent` | 한 시트 안에서 바꾼다. |
| 표시 이름 · 이름 · 도움말 | `FormField` + `Input` · `Input mono` · `Textarea` | |
| 관계 설정 | "가리킬 컬렉션" `Select`, "여러 개 고르기" · "목록에 없으면 새로 만들기" `Option spread` + `Switch`, "발행 안 된 시리즈" `Select` | |
| 글자 설정 | "여러 줄" `Switch`, "최대 글자 수" · "줄 수" `Input mono width="number"`, "안내 문구" `Input`, "비어 있으면 본문에서 채우기" `Switch` | |
| 고르기의 선택지 | `OptionTable`(`valueLabel` "값", `labelLabel` "라벨") + 줄마다 `OptionRow`(`handle`에 `DragHandle`, `value`에 `Input appearance="inline" mono`, `label`에 `Input appearance="inline"`, `action`에 빼기 ×) | 값과 라벨은 처음부터 입력 칸이고 쉴 때 글처럼 읽힌다. 아래 `TextButton` "+ 선택지"가 줄을 더한다. 줄 끝 `TextButton variant="quiet"` "기본값 · 메모" + `Caret` + `DropdownMenu`로 기본값을 고른다. |
| 선택지마다 다른 필드 | `Option spread` + `Switch` | |
| 필수 | `Option spread` + `Switch`(라벨 뒤 흐린 "!") | |
| 언어 | `FormField` + `Segmented`("모두 같음" · "언어마다" · "원문 따름") | 셋 중 하나를 고르는 짧은 선택이다([choice.md](../components/choice.md) "몇 개 중 하나"). |
| 요약 줄 | `Text variant="meta" mono` "series → Series" | 지금 설정을 스키마 말로 한 줄. |

### 필드 시트 · 읽기 전용

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` 필드 이름, `of` 컬렉션), 발은 "취소" · "저장" | |
| "보기" | `SheetSection`: 표시 이름 `Input`, 도움말 `Textarea`, 안내 문구 `Input`, 줄 수 `Input mono width="number"` | 관리자 설정이라 고칠 수 있다. |
| "구조" | `SheetSection`(제목 끝 `LockMark`): 이름 `Text mono`, 종류 · 최대 글자 수 · 언어 `Text`, 필수 · 여러 줄 · 본문에서 채우기 `Switch disabled` | 잠긴 값은 글, 스위치는 흐리게. |

### 검토 시트

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` "검토", `of` "게시글 · 바뀐 곳 3"), 발은 "취소" · 알약 하나 | 알약: "적용", 값을 지우는 선택이 있으면 `Button variant="danger"` "지우고 적용", 운영 환경 "PR 만들기". 파일이 바뀌었으면 비활성. 발에는 "취소"와 알약 하나만 있다. |
| 파일이 바뀜 | `ChatError`(`title` "파일이 바뀌었어요", 회색 한 줄, `actions`에 "다시 불러오기") | 시트 맨 위. |
| 변경 블록 | `ChangeGroup`(`kind` `new`·`edit`·`drop`, `tag` "새로" · "이름" · "지움" · "필수" · "주소", `title`, `identifier` "summary → excerpt") | |
| 값 처리 고르기 | `RadioGroup` + `RadioItem`(끝에 mono 개수 "148편", 답이 하나 더 필요한 선택은 `control`에 `Select`: "다른 필드로 옮기기" · "빈 글 148편 채우기") | 하나를 고른다. |
| 한 줄 결과 | `ChangeNote`(되돌릴 수 없으면 `danger`) | "저장된 데이터는 바뀌지 않아요." · "옛 주소는 404가 돼요." · "132편에서 값이 사라져요. 되돌릴 수 없어요." |
| 영향 목록 | `ChangeLabel`("지워지는 것", "받아 두기") + `ChangeLines` + `ChangeLine`(`what`, `then`, `tone` `danger`) | 공개 주소는 전 / 후 / 발행된 글. 컬렉션 삭제의 "받아 두기"는 `TextButton variant="underline"` "내보내기". |
| 영향받는 글 | `Text variant="note"` 안의 `TextButton variant="underline"` 글 링크 | "첫 번째 글, 발행 후 고친 글 외 146편". |
| 파일 변경 | `Patch`(`file` "monti.schema.ts", `lines`) | 운영 검토에만 있다. 파일 변경이 보이는 내용은 `Patch` 한 곳에만 둔다. |

### 상태

| `stage` | 더해지는 것 |
|---|---|
| "보통" | 게시글의 필드 탭: `FolderTabs` 기본 7 · SEO 3, `FieldTree` |
| "새 컬렉션" | 새 컬렉션 `Sheet` |
| "새 컬렉션 오류" | 식별자 `aria-invalid`와 `FormFieldError`, "만들기" 비활성 |
| "만든 직후" | 노트 컬렉션(`NavLink dot`), 탭 없이 `FieldTree`만(제목, 주소), "+ 탭 추가", 저장 묶음 바뀐 곳 1 |
| "필드 추가" | 필드 `Sheet`(`sheetKind`에 따라 관계 · 글자 · 고르기 설정) |
| "노트 필드 추가" | 노트 컬렉션의 필드 `Sheet` |
| "새 컬렉션 검토" | 검토 `Sheet`: `ChangeGroup kind="new"`와 `ChangeLines`(공개 주소, 필드), `ChangeNote` |
| "만듦" | `toast` "노트를 만들었어요"와 "보기" |
| "필드 바꿈" | `FieldRow` 셋: 이름 바꿈(`warning`, "← summary"), 지움(`faint`), 새 필수(`success`), 게시글 `NavLink dot`, 바뀐 곳 3 |
| "미리보기" | 미리보기 `SidePanel`, "속성 패널 미리보기" 눌림, ✦ 버튼 가려짐 |
| "미리보기 오류" | 미리보기 자리에 `TodoItem blocking`, 해당 `FieldRow tone="danger"`, 저장 알약 `saveDisabled` |
| "바뀐 곳 목록" | `ChangesGroup`의 목록 열림(요약 · 부제 · 글 종류, 각각 되돌리기) |
| "필드 검토" | 검토 `Sheet`: 이름 · 지움 · 필수 `ChangeGroup`, 영향받는 글 |
| "값 지우기" | 지움 블록에서 "값 지우기"를 고름, `ChangeNote danger`, 알약 `Button variant="danger"` "지우고 적용" |
| "주소 바꿈" | 기본 탭, `Affix` 값 "blog", 공개 주소 `ChangeDot`, 바뀐 곳 1 |
| "주소 검토" | 검토 `Sheet`: 주소 `ChangeGroup kind="edit"`, 전 / 후 / 발행된 글 `ChangeLines`, `ChangeNote` |
| "지우기 전" | 메모의 기본 탭과 `DangerBlock` |
| "지울 예정" | 메모가 목록에서 빠짐, 바뀐 곳 목록 열림("메모 · 컬렉션 지움 · 되돌리기"), `toast` "메모를 지웠어요"와 "되돌리기" |
| "지우기 검토" | 검토 `Sheet`: `ChangeGroup kind="drop"`, "지워지는 것" · "받아 두기", 알약 "지우고 적용" |
| "지우기 확인" | "지우기 검토"와 같다 |
| "지운 뒤" | 메모가 목록에 없음, `toast` "적용됐어요" |
| "운영 고침" | 새 `FieldRow`(readingTime, `success`, "새로"), 알약 "PR 만들기" |
| "운영 제안" | 새 `FieldRow`(note "✦ 제안", 파란 이름), 알약 "PR 만들기" |
| "운영 검토" | 검토 `Sheet`: `ChangeGroup kind="new"`와 `Patch`, 알약 "PR 만들기" |
| "PR 만듦" | 열린 PR `Banner`, `toast` "PR을 만들었어요"와 "보기" |
| "PR에 더하기" | 열린 PR `Banner`, 새 `FieldRow`(lead), 알약 "PR에 더하기" |
| "읽기 전용" | 구조 절 `LockMark`, 식별자 · 종류 · 공개 주소는 글, 스위치 `disabled`, "+ 새 컬렉션" · "+ 필드 추가" · `FolderTabsAdd` · 컬렉션 지우기 없음. 보기와 배치(끌기, "+ 묶음 추가")는 고칠 수 있다 |
| "읽기 전용 필드" | 읽기 전용 필드 `Sheet` |
| "적용 실패" | `ChatError` "데이터베이스에 적용하지 못했어요" |
| "충돌" | 검토 `Sheet` 맨 위 `ChatError` "파일이 바뀌었어요", 알약 비활성 |

| 그 밖의 prop | 더해지는 것 |
|---|---|
| `tab` "필드" · "기본" | 필드 탭 또는 기본 탭(삭제 · 주소 단계는 기본 탭) |
| `sheet` | "필드 추가"와 같다 |
| `review` | "필드 검토"와 같다 |
| `sheetKind` "관계" · "글자" · "고르기" | 필드 시트의 `PickListItem selected`와 그 종류의 설정 |
| `withRail` | ✦ 어시스턴트 열기(미리보기 중에는 패널에 가려진다) |
| `dark` | 어두운 테마 |

### 빠진 부품

- **오류 답장의 일반 이름**: `.mt-msg-error`는 지금 어시스턴트 부품 `ChatError`로만 있다. 이 화면은 같은 모양을 쓴다. 이름이 대화에 묶여 있으니, 다른 화면에서도 쓰는 부품으로 옮길지 정해야 한다.

## 설정 · 컬렉션 · 기본 (CollectionBasics)

- 보드: `CollectionBasics.dc.html`. Schema 보드를 `tab="기본"`으로 가져온 것이다. 상태: [screens.md › CollectionBasics](../screens.md#collectionbasics).
- 공통 틀: Schema와 같다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 머리 · 컬렉션 목록 · 컬렉션 탭 | Schema의 "머리와 위쪽 줄", "컬렉션 목록" | 기본 탭이 골라져 있다. 바뀐 것이 없어 저장 묶음은 없다. |
| 보기 · 구조 · 컬렉션 지우기 | Schema의 "기본 탭" 표 그대로 | |

### 상태

| prop | 더해지는 것 |
|---|---|
| (상태 없음) | 게시글의 기본 탭: 표시 이름, 폴더 사용, 식별자, 종류, 공개 주소, `DangerBlock` |

### 빠진 부품

없다.

## 설정 · 컬렉션 · 에디터 (CollectionEditor)

- 보드: `CollectionEditor.dc.html`. 상태: [screens.md › CollectionEditor](../screens.md#collectioneditor).
- 공통 틀: Schema와 같다(`PageHeader`, `ChangesGroup`, `TabLinks`, `RailLayout` + `NavLink`, 컬렉션 탭).

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 저장 묶음 | `ChangesGroup` | 바뀐 곳 1. "컬렉션" 탭 이름 뒤 `TabLink`의 `dot`. |
| 컬렉션 목록과 탭 | Schema의 "컬렉션 목록" | "에디터" 탭이 골라져 있다. |
| 블록 · 서식 · 제목 단계 묶음 | 묶음마다 `Section stacked`(제목 "블록" · "서식" · "제목 단계") | 묶음 사이에 가는 선. 마지막 묶음은 `last`. |
| "모두 허용" | 블록 제목 옆 `TextButton variant="quiet"` | 블록을 모두 켠다. |
| 허용 항목 | `Grid columns={3}` 안에 항목마다 `Option` + `Checkbox` | 누르면 바로 켜고 끈다(저장 묶음에 들어간다). 제목 단계 이름(H2 · H3 · H4)은 `Text mono`. 꺼진 항목은 글이 흐리다. 저장된 값과 다른 항목은 이름 뒤 `ChangeDot`. 보드의 "· 바뀜" 글은 [status.md](../components/status.md)의 변경 점을 따라 `ChangeDot`으로 바꾼다. |

### 상태

| prop | 더해지는 것 |
|---|---|
| (상태 없음) | 게시글의 에디터 탭, "파일" 블록이 꺼져 바뀜 1 |
| `dark` | 어두운 테마 |

### 빠진 부품

없다.

## 설정 · 컬렉션 · 필드 추가 (SchemaAddField)

- 보드: `SchemaAddField.dc.html`. Schema 보드를 `stage="필드 추가"`로 가져온 것이다(`sheetKind`는 기본 "관계"). 상태: [screens.md › SchemaAddField](../screens.md#schemaaddfield).
- 공통 틀: Schema와 같다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 뒤의 화면 | Schema의 필드 탭 | 시트 뒤에 흐리게 남는다. |
| 필드 추가 시트 | Schema의 "필드 시트" 표 그대로. 관계가 골라져 있다: 표시 이름 "시리즈", 이름 "series", 도움말, 가리킬 컬렉션, 여러 개 고르기, 목록에 없으면 새로 만들기, 발행 안 된 시리즈, 필수, 언어, 요약 줄 "series → Series" | |

### 상태

| prop | 더해지는 것 |
|---|---|
| (상태 없음) | 필드 `Sheet`, `PickListItem` "관계" `selected` |

### 빠진 부품

없다.

## 설정 · 컬렉션 · 저장 검토 (SchemaReview)

- 보드: `SchemaReview.dc.html`. Schema 보드를 `stage="필드 검토"`로 가져온 것이다. 상태: [screens.md › SchemaReview](../screens.md#schemareview).
- 공통 틀: Schema와 같다.

### 자리

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 뒤의 화면 | Schema의 필드 탭("필드 바꿈"의 세 `FieldRow`) | 시트 뒤에 흐리게 남는다. |
| 검토 시트 | Schema의 "검토 시트" 표 그대로: 요약 이름 바꿈(`ChangeGroup kind="edit"`, "값 옮기기 148편" · "빈 칸으로 시작"), 부제 지움(`kind="drop"`, "남겨 두기 132편" · "다른 필드로 옮기기 + `Select`" · "값 지우기", `ChangeNote`), 글 종류 새 필수(`kind="new"`, "빈 글 148편 채우기 + `Select`" · "그대로 두기", `ChangeNote`), 영향받는 글, 발 "취소" · "적용" | |

### 상태

| prop | 더해지는 것 |
|---|---|
| (상태 없음) | 검토 `Sheet`, 바뀐 곳 3 |

### 빠진 부품

없다.
