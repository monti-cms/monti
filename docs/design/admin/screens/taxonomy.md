# 분류

## 카테고리 · 항목 열기 (Taxonomy)

- 보드: `Taxonomy.dc.html`. 상태와 흐름 단계: [screens.md › Taxonomy](../screens.md#taxonomy).
- 공통 틀: [common.md](common.md)의 사이드바, 페이지 단(`PageColumn width="list"`), 제목 행, 사이드 패널, 작은 폼 창, 토스트, 메뉴.
- 카테고리와 태그는 항목 컬렉션(`item`)이다. 하는 일은 만들기, 고치기, 합치기, 휴지통으로 옮기기다.

### 기본 틀

#### 제목 행

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 제목 "카테고리" · "태그" | `PageHeader`(`title`, optional `meta` for the public path) | Items without a public page omit the meta value. |
| 검색 | `SearchToggle` → `SearchBox` | 그 자리에서 열린다. 보드는 돋보기만 있는 알약이지만 [field.md](../components/field.md)를 따라 돋보기와 "검색" 글자가 있는 `SearchToggle`이다. |
| "+ 카테고리 추가" · "+ 태그 추가" | `Button variant="secondary"` | 새 항목을 옆 패널에 빈 채로 연다. |

#### 목록

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 열 이름 행 | `ListHead`(열 "이름", "글 수"; 정렬된 열은 `sort`) | 정렬은 열 이름의 메뉴에서 한다. 카테고리 보드는 툴바에 탭 "전체 3"과 "이름순 ▾"를 그리지만, [page-header.md](../components/page-header.md)를 따라 컬렉션 목록의 툴바는 비우고 카테고리도 태그처럼 `ListHead`를 쓴다. 행을 고르면 같은 자리를 `BulkBar`가 대신한다. |
| 표 | `Table`, `TableBody`, `TableRow`(옆 패널에 열린 행은 `selected`) | |
| 체크 | `RowCheck` | 포인터가 행 위에 있거나 무엇이든 고른 동안 보인다. |
| 이름 · 주소 | `RowTitle` + `RowLink` | Uses the same single-line row as the document list. The secondary value is always the bare slug (`react`), not the full public path. Descriptions are edited in the side panel and never change list-row height. A missing translated name remains an inline warning. |
| "글 3" · "쓰는 글 없음" | `TextButton variant="underline"`(`href` 그 항목으로 거른 글 목록) | The usage column is right-aligned. An unused item is faint text. |
| ⋯ | `RowActions` + `DropdownMenu` | 모든 행에 늘 보인다. 보드는 열린 행에만 그렸지만 [list.md](../components/list.md)를 따른다. |
| 일괄 막대 | `BulkBar`(`label` "2개 선택", `selectAll`, `clearLabel` "선택 해제", `colSpan`) | 동작은 "합치기" · "휴지통으로"(`TextButton`) 둘이다. 합치기는 둘 이상 골랐을 때 보인다. |

#### 합치기

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 창 | `Dialog`(`DialogContent`, `DialogHeader`, `DialogTitle` "어느 이름으로 합칠까요?", `DialogFooter`) | 남길 이름을 고르고 결과를 한 줄로 보인다. 합쳐진 태그는 휴지통으로 가서 되돌릴 수 있으므로 알약은 primary다. |
| 남길 이름 | `RadioGroup` + `RadioItem`(`label` 이름과 주소, `hint` "글 12") | 처음에는 글이 더 많은 쪽이 골라져 있다. |
| Result summary | `DialogDescription`, followed by a faint address note only when public addresses exist | State the number of affected posts, the item that remains, and which items move to trash. Keep removed addresses out of the main sentence. |
| "취소" · "합치기" | `DialogClose`(`TextButton`) · `Button variant="primary"` | 합친 뒤 `toast` "글 3편의 태그를 리액트로 바꿨습니다" + "되돌리기". |

스토리: Patterns/Frame/PageHeader, Controls/Field/SearchBox, Controls/Button/Button, Patterns/List/ListHead, Patterns/List/BulkBar, Patterns/List/Table, Primitives/Text, Controls/Button/TextButton, Controls/Menu/DropdownMenu, Controls/Overlay/Dialog, Controls/Choice/Radio, Controls/Status/Toast, Controls/Overlay/SidePanel, Controls/Button/IconButton, Controls/Tabs/Tabs, Controls/Field/Field, Controls/Field/Input, Controls/Field/Textarea.

### 뜨는 자리

흐름이 여는 자리다. 언제 열리는지는 아래 흐름 표가 적는다.

#### 옆 패널 (항목 열기)

| 자리 | 부품 | 이렇게 쓴다 |
|---|---|---|
| 패널 | `SidePanel width="side"`(`title` 항목 이름, `actions`에 ⋯ `IconButton` + `DropdownMenu` "휴지통으로", `onClose`, `onSubmit`) | 목록 옆에 열린다. |
| 언어 탭 | `Tabs` + `TabsList variant="line"` + `TabsTrigger` | 언어마다 이름과 설명을 따로 쓴다. 패널 안에서 바뀐다. |
| 이름 | `FormField` + `FormFieldLabel` + `Input size="md"` | 늘 입력 칸이다. 사이드 패널의 기본 높이 `md`(32px, 원칙 10). |
| 주소 | `FormField` + `Input mono size="md"` | 늘 입력 칸이다. |
| 설명 | `FormField` + `Textarea size="md"` | 늘 입력 칸이다. |
| 발 | `SidePanel footer`: `Text variant="note" tone="subtle"`("변경 사항 1") + `Button variant="primary" size="md"` "저장" | 바뀐 곳이 생겨야 나타난다. 바뀐 것이 없으면 발 자체가 없다(설정 › 컬렉션의 저장 묶음과 같다, 2026-11-05 소유자). 쓰는 글 수와 그 목록으로 가는 길은 목록 행의 "글 3"이 이미 준다(원칙 8). |

### 흐름 7 · 목록 정리

단계: 7.06, 7.07, 7.08, 7.09. 단계마다 보이는 것은 [flows/07-list-tidy-up.md](../flows/07-list-tidy-up.md)에 있다.

| 상태 | 단계 | 더해지는 것 | 스토리 |
|---|---|---|---|
| `stage` "태그" | 7.06 | 태그 목록과 `ListHead`("글 수" 내림차순), 쓰는 글 없는 태그는 흐린 "쓰는 글 없음" | Patterns/List/ListHead |
| `stage` "태그 고름" | 7.07 | 두 행 `selected`, `BulkBar`("합치기" · "휴지통으로") | Patterns/List/BulkBar |
| `stage` "태그 합치기" | 7.08 | 합치기 `Dialog` | Controls/Overlay/Dialog |
| `stage` "태그 합침" | 7.09 | 합쳐진 태그가 빠지고 남은 태그의 글 수가 늘어남, `toast` + "되돌리기" | Controls/Status/Toast |
