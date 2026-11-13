# 설정 · 컬렉션

설정의 컬렉션 탭이다. 설정의 네 탭이 함께 쓰는 것(탭 줄, 저장 묶음, 거절 띠, 한 장 검토, 제안 버블)은 [settings.md](settings.md)의 "네 탭이 함께 쓰는 것"에 있다. 컬렉션 흐름은 모두 Schema 보드 하나의 단계다. 필드 탭과 기본 탭, 그리고 그 시트들이다. 에디터 탭은 따로 된 CollectionEditor 보드다.

## 설정 · 컬렉션 · 필드 (Schema)

- 보드: `Schema.dc.html`. 상태와 흐름 단계: [screens.md › Schema](../screens.md#schema), 흐름 [4](../flows/04-collections.md)와 [11](../flows/11-settings.md).
- 공통 틀: [common.md](common.md)의 사이드바, `PageColumn width="content"`, 제목 행 `PageHeader`("설정"), 제목 아래 탭 `TabLinks`, 저장 묶음 `ChangesGroup`, ✦ 어시스턴트 열기, 시트, 사이드 패널, 토스트, 알림 띠.

### 기본 틀

#### 머리와 위쪽 줄

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 저장 묶음 | `ChangesGroup`(`PageHeader`의 `children`) | 변경 사항이 있을 때만 보인다. "변경 사항 N ▾"의 목록은 항목마다 이름, 종류(`tag`: "이름 변경" · "삭제" · "추가" · "컬렉션 삭제" · "주소 변경" · 그 밖의 고침은 "변경", 2026-11-10 소유자: 번역 표시와 같은 낱말), 되돌리기. 알약 라벨: 개발 서버 "저장하고 적용", 운영 환경 "PR 만들기", PR이 열려 있으면 "PR에 더하기". 고칠 곳이 있어도 막지 않는다. 누르면 검토가 열리고 거기서 알린다. 지울 컬렉션은 목록에서 바로 빠지고, 이 목록에서 되돌린다. |
| 저장 거절 | `PageBanner` 안의 `Banner tone="danger"`(`title` 거절 까닭. 까닭이 없으면 "저장하지 못했습니다. 다시 시도해 주세요.") | 저장이나 검토 열기가 거절됐을 때. 화면 맨 위, 틀의 띠 자리에 선다([common.md](common.md)의 "화면의 알림 띠"). 제목 "설정"이 그 아래다. 검토 시트가 열려 있는 동안은 까닭이 시트 안에 남고 띠는 없다. 다시 저장하면 사라진다. |
| 열린 PR 줄 (빠짐, 2026-11-05) | `Banner tone="neutral"`(`title` "PR #12", `meta` "읽는 시간 필드 추가 · 합치고 배포하면 적용됩니다") + `TextButton` "보기" | PR이 열려 있는 동안 계속 보인다. |
| 데이터베이스 적용 실패 (빠짐, 2026-11-05) | 틀의 알림 띠(`SchemaBanner`)가 맡는다 | 모든 화면 맨 위의 띠와 같은 말을 두 번 보이지 않는다. |

| 제안 따라가기 | `ProposalBubbleDock` + `ProposalBubble`(`name` 요청의 말, ↑ n / N ↓, "모두 버리기" · "모두 받기") | 대기 중인 제안이 있을 때만. 단의 맨 아래 가운데에 뜬다. 이전 / 다음은 제안이 있는 자리를 연다: 컬렉션의 필드 탭, 또는 설정의 다른 탭(사이트, 언어). 제안 하나를 받거나 버리는 카드는 T41. |

#### 컬렉션 목록

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 목록과 내용 | `RailLayout`(`label` "컬렉션", `rail`에 목록) | 좁으면 내용이 목록 아래로 내려간다. |
| 컬렉션 하나 | `NavLink`(`active`, `note`에 식별자 mono, 바뀐 컬렉션은 `dot`) | 누르면 그 컬렉션을 연다. 지울 컬렉션은 곧바로 목록에서 빠진다. |
| "+ 새 컬렉션" | `RailAction` | 새 컬렉션 시트를 연다. 읽기 전용이면 없다. |
| 컬렉션 탭 "기본 · 필드 10 · 에디터" | `PageToolbar` 안의 `TabLinks` + `TabLink`(필드 탭은 `count`) | 탭 하나가 페이지 하나다. |
| "속성 패널 미리보기" | `PageToolbarEnd` 안의 `Button variant="ghost" size="sm"`(`aria-pressed`) | 필드 탭에만 있다. 누르면 미리보기 사이드 패널을 열고 닫는다. |

#### 필드 탭

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 속성 패널 탭 "기본 7 · SEO 3 +" | `FolderTabs`(`FolderTabsList`, `FolderTab` 손잡이 · 이름 · `count`, 플러그인이 둔 탭은 `locked`, 끝에 `FolderTabsAdd` "탭 추가") | 고른 탭의 필드만 보인다. 필드를 다른 탭 머리로 끌어 옮긴다. 탭 이름은 더블클릭이나 오른쪽 클릭 메뉴(`ContextMenu` "이름 바꾸기" · "지우기")로 그 자리에서 고친다(`FolderTabEdit`). 끌기는 [list.md](../components/list.md) "끌어서 옮기기"를 따른다. 탭은 늘 하나 이상 있다. 관리자 값에 배치가 없으면 "기본" 탭 하나에 모든 필드가 있다(2026-11-05 바뀜: 탭이 하나여도 탭 줄을 보인다). |
| 필드 목록 | `FolderTabsBody` 안의 `FieldTree` | 탭이 하나뿐이면 `FieldTree`만. |
| 플러그인의 탭 | `FolderTab locked`(손잡이 없음, 이름과 필드 수), 안은 `FieldTree`에 `FieldRow`(`grip` 없음, `locked`, 이름 · 라벨 · 종류). 아래 한 줄 `Text variant="meta" tone="subtle"` "seo 플러그인의 탭" | 컬렉션의 탭 뒤에 선다. 필드는 열리지 않고 끌리지 않으며, 탭에 오른쪽 클릭 메뉴가 없다. "+ 필드 추가"와 "+ 묶음 추가", 범례 줄이 없고 그 자리에 누구의 탭인지 말하는 한 줄이 선다. 미리보기 패널에도 같은 탭이 끝에 있다. 필드는 편집기와 같은 입력으로 그린다: 플러그인의 브라우저 쪽이 준 입력을 빈 글 위에("제목과 같음 · 0/60", 스위치), 없으면 종류의 기본 입력을. 화면 필드는 그리지 않는다(만들며 정함 2026-11-13, 기능 설계 14). |
| 필드 한 줄 | `FieldRow`(`name` mono, `label`, `description`, `kind` mono와 "!" 표시, 묶음 안은 `depth`, 바뀜은 `changed`, 이름 색 `tone`: 새로 `success`, 이름 바꿈 `warning`, 지움 `faint`, 문제 `danger`, ✦ 제안 `proposal`, `note` "← summary" · "지움" · "새로" · "✦ 제안" · "선택지 없음", 옮길 수 없으면 `grip={false}`) | 누르면(`onOpen`) 그 필드의 시트가 열리고, 고치는 것은 시트에서 한다. 손잡이로 순서를 바꾼다. |
| 묶음 줄 "분류" | `FieldGroup`(묶음 띠 `FieldRow group`과 그 아래 묶음 안 필드들) | 이름이 굵게 든 회색 띠. 띠의 손잡이로 묶음을 그 필드들과 함께 옮긴다. 필드는 묶음 안팎으로 끌어 옮긴다. |
| 조건부 필드와 선택지 띠(문서 19) | `FieldGroup head`(조건부 필드의 `FieldRow`가 띠 자리에 선다) 아래에 선택지마다 `FieldRow group grip={false}`(`depth` 한 칸 안, `name` 선택지 라벨, `note` 값, `kind` 자리에 `TextButton variant="quiet" size="note"` "+ 필드"), 그 아래 선택지의 필드 `FieldRow grip={false}`(`depth` 두 칸 안) | 묶음과 다른 점: 띠가 제 필드 줄 아래 한 칸 안에 서고, 손잡이가 없고, 이름 뒤에 값(`video`)이 붙고, 끝에 "+ 필드"가 있다. 필드가 없는 선택지도 띠가 남고 "필드 없음"이라고 적는다. 조건부 필드를 끌면 띠와 필드가 함께 움직인다. 선택지의 필드는 끌지 않는다(T186). "+ 필드"는 필드 시트를 그 선택지의 새 필드로 연다. 시트 제목 옆에 "게시글 · 글 종류 · 동영상"처럼 누구의 것인지 적는다. 만들며 정함 (2026-11-13). |
| "+ 필드 추가" · "+ 묶음 추가" | 둘 다 `Button variant="ghost" size="sm"` | 필드 추가는 필드 시트를 연다. 탭 추가는 탭 줄 끝의 `FolderTabsAdd`가 한다. 읽기 전용이면 "+ 필드 추가"가 없다. |
| 표시 설명 "! 필수 · → 관계 · [] 여러 개" | `Text variant="meta" tone="subtle"` | |

#### 기본 탭

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 묶음 | `Stack gap={24} paddingY={24}` 하나 | 한 묶음에 이 순서로 선다: 식별자와 종류, 표시 이름, 공개 주소, 미리보기 주소(본문이 있는 글만), 폴더 사용. |
| 식별자 | `ReadValue`(`mono`), 값 바로 뒤 `LockMark`("바꿀 수 없음") | 절대 바꿀 수 없는 값이라 글로 보이고, 자물쇠는 그 줄에 있다. |
| 종류 | `ReadValue` "본문이 있는 글" | 만들 때 정한 값이라 글로 보인다. |
| 표시 이름 | `FormField` + `Input` | 관리자 값이라 늘 고칠 수 있다. 처음부터 입력 칸이다. 제안된 이름은 `Input proposal`과 라벨 줄의 "버리기", 아래 `FormFieldWas` 옛 이름이다(설정 · AI 제안과 같다). |
| 공개 주소 | "폴더 사용"과 같은 36px 본문 글자 줄(`Inline minHeight="control-lg"` + `Label size="body"`: 이름, 바뀌었으면 `ChangeDot`과 끝의 "되돌리기" `TextButton variant="underline" quiet size="caption"`), 바로 아래 `Affix`(`prefix` "/", `suffix` "/:slug", `width="fit"`). 항목은 줄 끝에 `Switch`가 있고 꺼져 있으면 `Affix`가 없다. 글은 `Switch`가 없다. | 글은 공개 주소가 꼭 있다. 항목은 없이 시작하고, 슬러그는 안에서 쓰는 식별자로 남는다. 주소에 문제가 있으면(모양이 틀림, 다른 컬렉션이 쓰는 주소) 칸이 `aria-invalid`가 되고 바로 아래 `FormFieldError`에 까닭이 보인다. 두 컬렉션이 한 주소를 쓰면 두 쪽 칸 모두에 보인다. 검토 "고칠 곳"의 그 줄에 있는 "열기"가 이 칸으로 오고 키보드가 칸에 들어간다(T151). 운영 사이트에서는 `ReadValue`로 주소나 "사용 안 함"을 읽고, 값 바로 뒤에 `LockMark`가 붙는다. |
| 미리보기 주소 | 공개 주소와 같은 36px 줄(같은 `Inline` + `Label`), 바로 아래 `Affix`(`prefix` "/", `suffix` "/:slug", `width="fit"`, `placeholder` "preview"), 그 아래 `FormFieldError reserve`의 `hint` "비워 두면 공개 주소에서 미리봅니다." | 본문이 있는 글에만 있다(항목은 미리 볼 페이지가 없다). 사이트가 미리보기 페이지를 따로 만들었을 때 그 주소를 적는 칸이고, 비우면 공개 주소에서 미리본다(16번 문서). 힌트는 칸이 비어 있을 때만 보이고(원칙 8), 줄은 남아서 글자를 쳐도 아래가 움직이지 않는다. 주소에 문제가 있으면(모양이 틀림, 공개 주소나 다른 미리보기 주소와 같음) 그 줄에 까닭이 오류로 보이고, 검토의 "열기"가 이 칸으로 온다(T151). 운영 사이트에서는 `ReadValue`로 읽는다: 주소가 있으면 `mono`로 그 주소, 없으면 "공개 주소에서", 값 바로 뒤에 `LockMark`(2026-11-12, 소유자). |
| 폴더 사용 | `Option spread height="lg"` + `Switch` | 관리자 값이라 늘 고칠 수 있다. 위 입력 칸과 같은 36px 줄이다(원칙 10). 제안된 값이면 라벨 뒤에 파란 `ChangeDot`. |
| 컬렉션 지우기 | `DangerBlock`(`title` "컬렉션 지우기") + 오른쪽 끝 `Button variant="outline-danger" size="sm"` "지우기" | 이미 고른 컬렉션의 상세라 이름을 되풀이하지 않는다. 누르면 묻지 않고 곧바로 목록에서 빠지고, 토스트와 변경 사항 목록에 되돌리기가 생긴다. 저장할 때 검토가 마지막 확인이다. 읽기 전용이면 없다. |

#### 속성 패널 미리보기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel`(`width="panel"`, `title` "미리보기"와 흐린 "· 저장 안 됨", 닫기 ×) | 저장하지 않은 필드 목록으로 글의 속성 패널을 그린다. ✦ 버튼을 가린다. |
| 탭 줄 "기본 · SEO" | `TabsList variant="bar"` | |
| 속성 행 | 글 편집기와 같은 부품([editor.md](editor.md)의 속성 패널: `FormField`, 값 자리의 입력 부품(`md`, 미디어는 `MediaInput`), 묶음은 `PropertyGroup`) | 글 편집기에서 보일 모양 그대로. |
| 미리볼 수 없음 (빠짐, 2026-11-05) | | 미리보기는 고칠 곳이 있어도 미리보기를 그린다(선택지 없는 고르기는 빈 고르기 상자). 고칠 곳은 저장할 때 검토 맨 위에서 알린다. |

스토리: Monti/Change/ChangesGroup, Patterns/Frame/PageHeader, Controls/Button/TextButton, Controls/Status/ErrorNote, Patterns/Frame/RailLayout, Patterns/Frame/NavLink, Controls/Tabs/FolderTabs, Patterns/List/FieldTree, Primitives/Text, Patterns/Frame/Section, Controls/Field/Field, Controls/Field/Input, Controls/Choice/Option, Controls/Choice/Switch, Primitives/LockMark, Controls/Status/ChangeDot, Controls/Field/Affix, Patterns/Frame/DangerBlock, Controls/Button/Button, Controls/Overlay/SidePanel, Monti/Proposal/PropertyPanel, Monti/EditorTools/TodoItem, Controls/Overlay/Sheet, Controls/Choice/Radio, Controls/Menu/PickList, Controls/Field/Textarea, Controls/Field/Select, Primitives/OptionTable, Controls/Button/DragHandle, Controls/Choice/Segmented, Monti/Change/ChangeGroup, Monti/Change/Patch, Monti/Proposal/ProposalBubble.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 새 컬렉션 시트

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` "새 컬렉션"), 발은 "취소" · `Button` "만들기" | 오류가 있으면 "만들기"가 비활성. |
| 이름 · 식별자 | `FormField` + `FormFieldLabel required` + `Input` / `Input mono`, 식별자 라벨 뒤 `LockMark` | 식별자는 만든 뒤 바꿀 수 없다. 이미 쓰는 식별자면 `aria-invalid`와 `FormFieldError` "이미 쓰는 이름입니다." |
| 종류 | `FormFieldSet` + `FormFieldLegend variant="field"` "종류" + `RadioGroup`과 `RadioItem`(`description` "게시글, 노트처럼 본문이 있는 글" · "카테고리, 태그처럼 짧은 항목") | 문서 · 항목 중 하나. |
| Public address | The same 36px body-text setting row as the basic tab, with the `Affix` directly below. Items add a `Switch` at the far end and hide the `Affix` while off; documents have no switch. | New item collections default to no public address. |

#### 필드 시트

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` "필드 추가", `of` 컬렉션 이름), 본문은 `SheetSplit`, 발은 "취소" · "필드 추가" | |
| 종류 고르기 (왼쪽) | `PickList` + `PickListItem`("글자" · "고르기" · "미디어" · "관계", 표시 없이 이름만(2026-11-05, 소유자), 고른 것은 `selected`) | 고르면 오른쪽이 그 종류의 설정으로 바뀐다. |
| 위의 묶음과 절들 | 위는 제목 없이 고치기 시트면 맨 위에 종류(`ReadValue`, 바뀌지 않는다), 그다음 `FormField` 셋(식별자 `Input mono`와 빨간 `*`, 표시 이름 `Input`(비어 있는 동안 플레이스홀더로 식별자: 화면은 그때 식별자를 보인다), "✦ 설명" `Textarea`). 식별자가 먼저다: 꼭 있어야 하는 것은 식별자이고 표시 이름은 그 위에 덧입힌다(2026-11-05, 소유자), 아래는 `SheetSection` "입력 규칙", 사이는 여백(선 없음) | 하는 일로 묶는다(2026-11-05, 소유자). ✦ 설명은 `Textarea`(플레이스홀더 "AI에게 알려 줄 이 필드의 용도와 규칙", 어시스턴트가 읽는 필드의 목적과 쓰는 법). 입력 규칙: 설정마다 한 줄. 더하기 시트, 고치기 시트, 읽기 전용 시트가 같은 셋이다. 파일 값인지 관리자 값인지는 화면에 드러내지 않는다. |
| 입력 규칙의 줄 | `Option spread height="md"`(32px), 줄 사이 4px: 이름이 앞, 컨트롤이 끝. 필수 · 여러 줄(`Switch`), 최대 글자 수(`Input size="md" mono width="number"`, 플레이스홀더 "제한 없음"), 언어(`Select size="md"`) | 운영에서는 줄 이름 뒤에 `LockMark`, 값은 글("켜짐" · "꺼짐", "120자까지")이다. 제목(`title`)과 주소(`slug`)는 필수 줄이 개발 서버에서도 `LockMark`와 "켜짐"이다. 둘은 늘 필수다(01). |
| 파일 (미디어, 절 "파일") | 입력 규칙과 같은 줄: "파일 종류"(`Select size="md"`: 이미지 · 모든 파일) | 받을 파일의 종류는 값의 모양이라 규칙이 아니다. "선택지" · "고를 대상"과 같은 자리(입력 규칙 위)에 온다(2026-11-05, 소유자). |
| 고를 대상 (관계, 절 "고를 대상") | 입력 규칙과 같은 줄: 가리킬 컬렉션(`Select size="md"`), 여러 개 고르기 · 목록에 없으면 새로 만들기(`Switch`) | 무엇을 몇 개 고르는지는 규칙이 아니라 값의 모양이라 따로 된 절이다. "선택지"와 같은 자리(입력 규칙 위)에 온다(2026-11-05, 소유자). |
| 고르기의 선택지 (절 "선택지") | `OptionTable`(머리 없음, 값 · 라벨은 입력의 플레이스홀더) + 줄마다 `OptionRow`(`handle`에 `DragHandle`, `value`에 `Input appearance="inline" mono`, `label`에 `Input appearance="inline"`, `action`에 빼기 ×) | 값과 라벨은 처음부터 입력 칸이고 쉴 때 글처럼 읽힌다. 손잡이로 순서를 바꾼다(끌기와 키보드, [list.md](../components/list.md) "끌어서 옮기기"). 구조를 바꿀 수 없는 운영 사이트에서는 손잡이가 없다. 아래 `TextButton` "+ 선택지"가 줄을 더한다. 기본값은 없다(01번 문서의 고르기 설정은 선택지와 여러 개뿐). 선택지는 규칙이 아니라 필드의 값이라 위 묶음과 "입력 규칙" 사이의 따로 된 절이다. 선택지가 없으면 표 머리 없이 "+ 선택지"만 있다(2026-11-05, 소유자). "여러 개 고르기" 줄은 이 절의 끝, "+ 선택지" 아래에 있다. "+ 선택지"를 누르면 포커스가 새 줄의 값 칸으로 간다. 값이 빈 선택지는 같은 값처럼 "고칠 곳"(빈 값)이 된다(만들며 정함 2026-11-13). |
| 언어 | 입력 규칙의 한 줄, `Select size="md"`("언어 공통" · "언어마다" · "원문 따름") | 설명 없이 이름만(2026-11-05, 소유자). 사이트 언어가 하나면 없다(T46). |
| 요약 줄 (빠짐, 2026-11-05) | | 이름 칸과 종류 목록이 이미 보이는 말을 되풀이해서 뺐다. |

#### 필드 시트 · 읽기 전용

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` 필드 이름, `of` 컬렉션), 발은 "취소" · "저장" | |
| 두 부분 | 고치기 시트와 같다 | 표시 이름과 설명, 선택지의 라벨은 고칠 수 있다. 식별자와 입력 규칙은 이름 뒤 `LockMark`와 글이다. |

#### 검토 시트

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 시트 | `Sheet`(`SheetTitle` "검토", `of` "게시글 · 변경 사항 3"), 발은 "취소" · 알약 하나 | 알약: "적용", 값을 지우는 선택이 있으면 `Button variant="danger"` "지우고 적용", 운영 환경 "PR 만들기". 파일이 바뀌었으면 "다시 불러오기". 발에는 "취소"와 알약 하나만 있다. |
| 고칠 곳 | 변경 블록과 같은 `ChangeGroup kind="drop"`(`tag` "고칠 곳", `title` 필드 이름, `identifier`) + `ChangeNote danger` 무엇이 문제인지 + `TextButton` "열기" | 검토의 맨 위, 다른 변경 블록과 같은 모양이다. 저장을 누른 그때 알린다. "열기"는 검토를 닫고 그 필드 시트를 연다. 주소의 문제(공개 주소, 미리보기 주소)는 `title`이 컬렉션 이름이고, "열기"가 그 컬렉션의 기본 탭을 열어 키보드를 그 주소 칸에 넣는다(T151). 고칠 곳이 남아 있는 동안 발에는 "취소"만 있다(2026-11-05, 소유자). |
| 파일이 바뀜 | `ErrorNote`(`title` "파일이 바뀌었습니다", 회색 한 줄) | 시트 맨 위, 위로 변경 블록과 같은 16px. 이때 발의 알약은 "다시 불러오기"다. 할 수 있는 일이 그것뿐이라 비활성 "적용" 대신 그 자리에 둔다(2026-11-05, 소유자). |
| 변경 블록 | `ChangeGroup`(`kind` `new`·`edit`·`drop`, `tag` "추가" · "이름 변경" · "삭제" · "필수" · "주소 변경" · "변경"(미리보기 주소), `title`, `identifier` "summary → excerpt") | |
| 선택지 줄(문서 12·19) | 이름 바꾼 선택지: `ChangeGroup kind="edit"`(`tag` "이름 변경", `title` "분위기 · 시끌", `identifier` "mood · loud → noisy") + `ChangeLines`의 `ChangeLine` "고른 글". 뺀 선택지: `ChangeGroup kind="drop"`(`tag` "삭제") + `RadioGroup`("바꾸기"에 남은 선택지를 고르는 `PickOne`과 `hint`로 고른 글의 수, "비우기") | 수가 있는 줄은 모두 "3편 · 공개된 글 1편"처럼 공개된 글의 수를 함께 적는다(지운 필드의 "값 지우기", 이름 바꾼 필드의 "값 옮기기", 필수의 "채우기"도 같다). 둘 다 있으면 "바꾸기"가 먼저 골라져 있다. 필수 필드에는 "비우기"가 없다. "비우기"는 값을 버리므로 알약이 "지우고 적용"이 된다. 조건부 필드에서 바꿔 갈 선택지에 필수 필드가 있으면 `ChangeNote` "링크의 필수 필드가 비게 됩니다 · 공개된 글 1편". 만들며 정함 (2026-11-13). |
| 선택지 안으로 옮긴 필드(문서 19) | `ChangeGroup kind="edit"`(`tag` "변경", `identifier` "videoUrl → format · link") + `ChangeLines`("옮긴 곳", "값을 잃는 글") + `ChangeNote danger` | 묻는 것이 없다. 그 선택지를 고르지 않은 글에서 값이 지워지므로 알약은 "지우고 적용"이다. 만들며 정함 (2026-11-13). |
| 값 처리 고르기 | `RadioGroup` + `RadioItem`(끝에 mono 개수 "148편", 답이 하나 더 필요한 선택은 `control`에 `Select`: "다른 필드로 옮기기" · "빈 글 148편 채우기", 글자 필드를 채우면 `Input size="sm"`) | 하나를 고른다. `RadioGroup height="md"`: 줄마다 32px, 4px 간격이라 고르기가 든 줄도 높이가 같고, 고르기와 입력 칸은 `md`다. 순서는 늘 값을 살리는 선택이 먼저, 비우는 선택이 나중이다(이름: 옮기기 → 빈 칸, 지움: 다른 필드로 옮기기 → 지우기, 필수: 채우기 → 그대로). 지움의 처음 선택은 그대로 "값 지우기"다(2026-11-05, 소유자). |
| 한 줄 결과 | `ChangeNote`(되돌릴 수 없으면 `danger`) | "저장된 데이터는 바뀌지 않습니다." · "옛 주소는 404가 됩니다." · "값이 사라집니다. 되돌릴 수 없습니다." |
| 영향 목록 | `ChangeLines` + `ChangeLine`(`what`, `then`) | 주소 변경은 전과 후를 보인다. "옛 주소는 404가 됩니다."는 있던 공개 주소가 바뀌거나 없어질 때만 붙는다. 미리보기 주소 변경도 전과 후를 보이고(없는 쪽은 "공개 주소에서"), 방문자가 보는 주소가 아니므로 "저장된 데이터는 바뀌지 않습니다."가 붙는다. 새 컬렉션의 "추가" 블록은 공개 주소 줄 아래에 미리보기 주소 줄을 보인다(적었을 때만). |
| 영향받는 글 (빠짐, 2026-11-05) | | 개발 데이터의 글이라 운영에서 영향받는 글과 다르다. 개수와 같은 이유로 뺐다. |
| 파일 변경 | `Patch`(`file` "monti.schema.ts", `lines`) | 운영 검토에만 있다. 파일 변경이 보이는 내용은 `Patch` 한 곳에만 둔다. |

### 흐름 4 · 컬렉션

단계: 4.01, 4.02, 4.03, 4.04, 4.05, 4.06, 4.07, 4.08, 4.09, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18. 단계마다 보이는 것은 [flows/04-collections.md](../flows/04-collections.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "새 컬렉션" | 4.01 | 새 컬렉션 `Sheet` | Controls/Overlay/Sheet |
| "새 컬렉션 오류" | 4.02 | 식별자 `aria-invalid`와 `FormFieldError`, "만들기" 비활성 | Controls/Field/Field |
| "만든 직후" | 4.03 | 노트 컬렉션(`NavLink dot`), "기본" 탭 하나와 `FieldTree`(제목, 주소), 저장 묶음 변경 사항 1 | Patterns/Frame/NavLink, Patterns/List/FieldTree |
| "노트 필드 추가" | 4.04 | 노트 컬렉션의 필드 `Sheet` | Controls/Overlay/Sheet |
| "새 컬렉션 검토" | 4.05 | 검토 `Sheet`: `ChangeGroup kind="new"`와 `ChangeLines`. 줄은 공개 주소, 미리보기 주소(적었을 때만, 본문이 있는 글만), 필드 순서다. 공개 페이지가 없는 항목은 공개 주소 줄이 없다. | Controls/Overlay/Sheet, Monti/Change/ChangeGroup |
| "만듦" | 4.06 | `toast` "노트를 만들었습니다"와 "보기" | Controls/Status/Toast |
| "필드 바꿈" | 4.07 | `FieldRow` 셋: 이름 바꿈(`warning`, "← summary"), 지움(`faint`), 새 필수(`success`), 게시글 `NavLink dot`, 변경 사항 3 | Patterns/List/FieldTree, Patterns/Frame/NavLink |
| "미리보기" | 4.08 | 미리보기 `SidePanel`, "속성 패널 미리보기" 눌림, ✦ 버튼 가려짐 | Controls/Overlay/SidePanel |
| "고칠 곳" | 4.09 | 해당 `FieldRow tone="danger"`. 저장을 누르면 검토 맨 위에 "고칠 곳" 변경 블록과 "열기", 발에 알약 없음 | Monti/Change/ChangeGroup, Patterns/List/FieldTree |
| "변경 사항 목록" | 4.10 | `ChangesGroup`의 목록 열림(요약 · 부제 · 글 종류, 각각 되돌리기) | Monti/Change/ChangesGroup |
| "필드 검토" | 4.11 | 검토 `Sheet`: 이름 · 지움 · 필수 `ChangeGroup` | Controls/Overlay/Sheet, Monti/Change/ChangeGroup |
| "값 지우기" | 4.12 | 지움 블록에서 "값 지우기"를 고름, `ChangeNote danger`, 알약 `Button variant="danger"` "지우고 적용" | Monti/Change/ChangeGroup, Controls/Button/Button |
| "주소 바꿈" | 4.13 | 기본 탭, `Affix` 값 "blog", 공개 주소 `ChangeDot`, 변경 사항 1 | Controls/Field/Affix, Controls/Status/ChangeDot |
| "주소 검토" | 4.14 | 검토 `Sheet`: 주소 `ChangeGroup kind="edit"`, 전 / 후 / 발행된 글 `ChangeLines`, `ChangeNote` | Controls/Overlay/Sheet, Monti/Change/ChangeGroup |
| "주소 문제" | (T151) | 기본 탭, 미리보기 주소 `Affix` 값 "posts"(게시글의 공개 주소와 같다), 칸 아래 `FormFieldError` "이미 쓰는 주소입니다". 저장을 누르면 검토 맨 위 "고칠 곳"에 같은 까닭과 "열기" | AddressProblem, AddressProblemReview |
| "새 컬렉션 검토 · 미리보기 주소" | (T152) | 새 컬렉션에 미리보기 주소를 적고 연 검토: 공개 주소 줄 아래 미리보기 주소 줄 | NewCollectionPreviewReview |
| "지우기 전" | 4.15 | 메모의 기본 탭과 `DangerBlock` | Patterns/Frame/DangerBlock |
| "지울 예정" | 4.16 | 메모가 목록에서 빠짐, 변경 사항 목록 열림("메모 · 컬렉션 삭제 · 되돌리기"), `toast` "메모를 지웠습니다"와 "되돌리기" | Controls/Status/Toast |
| "지우기 검토" | 4.17 | 검토 `Sheet`: `ChangeGroup kind="drop"`, `ChangeNote` "이 컬렉션의 글이 모두 지워집니다.", 알약 "지우고 적용"(2026-11-05 바뀜: 받아 두기와 개수는 빠짐) | Controls/Overlay/Sheet, Monti/Change/ChangeGroup |
| "지운 뒤" | 4.18 | 메모가 목록에 없음, `toast` "적용했습니다" | Controls/Status/Toast |
| `tab` "필드" · "기본" | 4.01, 4.02, 4.03, 4.04, 4.05, 4.06, 4.07, 4.08, 4.09, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18 | 필드 탭 또는 기본 탭(삭제 · 주소 단계는 기본 탭) |  |
| `sheetKind` "관계" · "글자" · "고르기" | 4.01, 4.02, 4.03, 4.04, 4.05, 4.06, 4.07, 4.08, 4.09, 4.10, 4.11, 4.12, 4.13, 4.14, 4.15, 4.16, 4.17, 4.18 | 필드 시트의 `PickListItem selected`와 그 종류의 설정 | Controls/Menu/PickList |

### 흐름 11 · 설정

단계: 11.10, 11.11, 11.12, 11.14, 11.14b, 11.17, 11.17b, 11.17c, 11.19, 11.20. 단계마다 보이는 것은 [flows/11-settings.md](../flows/11-settings.md)에 있다.

함께 열리는 화면: `AssistantPanel`([assistant.md](assistant.md)).

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| "운영 고침" (빠짐, 2026-11-05) | 11.10 | 새 `FieldRow`(readingTime, `success`, "추가"), 알약 "PR 만들기" | Patterns/List/FieldTree |
| "운영 제안" (빠짐, 2026-11-05) | 11.11 | 새 `FieldRow`(note "✦ 제안", 파란 이름), 알약 "PR 만들기" | Patterns/List/FieldTree |
| "운영 검토" (빠짐, 2026-11-05) | 11.12 | 검토 `Sheet`: `ChangeGroup kind="new"`와 `Patch`, 알약 "PR 만들기" | Controls/Overlay/Sheet, Monti/Change/ChangeGroup, Monti/Change/Patch |
| "PR 만듦" (빠짐, 2026-11-05) | 11.14 | 열린 PR `Banner`, `toast` "PR을 만들었습니다"와 "보기" | Patterns/Frame/Banner, Controls/Status/Toast |
| "PR에 더하기" (빠짐, 2026-11-05) | 11.14b | 열린 PR `Banner`, 새 `FieldRow`(lead), 알약 "PR에 더하기" | Patterns/Frame/Banner, Patterns/List/FieldTree |
| "읽기 전용" | 11.17, 11.17c | 공개 주소 줄과 미리보기 주소 줄의 `LockMark`, 식별자 · 종류 · 공개 주소 · 미리보기 주소는 글, "+ 새 컬렉션" · "+ 필드 추가" · `FolderTabsAdd` · 컬렉션 지우기 없음. 보기와 배치(끌기, "+ 묶음 추가")는 고칠 수 있다 | Primitives/LockMark, Controls/Tabs/FolderTabs |
| "읽기 전용 필드" | 11.17b | 읽기 전용 필드 `Sheet` | Controls/Overlay/Sheet |
| "적용 실패" | 11.20 | 틀의 알림 띠(`SchemaBanner`) "스키마를 데이터베이스에 적용하지 못했습니다"와 "다시 적용" | Patterns/Frame/Banner |
| "충돌" | 11.19 | 검토 `Sheet` 맨 위 `ErrorNote` "파일이 바뀌었습니다", 알약 비활성 | Controls/Overlay/Sheet, Controls/Status/ErrorNote |
| `tab` "필드" · "기본" | 11.10, 11.11, 11.12, 11.14, 11.14b, 11.17, 11.17b, 11.17c, 11.19, 11.20 | 필드 탭 또는 기본 탭(삭제 · 주소 단계는 기본 탭) |  |
| `sheetKind` "관계" · "글자" · "고르기" | 11.10, 11.11, 11.12, 11.14, 11.14b, 11.17, 11.17b, 11.17c, 11.19, 11.20 | 필드 시트의 `PickListItem selected`와 그 종류의 설정 | Controls/Menu/PickList |
| `withRail` | 11.11 | ✦ 어시스턴트 열기(미리보기 중에는 패널에 가려진다) |  |

## 설정 · 컬렉션 · 에디터 (CollectionEditor)

- 보드: `CollectionEditor.dc.html`. 상태: [screens.md › CollectionEditor](../screens.md#collectioneditor).
- 공통 틀: 위 Schema의 머리(`ChangesGroup`), 컬렉션 목록, 컬렉션 탭과 같다. 이 화면은 컬렉션 탭의 "에디터"가 고른 탭이다. 에디터 탭은 본문이 있는 컬렉션에만 있다.

### 기본 틀

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 묶음 "블록" · "서식" · "제목 단계" | `Section stacked`(제목은 묶음 이름) | 이 컬렉션의 편집기가 쓸 수 있는 것을 묶음마다 고른다. 처음에는 모두 켜져 있다. |
| "모두 허용" | 블록 묶음 제목 뒤 `TextButton variant="quiet"` | 누르면 그 묶음을 모두 켠다. |
| 항목 | `Grid columns={3}` 안에 칸마다 `Option` + `Checkbox`(제목 단계 이름은 `Text mono` "H2") | 켜고 끄면 저장 묶음의 변경 사항이 된다. 제안된 칸은 `Checkbox proposal`(파란 표시)이다. |
| 바뀐 항목 | 이름 뒤 `Text variant="meta" tone="warning"` "· 바뀜" | 저장한 값과 다를 때만. |

스토리: Patterns/Frame/Section, Controls/Button/TextButton, Primitives/Grid, Controls/Choice/Option, Controls/Choice/Checkbox, Primitives/Text.
